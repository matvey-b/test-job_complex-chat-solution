const _ = require('lodash')
const chalk = require('chalk')
const uuid = require('uuid/v4')
const crypto = require('crypto')
const jwt = require('../utils/jwt')
const knex = require('../utils/knex')
const BaseHandler = require('./base')
const redis = require('../utils/redis')

const TIME_FOR_AUTH = 60 * 1000 * 5 // 5 min на вызовы signUp или signIn
const TIME_TO_REFRESH_TOKEN = 60 * 1000 // 60 сек
const PASSWORDS_HASH_SALT = 'B0FJ0Bb17OpR'
const REDIS_SESSIONS_ACTIVITY_SET_KEY = 'sessions-last-activity'
const SESSION_ACTIVITY_UPDATE_INTERVAL = 60 * 2 * 1000
const DELETE_FORGOTTEN_SESSIONS_INTERVAL = 5 * 60 * 1000

const attach = socket => {
    socket.authHandlers = new AuthHandlers(socket)
}

/* 
Клиент может подключиться к бекенду без аутентификации. Но если он не сделает assignSession в течение TIME_FOR_AUTH, то сокет будет принудительно отключен.
Аутентификация клиента основана на JWT. Для того, чтобы получить токен, нужно сделать вызовы signUp(регистрация) или signIn(аутентификация).
Далее клиент получает токен, который действителен в течение jwt.TOKEN_LIFE_TIME.
Теперь клиент аутентифицирован, а также в следующий раз клиент может использовать токен для создания сессии, для этого он должен сделать запрос assignSession со своим токеном.
При всех следующих подключениях он сразу может делать assignSession, чтобы восстановить аутентификацию на бекенде.

Токен имеет время жизни, поэтому его необходимо перевыпускать. Если клиент подключен к бекенду, то бекенд направляет ему нотификацию TokenMustBeUpdated,
в результате которой клиент должен сделать запрос refreshToken(refreshToken) и получить новый токен. Если просроченный токен отправлен в запросы refreshToken или assignSession,
то клиент получает ответ `JWT_EXPIRED`. Если клиент не переиздает токен, то он будет отключен по истечении срока действия текущего токена.

Обычно в системах определают два токена refreshToken и activeToken.
Первый из них обычно используется только для перевыпуска active токена. Но тут я решил не тратить на это время и сделал так, что activeToken позволяет перевыпустить себя. 


Для некоторых фич, бекенду нужно знать кто сейчас подключен к сервису и из-за того, что в виде эксперимента я решил обеспечить поддержку кластеризации, стало необходимо
хранить инфу о подключенных пользователях в redis.
Это сделано в виде хранения ключей userId:socketId в sorted set. Значениями этих ключей будет timestamp момента, когда сокет делал очередной acknowledge о своем присутствии.
ZSET sessions-last-activity = [user1:session1 = last-ack-timestamp, user1:session2 = last-ack-timestamp, ...]
Отдельный воркер должен будет вычищать из этого множества все записи у которых timestamp не обновлялся более чем какой-то разрешенный порог времени
Т.е. если клиент не подтверждал свое присутствие в течение, например 5 мин, то он будет считаться потерянным. Такое может произойти например, если на бекенде убить процесс ноды.
*/

class AuthHandlers extends BaseHandler {
    constructor(socket) {
        super(socket)
        if (!this.socket.ctx) {
            this.socket.ctx = new SocketContext(socket)
        }
        this.setDestroyNotAuthorizedSocketTimeout(TIME_FOR_AUTH)
    }

    /**
     * Установить таймер на закрытие неавторизованного сокета
     */
    setDestroyNotAuthorizedSocketTimeout(time) {
        if (this.destroyNotAuthorizedSocketTimer) {
            clearTimeout(this.destroyNotAuthorizedSocketTimer)
        }
        this.destroyNotAuthorizedSocketTimer = setTimeout(() => this.socket.disconnect(), time)
    }

    async deleteSessionActivityEntity() {
        if (this.socket.ctx.user) {
            await redis.zrem(REDIS_SESSIONS_ACTIVITY_SET_KEY, this.makeSessionActivityKey())
        }
    }

    async insertSessionActivityEntity() {
        await redis.zadd(REDIS_SESSIONS_ACTIVITY_SET_KEY, getCurrentUnixTime(), this.makeSessionActivityKey())
    }

    makeSessionActivityKey() {
        return `${this.socket.ctx.user.id}:${this.socket.id}`
    }

    clearTimers() {
        clearTimeout(this.destroyNotAuthorizedSocketTimer)
        clearTimeout(this.tokenTimeoutTimer)
        clearInterval(this.updateSessionActivityTimer)
    }

    assignEventListeners() {
        // note: после удаления сокета, таймеры остаются жить, поэтому нужно их принудительно отключать
        this.socket.on('disconnect', () => {
            this.clearTimers()
        })
    }

    async assignUserToSocket(user) {
        if (_.get(this.socket.ctx, 'user.id') !== (user.id || user)) {
            if (_.isObject(user)) {
                this.socket.ctx.setUser(user)
            } else {
                const res = await knex('users')
                    .first('id', 'login')
                    .where({ id: user })
                this.socket.ctx.setUser(res)
            }
            this.updateSessionActivityTimer = setInterval(
                () => this.insertSessionActivityEntity(),
                SESSION_ACTIVITY_UPDATE_INTERVAL,
            )
            console.log(`${this.socket.ctx.user.login} was authenticated`)
        }
        return this.socket.ctx.user
    }

    // попросить клиента, чтобы он обновил просроченный токен
    sendTokenMustBeUpdated() {
        this.socket.emit('TokenMustBeUpdated')
    }

    /**
     * Оповещает клиента о том, что нужно перевыпустить токен. Ставит таймер на отключение клиента, если он не перевыпустит токен.
     */
    scheduleNotificationAboutTokenExpiration(token) {
        if (_.isString(token)) {
            token = jwt.decode(token)
        }
        if (this.tokenTimeoutTimer) {
            clearTimeout(this.tokenTimeoutTimer)
        }
        if (this.destroyNotAuthorizedSocketTimer) {
            clearTimeout(this.destroyNotAuthorizedSocketTimer)
        }
        this.tokenTimeoutTimer = setTimeout(() => {
            this.sendTokenMustBeUpdated()
            this.setDestroyNotAuthorizedSocketTimeout(TIME_TO_REFRESH_TOKEN)
        }, token.timeToExpiration - TIME_TO_REFRESH_TOKEN)
    }

    /**
     * Пишит нового пользователя в базу и привязывает его к сокету.
     * Если вызвать будучи залогининым под другим пользователем, то аутентификация первого заменяется на новую.
     */
    async rpcSignUp({ login, password }) {
        const existedUser = await knex('users')
            .first('id')
            .where({ login })
        if (existedUser) {
            throw this.makeRpcError({
                code: 'LOGIN_ALREADY_REGISTERED',
                message: 'Provided login name already registered. Please choose another login.',
            })
        }
        const user = { id: uuid(), login }
        await knex('users').insert({ ...user, password: hashPassword(password), createdAt: new Date() })
        const token = await jwt.sign(user)
        await this.assignUserToSocket(user)
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.socket.ctx.user, token }
    }

    async rpcSignIn({ login, password }) {
        const user = await knex('users')
            .first('id', 'login', 'password')
            .where({ login })
        if (!user) {
            throw this.makeRpcError({
                code: 'USER_NOT_FOUND',
                message: 'User with provided login not registered.',
            })
        }
        if (hashPassword(password) !== user.password) {
            throw this.makeRpcError({ code: 'INVALID_PASSWORD', message: 'Entered incorrect password or login' })
        }
        const token = await jwt.sign(user)
        await this.assignUserToSocket(user)
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.socket.ctx.user, token }
    }

    async rpcReissueToken(token) {
        this.validateAuthorization()

        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN чтобы клиент мог при желании это как-то более тонко обработать
        if (!(await jwt.verify(token).catch(() => null))) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        const newToken = await jwt.sign(this.socket.ctx.user)
        this.scheduleNotificationAboutTokenExpiration(newToken)

        return newToken
    }

    async rpcAssignSession(token) {
        if (!this.socket.ctx.user) {
            const decodedToken = await jwt.verify(token).catch(() => null)
            // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN
            if (!decodedToken) {
                throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
            }

            await this.assignUserToSocket(decodedToken.userId)
            this.scheduleNotificationAboutTokenExpiration(decodedToken)
        }

        return this.socket.ctx.user
    }
}

class SocketContext {
    constructor(socket) {
        this.user = null
    }

    setUser(user) {
        this.user = _.pick(user, 'id', 'login')
    }

    get isAuthenticated() {
        return Boolean(this.user)
    }

    get publicUserData() {
        return _.pick(this.user, 'id', 'login')
    }
}

const hashPassword = str =>
    crypto
        .createHash('sha256', PASSWORDS_HASH_SALT)
        .update(str)
        .digest('hex')

const getCurrentUnixTime = () => Math.floor(Date.now() / 1000)
if (process.env.MAINTAIN_FORGOTTEN_SESSIONS === 'true') {
    console.log(
        chalk.green.bold(`That node configured to cleaning up forgotten sessions. Setting up cleaning interval...`),
    )
    setInterval(async () => {
        const res = await redis.zremrangebyscore(
            REDIS_SESSIONS_ACTIVITY_SET_KEY,
            '-inf',
            getCurrentUnixTime() - SESSION_ACTIVITY_UPDATE_INTERVAL / 1000 - 10, // 10 сек на всякий пожарный набрасываю, вдруг у клиента сеть сильно мигает.
        )
        if (res) {
            console.log(chalk.green.bold(`FORGOTTEN SESSIONS SET WAS SUCCESSFULLY CLEANED. DELETED ${res} ENTITIES`))
        }
    }, DELETE_FORGOTTEN_SESSIONS_INTERVAL)
}

module.exports = { attach }

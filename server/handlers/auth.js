const _ = require('lodash')
const uuid = require('uuid/v4')
const auth = require('../utils/auth')
const knex = require('../utils/knex')
const BaseHandler = require('./base')
const redis = require('../utils/redis')
const dateTime = require('../utils/date-time')

const TIME_FOR_AUTH = 60 * 1000 * 5 // 5 min на вызовы signUp или signIn
const TIME_TO_REFRESH_TOKEN = 60 * 1000 // 60 сек

const SESSION_ACTIVITY_UPDATE_INTERVAL = 60 * 2 * 1000

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
*/

class AuthHandlers extends BaseHandler {
    constructor(socket) {
        super(socket)
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
        if (this.ctx.user) {
            await redis.del(this.socket.id)
        }
    }

    async upsertSessionActivityEntity() {
        await redis.setex(this.socket.id, dateTime.asUnixTime(SESSION_ACTIVITY_UPDATE_INTERVAL) + 10, this.ctx.user.id)
    }

    clearTimers() {
        clearTimeout(this.destroyNotAuthorizedSocketTimer)
        clearTimeout(this.tokenTimeoutTimer)
        clearInterval(this.updateSessionActivityTimer)
    }

    assignEventListeners() {
        // note: после удаления сокета, таймеры остаются жить, поэтому нужно их принудительно отключать
        this.socket.on('disconnect', async () => {
            this.clearTimers()
            if (this.ctx.user) {
                await this.deleteSessionActivityEntity()
            }
        })
    }

    async authUserOnSocket({ user, jwt }) {
        if (_.get(this.ctx, 'user.id') !== (user.id || user)) {
            if (_.isObject(user)) {
                this.ctx.setSession({ user, jwt })
            } else {
                const res = await knex('users')
                    .first('*')
                    .where({ id: user })
                this.ctx.setSession({ user: res, jwt })
            }
            await this.upsertSessionActivityEntity()
            this.updateSessionActivityTimer = setInterval(
                () => this.upsertSessionActivityEntity(),
                SESSION_ACTIVITY_UPDATE_INTERVAL,
            )
        }
        return this.ctx.user
    }

    async dropAuthFromSocket() {
        this.ctx.dropSession()
        this.clearTimers()
        this.setDestroyNotAuthorizedSocketTimeout(TIME_FOR_AUTH)
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
            token = auth.decode(token)
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
        await knex('users').insert({ ...user, password: auth.hashPassword(password), createdAt: new Date() })
        const token = await auth.sign(user)
        await this.authUserOnSocket({ user, jwt: token })
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.ctx.user, token }
    }

    async rpcSignIn({ login, password }) {
        const user = await knex('users')
            .first('*')
            .where({ login })
        if (!user) {
            throw this.makeRpcError({
                code: 'USER_NOT_FOUND',
                message: 'User with provided login not registered.',
            })
        }
        if (auth.hashPassword(password) !== user.password) {
            throw this.makeRpcError({ code: 'INVALID_PASSWORD', message: 'Entered incorrect password or login' })
        }
        const token = await auth.sign(user)
        await this.authUserOnSocket({ user, jwt: token })
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.ctx.user, token }
    }

    async rpcReissueToken(token) {
        this.validateAuthorization()

        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN чтобы клиент мог при желании это как-то более тонко обработать
        if (!(await auth.verify(token).catch(() => null))) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        const newToken = await auth.sign(this.ctx.user)
        this.scheduleNotificationAboutTokenExpiration(newToken)

        return newToken
    }

    async rpcAuthViaJwt(token) {
        if (!this.ctx.user) {
            const decodedToken = await auth.verify(token).catch(() => null)
            // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN
            if (!decodedToken) {
                throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
            }

            await this.authUserOnSocket({ user: decodedToken.userId, jwt: token })
            this.scheduleNotificationAboutTokenExpiration(decodedToken)
        }

        return this.ctx.user
    }

    async rpcLogout() {
        this.validateAuthorization()
        await Promise.all(this.socket.handlers.map(h => h.handleLogout()))
        await this.dropAuthFromSocket()
    }
}

module.exports = AuthHandlers

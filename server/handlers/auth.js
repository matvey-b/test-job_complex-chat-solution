const _ = require('lodash')
const knex = require('../utils/knex')
const uuid = require('uuid/v4')
const crypto = require('crypto')
const jwt = require('../utils/jwt')
const AbstractHandler = require('./abstract')

const TIME_FOR_AUTH = 60 * 1000 * 5 // 5 min на вызовы signUp или signIn
const TIME_TO_REFRESH_TOKEN = 60 * 1000 // 60 сек
const PASSWORDS_HASH_SALT = 'B0FJ0Bb17OpR'

const attach = socket => {
    socket.authHandler = new AuthManager(socket)
}

/* 
Клиент может подключиться к бекенду без аутентификации. Но если он не сделает assignSession в течение TIME_FOR_AUTH, то сокет будет принудительно отключен.
Аутентификация клиента основана на JWT. Для того, чтобы получить токен, нужно сделать вызовы signUp(регистрация) или signIn(аутентификация).
Далее клиент получает токен, который действителен в течение jwt.TOKEN_LIFE_TIME.
Далее клиент может использовать токен для создания сессии, для этого он должен сделать запрос assignSession со своим токеном.
При всех следующих подключениях он сразу может делать assignSession, чтобы восстановить аутентификацию на бекенде.

Токен имеет время жизни, поэтому его необходимо перевыпускать. Если клиент подключен к бекенду, то бекенд направляет ему нотификацию TokenMustBeUpdated,
в результате которой клиент должен сделать запрос refreshToken(refreshToken) и получить новый токен. Если просроченный токен отправлен в запросы refreshToken или assignSession,
то клиент получает ответ `JWT_EXPIRED`. Если клиент не переиздает токен, то он будет отключен по истечении срока действия токена.

Обычно в системах определают два токена refreshToken и activeToken.
Первый из них обычно используется только для перевыпуска active токена. Но тут я решил не тратить на это время и сделал так, что activeToken позволяет перевыпустить себя. 
*/

class AuthManager extends AbstractHandler {
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

    clearTimers() {
        clearTimeout(this.destroyNotAuthorizedSocketTimer)
        clearTimeout(this.tokenTimeoutTimer)
    }

    assignEventListeners() {
        // note: после удаления сокета, таймеры остаются жить, поэтому нужно их принудительно отключать
        this.socket.on('disconnect', () => this.clearTimers())
    }

    async assignUserToSocket(user) {
        if (_.get(this.socket.ctx, 'user.id') !== (user.id || user)) {
            if (_.isObject(user)) {
                this.socket.ctx.user = _.pick(user, 'id', 'login')
            } else {
                this.socket.ctx.user = await knex('users').first('id', 'login')
            }
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
        if (!login || !password) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: `You must provide login and password` })
        }
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
        await knex('users').insert({ ...user, password: hashPassword(password) })
        const token = await jwt.sign(user)
        await this.assignUserToSocket(user)
        this.scheduleNotificationAboutTokenExpiration(token)
        return { user: this.socket.ctx.user, token }
    }

    async rpcSignIn({ login, password }) {
        if (!login || !password) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: `You must provide login and password` })
        }
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
        if (!token) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: 'Token must be provided' })
        }

        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN чтобы клиент мог при желании это как-то более тонко обработать
        if (!(await jwt.verify(token).catch(() => null))) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        const newToken = await jwt.sign(this.socket.ctx.user)
        this.scheduleNotificationAboutTokenExpiration(newToken)

        return newToken
    }

    async rpcAssignSession(token) {
        if (!token) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: 'Token must be provided' })
        }
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

const hashPassword = str =>
    crypto
        .createHash('sha256', PASSWORDS_HASH_SALT)
        .update(str)
        .digest('hex')

module.exports = { attach }

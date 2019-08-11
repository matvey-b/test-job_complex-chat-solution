const _ = require('lodash')
const jwt = require('../utils/jwt')
const AbstractHandler = require('./abstract')

const TIME_FOR_AUTH = 60 * 1000 * 5 // 5 min на вызовы signUp или signIn
const TIME_TO_REFRESH_TOKEN = 60 * 1000 // 60 сек

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
то клиент получает ответ `JWT_EXPIRED`.

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

    async assignUserToSocket(id) {
        if (this.socket.ctx.user) {
            return true
        }
        this.socket.ctx.user = { name: 'vasya' }
        return true
    }

    // попросить клиента, чтобы он обновил просроченный токен
    sendTokenMustBeUpdated() {
        this.socket.emit('TokenMustBeUpdated')
    }

    scheduleNotificationAboutTokenExpiration(decodedToken) {
        if (this.tokenTimeoutTimer) {
            clearTimeout(this.tokenTimeoutTimer)
        }
        if (this.destroyNotAuthorizedSocketTimer) {
            clearTimeout(this.destroyNotAuthorizedSocketTimer)
        }
        this.tokenTimeoutTimer = setTimeout(() => {
            this.sendTokenMustBeUpdated()
            this.setDestroyNotAuthorizedSocketTimeout(TIME_TO_REFRESH_TOKEN)
        }, decodedToken.timeToExpiration - TIME_TO_REFRESH_TOKEN)
    }

    rpcSignUp({ login }) {
        if (this.socket.ctx.user) {
            return true
        }
        if (login === 'vasya') {
            _.set(this.socket, 'ctx.user', { name: 'vasya' })
            return true
        }
        throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Wrong password or login' })
    }

    rpcSignIn({ login, password }) {
        if (_.get(this.socket, 'ctx.user')) {
            return true
        }
        if (login === 'vasya') {
            _.set(this.socket, 'ctx.user', { name: 'vasya' })
            return true
        }
        throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Wrong password or login' })
    }

    async rpcReissueToken(token) {
        if (!token) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: 'Token must be provided' })
        }

        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN чтобы клиент мог при желании это как-то более тонко обработать
        const decodedToken = await jwt.verify(token).catch(() => null)
        if (!decodedToken) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        this.scheduleNotificationAboutTokenExpiration(decodedToken)
    }

    async rpcAssignSession(token) {
        if (!token) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: 'Token must be provided' })
        }
        if (this.socket.ctx.user) {
            return true
        }
        const decodedToken = await jwt.verify(token).catch(() => null)
        // fixme: нужно разделить ошибки JWT_EXPIRED и INVALID_TOKEN_SIGN
        if (!decodedToken) {
            throw this.makeRpcError({ code: 'JWT_EXPIRED', message: 'Invalid token provided' })
        }

        if (!this.socket.ctx.user) {
            // populate user from cache
            console.log('NEED USER POPULATION in refresh session')
        }
        this.scheduleNotificationAboutTokenExpiration(decodedToken)
    }
}

module.exports = { attach }

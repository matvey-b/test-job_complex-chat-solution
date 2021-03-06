import { observable, decorate } from 'mobx'
import { makeRpcCall, socket } from '../io'

class AuthStore {
    isLoading = false
    user = (localStorage.getItem('user') && JSON.parse(localStorage.getItem('user'))) || null
    jwt = localStorage.getItem('jwt') || null
    error = null
    isAuthenticated = false
    isReconnected = false
    isRestoringSession = true

    constructor() {
        socket.on('connect', () => this.restoreSession())
        socket.on('reconnect', () => (this.isReconnected = true))
        socket.on('disconnect', () => {
            this.isReconnected = false
        })
    }

    saveSession({ token, user }) {
        localStorage.setItem('jwt', token)
        localStorage.setItem('user', JSON.stringify(user))
        this.user = user
        this.jwt = token
    }

    dropSession() {
        localStorage.removeItem('jwt')
        localStorage.removeItem('user')
        this.user = null
        this.jwt = null
    }

    async makeRpcCall(method, ...args) {
        this.error = null
        this.isLoading = true
        const res = await makeRpcCall(method, ...args)
        this.isLoading = false
        if (res.name === 'Error') {
            // fixme: вот это костыль. Для некоторых методов не нужно показывать алерт ошибки. Видимо всетаки не стоит централизованно выставлять ошибку.
            if (method !== 'rpcAuthViaJwt') {
                this.error = { code: res.code, message: res.message }
            }
            return null
        }
        return res
    }

    async signUp(input) {
        const auth = await this.makeRpcCall('rpcSignUp', input)
        if (auth) {
            this.saveSession(auth)
            this.isAuthenticated = true
        }
    }

    async signIn(input) {
        const auth = await this.makeRpcCall('rpcSignIn', input)
        if (auth) {
            this.saveSession(auth)
            this.isAuthenticated = true
        }
    }

    async logout() {
        if (this.isAuthenticated) {
            const res = await this.makeRpcCall('rpcLogout')
            if (res === true) {
                this.dropSession()
                this.isAuthenticated = false
                this.isReconnected = false
            }
        }
    }

    /**
     * Попытаться восстановить сессию из токена, который хранится в локал сторе.
     * Если ок, то не показывать модалку авторизации
     */
    async restoreSession() {
        if (this.jwt) {
            const res = await this.makeRpcCall('rpcAuthViaJwt', this.jwt)
            if (!res) {
                this.isAuthenticated = false
            } else {
                this.isAuthenticated = true
            }
        } else {
            this.isAuthenticated = false
        }
        this.isRestoringSession = false
    }
}

decorate(AuthStore, {
    isLoading: observable,
    user: observable,
    jwt: observable,
    isAuthenticated: observable,
    isReconnected: observable,
    isRestoringSession: observable,
    error: observable,
})

export default new AuthStore()

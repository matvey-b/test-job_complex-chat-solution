const _ = require('lodash')

class SocketContextManager {
    constructor(socket) {
        this.user = null
        this.jwt = null
    }

    setSession({ user, jwt }) {
        this.user = user
        this.jwt = jwt
    }

    get sessionId() {
        if (!this.user) {
            throw new Error(`Cannot create sessionId for not authenticated user`)
        }
        return `${this.user.id}:${this.jwt.split('.')[2]}`
    }

    get isAdmin() {
        return this.user.isAdmin
    }

    get isAuthenticated() {
        return Boolean(this.user)
    }

    get publicUserData() {
        return _.pick(this.user, 'id', 'login', 'isAdmin')
    }
}

module.exports = SocketContextManager

const _ = require('lodash')
const chalk = require('chalk')

class SocketContextManager {
    constructor(socket) {
        this.socket = socket
        this.user = null
        this.jwt = null
    }

    setSession({ user, jwt }) {
        this.user = user
        this.jwt = jwt
        console.log(chalk.green.bold(`${this.user.login} was authenticated`))
    }

    dropSession() {
        this.user = null
        this.jwt = null
    }

    get sessionId() {
        if (!this.user) {
            throw new Error(`Cannot create sessionId for not authenticated user`)
        }
        return `${this.user.id}:${this.socket.id}`
    }

    get isAdmin() {
        return this.isAuthenticated && this.user.isAdmin
    }

    get isAuthenticated() {
        return Boolean(this.user)
    }

    get publicUserData() {
        return _.pick(this.user, 'id', 'login', 'isAdmin')
    }
}

module.exports = SocketContextManager

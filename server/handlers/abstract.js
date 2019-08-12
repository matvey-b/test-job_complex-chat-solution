const _ = require('lodash')
const serializeError = require('serialize-error')

class AbstractHandler {
    constructor(socket) {
        this.socket = socket
        if (!this.ctx) {
            this.socket.ctx = this.ctx = new SocketContext(socket)
        }
        this.assignEventListeners()
        this.assignRpcCalls()
    }

    // fixme: реализовать централизованное инстанцирование всех менеджеров и сделать, чтобы на них вызывался метод restoreState()
    // в нем сокет должен был подключен ко всем нужным комнатам и должен обзавестить актуальным контекстом, если требуется.
    // эта функция асинхронная, поэтому не получится вызвать её при инстанцировании обработчиков
    async restoreState() {}

    assignEventListeners() {
        return this
    }

    /**
     * Слушать все rpc вызовы на сокете
     * Все методы которые начинаются на rpc, например rpcSignUp, это rpc вызовы которые могут делать клиенты
     */
    assignRpcCalls() {
        return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(key => key.slice(0, 3) === 'rpc')
            .forEach(rpcCallName => this.socket.on(rpcCallName, this.handleRpcCall(this[rpcCallName])))
    }

    getConnectedRoomsList() {
        return Object.keys(this.socket.rooms)
    }

    validateAuthorization() {
        if (!this.ctx.isAuthenticated) {
            throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Authorization required' })
        }
    }

    joinToRoom(roomName) {
        return new Promise((resolve, reject) => this.socket.join(roomName, err => (err ? reject(err) : resolve())))
    }

    leaveRoom(roomName) {
        return new Promise((resolve, reject) => this.socket.leave(roomName, err => (err ? reject(err) : resolve())))
    }

    makeRpcError(err) {
        if (err.code && err.message) {
            return serializeError(new RcpError(err))
        }
        return serializeError(new RcpError({ reason: err }))
    }

    handleRpcCall(handler) {
        return async (...args) => {
            const fn = args.pop()
            if (!_.isFunction(fn)) {
                throw new Error(`REMOTE FUNCTION CALLED WITHOUT CALLBACK FUNCTION`)
            }
            try {
                const res = await handler.call(this, ...args)
                return fn(res)
            } catch (error) {
                return fn(this.makeRpcError(error))
            }
        }
    }
}

class SocketContext {
    constructor(socket) {
        this.socket = socket
        this.user = null
    }

    get isAuthenticated() {
        return Boolean(this.user)
    }

    get publicUserData() {
        return _.pick(this.user, 'id', 'login')
    }
}

class RcpError extends Error {
    constructor({ message = 'Internal Server Error', code = 'INTERNAL_ERROR', reason = null }) {
        super(message)
        this.code = code
        this.reason = process.env.NODE_ENV === 'production' ? null : reason
        if (reason && reason.stack) {
            // убираю ненужный стек трейс, т.к. тот который нам полезен находится в reason.stack
            this.stack = undefined
        }
        if (code === 'INTERNAL_ERROR') {
            console.log(`INTERNAL_SERVER_ERROR. Reason: `, reason)
        }
    }
}

module.exports = AbstractHandler

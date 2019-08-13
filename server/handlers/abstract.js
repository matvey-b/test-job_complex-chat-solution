const _ = require('lodash')
const serializeError = require('serialize-error')

class AbstractHandler {
    constructor(socket) {
        this.socket = socket
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
            .forEach(rpcCallName => this.socket.on(rpcCallName, this.handleRpcCall(rpcCallName, this[rpcCallName])))
    }

    getConnectedRoomsList() {
        return Object.keys(this.socket.rooms)
    }

    validateAuthorization() {
        if (!this.socket.ctx.isAuthenticated) {
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

    handleRpcCall(method, handler) {
        return async (...args) => {
            const fn = args.pop()
            console.log(String().padEnd(10, '='))
            console.log(
                `Start handling RPC call "${method}" on ${_.get(
                    this.socket,
                    'ctx.user.login',
                    'UNAUTHENTICATED',
                )} socket`,
            )
            if (!_.isFunction(fn)) {
                throw new Error(`REMOTE FUNCTION CALLED WITHOUT CALLBACK FUNCTION`)
            }
            console.log(`Input: `, ...args)
            try {
                const res = await handler.call(this, ...args)
                console.log(`Success: `, res)
                return fn(res)
            } catch (error) {
                console.log(`Error: `, error)
                return fn(this.makeRpcError(error))
            } finally {
                console.log(String().padEnd(10, '='))
            }
        }
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

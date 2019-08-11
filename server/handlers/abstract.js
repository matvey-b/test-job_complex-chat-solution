const _ = require('lodash')
const serializeError = require('serialize-error')

class AbstractHandler {
    constructor(socket) {
        this.socket = socket
        if (!this.socket.ctx) {
            this.socket.ctx = {}
        }
        this.assignEventListeners()
        this.assignRpcCalls()
    }

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

    validateAuthorization() {
        if (!this.socket.ctx.user) {
            throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Authorization required' })
        }
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

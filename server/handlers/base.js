const _ = require('lodash')
const chalk = require('chalk')
const validators = require('../utils/validators')
const serializeError = require('serialize-error')

class BaseHandler {
    constructor(socket) {
        // note: беру за сервера namespace, т.к. socket.io создает "виртуальный" сокет в рамках неймспеса, т.е. для разных неймспейсов создаются свои независимые сокеты, даже если это одно соединение уровня вебсокетов
        this.server = socket.nsp
        this.socket = socket
        this.assignEventListeners()
        this.assignRpcCalls()
    }

    // fixme: реализовать централизованное инстанцирование всех менеджеров и сделать, чтобы на них вызывался метод restoreState()
    // в нем сокет должен был подключен ко всем нужным комнатам и должен обзавестить актуальным контекстом, если требуется.
    // эта функция асинхронная, поэтому не получится вызвать её при инстанцировании(т.е. в конструкторах) обработчиков
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

    /**
     * @param {{code: String, message: String} | Error} err
     */
    makeRpcError(err) {
        if (err.isJoi) {
            return serializeError(new RcpError({ message: err.message, code: 'BAD_REQUEST' }))
        }
        if (err.code && err.message) {
            return serializeError(new RcpError(err))
        }
        return serializeError(new RcpError({ reason: err }))
    }

    handleRpcCall(method, handler) {
        return async (...args) => {
            const fn = args.pop()
            console.log(chalk.cyan.bold(String().padEnd(10, '=')))
            console.log(
                `Start handling RPC call "${chalk.bgGreen.black(method)}" on ${_.get(
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
                const validator = validators[`${method}InputSchema`]
                if (validator) {
                    // note: попытка уйти от ручных валидаций в коде
                    // единственное, я пока не заморачиваюсь и валидирую только первый аргумент
                    await validator.validate(args[0])
                } else if (args.length) {
                    console.log(
                        `${chalk.redBright(
                            'WARNING! YOU ARE FORGOT TO ADD VALIDATION RULES FOR RPC CALL',
                        )} ${chalk.bgGreen.black(method)}`,
                    )
                }
                const res = await handler.call(this, ...args)
                console.log(`Success: `, res)
                return fn(res)
            } catch (error) {
                console.log(`Error: `, error)
                return fn(this.makeRpcError(error))
            } finally {
                console.log(chalk.cyan.bold(String().padEnd(10, '=')))
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

module.exports = BaseHandler

const _ = require('lodash')
const chalk = require('chalk')
const RoomsManager = require('./roomsManager')
const validators = require('../utils/validators')
const serializeError = require('serialize-error')
const SocketContextManager = require('./ctxManager')
const { readdir } = require('fs').promises

/* 
Базовый класс "обработчика" сокета.
Используется как основа для остальных классов обработчиков.

Добавляет возможность делать rpc вызовы и прочие базовые вещи на сокете. Также отвечает за подключение обработчиков событий определенных в дочерних классах на сокет.

ВНИМАНИЕ!
Этот класс можно использовать только как абстрактный. Он не должен производить никаких изменений на сокете, кроме определенных на дочернем классе.
Например, если повешать на сокет в конструкторе этого класса какой-нибудь обработчик, то он будет подключен столько раз, сколько в системе определено дочерних классов.
*/
class BaseHandler {
    constructor(socket) {
        // note: беру за сервера namespace, т.к. socket.io создает "виртуальный" сокет в рамках неймспеса, т.е. для разных неймспейсов создаются свои независимые сокеты, даже если это одно соединение уровня вебсокетов
        this.server = socket.nsp
        this.socket = socket

        if (!this.ctx) {
            this.ctx = new SocketContextManager(socket)
        }
        if (!this.roomsManager) {
            this.roomsManager = new RoomsManager(this.socket)
        }

        this.assignEventListeners()
        this.assignRpcCalls()

        if (!this.socket.rpcCallsValidatorHasBeenSet) {
            this.socket.rpcCallsValidatorHasBeenSet = true
            this.socket.use((packet, next) => {
                if (!socket.eventNames().includes(_.head(packet))) {
                    console.log(chalk.red(`Gotten unknown message on socket: `), packet)
                    if (_.isFunction(_.last(packet))) {
                        return _.last(packet)({
                            name: 'Error',
                            code: 'UNSUPPORTED_RPC_METHOD',
                            message: `Server not supports '${_.head(packet)}' rpc method`,
                        })
                    }
                    return next(new Error(`Message\\event '${_.head(packet)}' is not supported by server`))
                }
                next()
            })
        }
    }

    /**
     * Ниже определены геттеры(где есть @type декларация) и сеттеры в первую очередь для того, чтобы работал автокомплит =)
     */
    /** @type {RoomsManager} */
    get roomsManager() {
        return this.socket.roomsManager
    }

    set roomsManager(roomsManager) {
        this.socket.roomsManager = roomsManager
    }

    set ctx(context) {
        this.socket.ctx = context
    }

    /** @type {SocketContextManager} */
    get ctx() {
        return this.socket.ctx
    }

    assignEventListeners() {
        return this
    }

    /**
     * Абстрактный метод обработки логаута пользователя
     */
    async handleLogout() {}

    /**
     * Слушать все rpc вызовы на сокете
     * Все методы которые начинаются на rpc, например rpcSignUp, это rpc вызовы которые могут делать клиенты
     */
    assignRpcCalls() {
        return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
            .filter(key => key.slice(0, 3) === 'rpc')
            .forEach(rpcCallName => this.socket.on(rpcCallName, this.handleRpcCall(rpcCallName, this[rpcCallName])))
    }

    validateAuthorization() {
        if (!this.ctx.isAuthenticated) {
            throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Authorization required' })
        }
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
                    args[0] = await validator.validate(args[0])
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

    static async attachHandlers(socket) {
        const handlersConstructors =
            BaseHandler.loadedHandlersConstructors || (BaseHandler.loadedHandlersConstructors = await loadHandlers())
        socket.handlers = handlersConstructors.map(Handler => new Handler(socket))
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

const loadHandlers = async () => {
    const fileNames = await readdir(__dirname).then(items => items.filter(fName => fName !== 'base'))
    const modules = fileNames.map(fName => require(`./${fName}`))
    return modules.filter(module => module.prototype instanceof BaseHandler)
}

module.exports = BaseHandler

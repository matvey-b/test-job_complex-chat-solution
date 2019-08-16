const _ = require('lodash')
const chalk = require('chalk')
const redis = require('../utils/redis')
const dateTime = require('../utils/date-time')
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

    async getUsersIdsConnectedToRoom(roomName) {
        return redis.zrange(`room:${roomName}:members`, 0, -1).then(res =>
            _(res)
                .compact()
                .map(val =>
                    _(val)
                        .split(':')
                        .head(),
                )
                .uniq()
                .value(),
        )
    }

    validateAuthorization() {
        if (!this.socket.ctx.isAuthenticated) {
            throw this.makeRpcError({ code: 'UNAUTHORIZED', message: 'Authorization required' })
        }
    }

    async joinToRoom(roomName) {
        await Promise.all([
            new Promise((resolve, reject) => this.socket.join(roomName, err => (err ? reject(err) : resolve()))),
            Promise.resolve().then(async () => {
                const wasAdded = await redis.zadd(
                    `room:${roomName}:members`,
                    dateTime.asUnixTime(),
                    this.socket.ctx.sessionId,
                )
                if (wasAdded) {
                    // если клиент ранее не регистрировался в комнате, то продолжаем флоу регистрации в комнате
                    await redis
                        .multi()
                        .zincrby(`rooms`, 1, roomName)
                        .sadd(`session:${this.socket.ctx.sessionId}:rooms`, roomName)
                        .exec()
                        .then(res => {
                            // fixme: тут какая-то ерунда творится с ioredis..
                            // во первых, в exec первым аргументом всегда прилетает null, даже если ошибка была в запросе
                            // во вторых, если была ошибка в одном из запросов, то это не мешает исполнится другому..
                            // это как-то не вписывается в мое понимание транзакций.. Нужно разбираться
                            const errors = _(res)
                                .flatten()
                                .filter(val => val instanceof Error)
                                .value()
                            if (errors.length) {
                                throw errors[0]
                            }
                        })
                }
            }),
        ])
        if (!this.connectedRooms) {
            this.connectedRooms = new Set()
        }
        this.connectedRooms.add(roomName)
    }

    /* 
    fixme:
    Как я писал ранее, нужно реализовать чистку чатов от потерянных сессий, на случай если бекенд будет убиваться не аккуратно.
    */
    async leaveRoom(roomName) {
        await Promise.all([
            new Promise((resolve, reject) => this.socket.leave(roomName, err => (err ? reject(err) : resolve()))),
            Promise.resolve().then(async () => {
                const wasDeleted = await redis.zrem(`room:${roomName}:members`, this.socket.ctx.sessionId)
                if (wasDeleted) {
                    redis
                        .multi()
                        .zincrby(`rooms`, -1, roomName)
                        .srem(`session:${this.socket.ctx.sessionId}:rooms`, roomName)
                        .exec()
                        .then(res => {
                            // fixme: тут какая-то ерунда творится с ioredis..
                            // во первых, в exec первым аргументом всегда прилетает null, даже если ошибка была в запросе
                            // во вторых, если была ошибка в одном из запросов, то это не мешает исполнится другому..
                            // это как-то не вписывается в мое понимание транзакций.. Нужно разбираться
                            const errors = _(res)
                                .flatten()
                                .filter(val => val instanceof Error)
                                .value()
                            if (errors.length) {
                                throw errors[0]
                            }
                        })
                }
            }),
        ])
        if (this.connectedRooms) {
            this.connectedRooms.delete(roomName)
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

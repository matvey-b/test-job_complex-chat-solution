const _ = require('lodash')
const chalk = require('chalk')
const redis = require('../utils/redis')
const dateTime = require('../utils/date-time')
const validators = require('../utils/validators')
const serializeError = require('serialize-error')

/* 
Управление комнатами выделено в отдельный класс.
Сделано, чтобы было проще ориентироваться в коде.
*/
class RoomsManager {
    constructor(socket) {
        this.socket = socket
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
}

module.exports = RoomsManager

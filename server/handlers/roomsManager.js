const _ = require('lodash')
const redis = require('../utils/redis')

/* 
Управление комнатами выделено в отдельный класс.
Сделано, чтобы было проще ориентироваться в коде.
*/
class RoomsManager {
    constructor(socket) {
        this.socket = socket
        this.server = socket.nsp
    }

    getClientsConnectedToRoom(roomName) {
        return new Promise((resolve, reject) =>
            this.server.in(roomName).clients((err, clients) => (err ? reject(err) : resolve(clients))),
        )
    }

    async getUsersIdsConnectedToRoom(roomName) {
        return this.getClientsConnectedToRoom(roomName).then(socketIds => redis.mget(socketIds).then(_.compact))
    }

    async joinToRoom(roomName) {
        return new Promise((resolve, reject) => this.socket.join(roomName, err => (err ? reject(err) : resolve())))
    }

    async leaveRoom(roomName) {
        return new Promise((resolve, reject) => this.socket.leave(roomName, err => (err ? reject(err) : resolve())))
    }
}

module.exports = RoomsManager

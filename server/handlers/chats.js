const BaseHandler = require('./base')
const knex = require('../utils/knex')
const redis = require('../utils/redis')

const attach = socket => {
    socket.chatsHandlers = new ChatsHandlers(socket)
}

/* 
Участие(participation) в чате выражается только в том, что клиент в данный момент слушает на нем "socket.io сообщения" или нет, т.е. есть ли коннекшн и связь с chat room.

Каждый аутентифицированный клиент может:
- Получить список всех чатов: rpcGetChats
- Получить список сообщений: rpcGetChatMessages
- Отправить текстовые сообщения пользователям чатов: rpcSendChatMessage
- Подписаться на сообщения(разных типов, например о том, что новый пользователь подключен или о новом сообщении) из ОДНОГО чата,
при этом он автоматически отписывается от предыдущего чата: rpcSubscribeToChat
*/

class ChatsHandlers extends BaseHandler {
    constructor(...args) {
        super(...args)
        this.currentChatId = null
    }

    assignEventListeners() {
        this.socket.on('disconnect', async () => this.leaveChat(this.currentChatId))
    }

    async rpcGetOnlineUsersOfChat(chatId) {
        return this.roomsManager.getUsersIdsConnectedToRoom(this.makeChatRoomName(chatId))
    }

    makeChatReadOnlyUsersRedisKey(chatId) {
        return `chats:${chatId}:read-only-users`
    }

    async rpcChangeChatPermissions({ chatId, permissions, userId }) {
        this.validateAuthorization()
        if (!this.ctx.user.isAdmin) {
            throw this.makeRpcError({ code: 'NOT_ENOUGH_RIGHTS', message: 'Only admins can do that action' })
        }
        if (
            !(await knex('chats')
                .first('id')
                .where({ id: chatId }))
        ) {
            throw this.makeRpcError({ code: 'CHAT_NOT_FOUND', message: `Chat(${chatId}) not exists` })
        }
        if (
            !(await knex('users')
                .first('id')
                .where({ id: userId }))
        ) {
            throw this.makeRpcError({ code: 'USER_NOT_FOUND', message: `User(${userId}) not exists` })
        }
        let wasChanged = 0
        switch (permissions) {
            case 'readWrite':
                wasChanged = await redis.srem(this.makeChatReadOnlyUsersRedisKey(chatId), userId)
                break
            case 'readOnly':
                wasChanged = await redis.sadd(this.makeChatReadOnlyUsersRedisKey(chatId), userId)
                break
        }
        if (wasChanged) {
            this.server.to(this.makeChatRoomName(chatId)).emit('UserChatPermissionsWasChanged', { userId, permissions })
            return true
        }
        return false
    }

    async rpcGetChats({ filter = {}, limit } = {}) {
        this.validateAuthorization()
        const query = knex('chats')
            .orderBy('name', 'asc')
            .limit(limit)

        if (filter.ids) {
            query.whereIn('id', filter.ids)
        }

        return query.then(async chats => {
            if (chats.length) {
                const pipeline = redis.pipeline()
                chats.forEach(chat => pipeline.smembers(this.makeChatReadOnlyUsersRedisKey(chat.id)))
                const permissionsByChats = await pipeline.exec()
                chats.forEach((chat, idx) => {
                    chat.readOnlyUsers = permissionsByChats[idx][1]
                })
            }
            return chats
        })
    }

    async rpcGetChatMessages({ filter, limit }) {
        this.validateAuthorization()

        const query = knex('chat_messages')
            .where({ chatId: filter.chatId })
            .orderBy('id', 'desc')
            .limit(limit)

        if (filter.maxId) {
            query.where('id', '<=', filter.maxId)
        }

        return query
    }

    makeChatRoomName(id) {
        return `chat:${id}`
    }

    alreadyConnectedTo(chatId) {
        return this.currentChatId === chatId
    }

    async joinToChat(chatId) {
        const roomName = this.makeChatRoomName(chatId)
        await this.roomsManager.joinToRoom(roomName).then(() => (this.currentChatId = chatId))
        this.socket.to(roomName).broadcast.emit('UserWasJoinedToChat', this.ctx.user.id)
    }

    async leaveChat(chatId) {
        if (chatId) {
            const roomName = this.makeChatRoomName(chatId)
            await this.roomsManager.leaveRoom(roomName)
            this.socket.to(roomName).emit('UserWasLeftTheChat', this.ctx.user.id)
        }
    }

    async rpcSubscribeToChat(chatId) {
        this.validateAuthorization()
        if (chatId !== this.currentChatId) {
            await Promise.all([this.joinToChat(chatId), this.leaveChat(this.currentChatId)])
        }
        return true
    }

    async rpcSendChatMessage({ text, chatId }) {
        this.validateAuthorization()
        if (await redis.sismember(this.makeChatReadOnlyUsersRedisKey(chatId), this.ctx.user.id)) {
            throw this.makeRpcError({
                code: 'YOU_HAVE_READ_ONLY_RIGHTS',
                message: 'You have not permissions for send new messages into chat',
            })
        }
        const msg = { text, chatId, createdAt: new Date(), authorId: this.ctx.user.id }
        await knex('chat_messages')
            .insert(msg)
            .then(([id]) => Object.assign(msg, { id }))
        this.socket.to(this.makeChatRoomName(chatId)).broadcast.emit('NewChatMessage', msg)
        return msg
    }
}

module.exports = { attach }

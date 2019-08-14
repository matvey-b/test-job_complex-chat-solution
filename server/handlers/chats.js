const knex = require('../utils/knex')
const BaseHandler = require('./base')
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
        const clients = await this.server.in(this.makeChatRoomName(chatId)).clients()
    }

    async rpcGetChats() {
        this.validateAuthorization()
        return knex('chats').orderBy('name', 'asc')
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
        await this.joinToRoom(roomName).then(() => (this.currentChatId = chatId))
        this.socket.to(roomName).broadcast.emit('UserWasJoinedToChat', this.socket.ctx.publicUserData)
    }

    async leaveChat(chatId) {
        if (chatId) {
            const roomName = this.makeChatRoomName(chatId)
            await this.leaveRoom(roomName)
            this.socket.to(roomName).broadcast.emit('UserWasLeftTheChat', this.socket.ctx.publicUserData)
        }
    }

    async rpcSubscribeToChat(chatId) {
        this.validateAuthorization()
        if (chatId !== this.currentChatId) {
            await Promise.all([this.joinToChat(chatId), this.leaveChat(this.currentChatId)])
        }
        return true
    }
}

module.exports = { attach }

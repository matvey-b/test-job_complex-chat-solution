const knex = require('../utils/knex')
const AbstractHandler = require('./abstract')

const attach = socket => {
    socket.chatsManager = new ChatsManager(socket)
}

/* 
Участие в чате выражается только в том, что клиент в данный момент слушает на нем "socket.io сообщения" или нет.

Каждый аутентифицированный клиент может:
- Получить список всех чатов: rpcGetChats
- Получить список сообщений: rpcGetChatMessages
- Отправить текстовые сообщения пользователям чатов: rpcSendChatMessage
- Подписаться на сообщения(разных типов, например о том, что новый пользователь подключен или о новом сообщении) из ОДНОГО чата,
при этом он автоматически отписывается от предыдущего чата: rpcSubscribeToChat
*/

class ChatsManager extends AbstractHandler {
    constructor(...args) {
        super(...args)
        this.currentChatId = null
    }

    assignEventListeners() {
        this.socket.on('disconnect', async () => this.leaveChat(this.currentChatId))
    }

    async rpcGetChats() {
        this.validateAuthorization()
        return knex('chats').orderBy('name', 'asc')
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
        this.socket.to(roomName).broadcast.emit('UserWasJoinedToChat', this.ctx.publicUserData)
    }

    async leaveChat(chatId) {
        if (chatId) {
            const roomName = this.makeChatRoomName(chatId)
            await this.leaveRoom(roomName)
            this.socket.to(roomName).broadcast.emit('UserWasLeftTheChat', this.ctx.publicUserData)
        }
    }

    async rpcSubscribeToChat(chatId) {
        this.validateAuthorization()
        if (!chatId) {
            throw this.makeRpcError({ code: 'BAD_REQUEST', message: 'Chat id must be provided' })
        }
        if (chatId !== this.currentChatId) {
            await Promise.all([this.joinToChat(chatId), this.leaveChat(this.currentChatId)])
        }
        return true
    }
}

module.exports = { attach }

import { observable, decorate, computed } from 'mobx'
import usersStore from './users'
import authStore from './auth'
import { makeRpcCall, socket } from '../io'

class ChatsStore {
    chatsMap = new Map()
    // note: все время сортированы по убыванию и отсутствуют дубликаты
    chatsMessages = []
    storedMessagesIds = new Set()
    isLoading = false
    currentChatId = localStorage.getItem('currentChatId') || null

    constructor() {
        socket.on('NewChatMessage', msg => this.appendNotStoredMessages([msg]))
        socket.on('UserChatPermissionsWasChanged', ({ userId, permissions }) => {
            const updatedChat = this.currentChat
            if (permissions === 'readOnly') {
                updatedChat.readOnlyUsers.push(userId)
            } else {
                updatedChat.readOnlyUsers = updatedChat.readOnlyUsers.filter(id => id !== userId)
            }
            this.upsertChatsToStore([updatedChat])
        })
    }

    get haveWritePerms() {
        if (this.currentChat) {
            return !this.currentChat.readOnlyUsers.includes(authStore.user.id)
        }
        return false
    }

    get chats() {
        return [...this.chatsMap.values()]
    }

    get currentChat() {
        return this.currentChatId ? this.chats.find(chat => chat.id === this.currentChatId) || null : null
    }

    get currentChatMessages() {
        const messages = this.chatsMessages.filter(msg => msg.chatId === this.currentChatId)
        const users = usersStore.getUsers(messages.map(msg => msg.authorId))
        const result = messages.map(msg => ({
            ...msg,
            author: users.find(u => u.id === msg.authorId),
            isMy: msg.authorId === authStore.user.id,
        }))
        if (result.length) {
            const lastMsg = result.pop()
            lastMsg.isLast = true
            result.push(lastMsg)
        }
        return result
    }

    get onlineUsers() {
        return usersStore.getUsers(usersStore.onlineUsersIds)
    }

    async sendMessage(msg) {
        const res = await makeRpcCall('rpcSendChatMessage', { text: msg, chatId: this.currentChatId })
        if (res.name === 'Error') {
            throw new Error(`Cannot send chat message. Reason: ${res.message}`)
        }
        this.appendNotStoredMessages([res])
    }

    async loadOnlineUsers(chatId) {
        await usersStore.loadOnlineUsersOfChat(chatId)
    }

    /**
     * fixme: Это быстрая реализация мерджа новых сообщений в существующую стору с сохранением упорядоченности и уникальности сообщений.
     * Это нужно оптимизировать!
     */
    appendNotStoredMessages(messages) {
        const mergedMessages = [
            ...messages.filter(({ id }) => {
                if (!this.storedMessagesIds.has(id)) {
                    this.storedMessagesIds.add(id)
                    return true
                }
                return false
            }),
            ...this.chatsMessages,
        ].sort((a, b) => a.id - b.id)
        this.chatsMessages = mergedMessages
    }

    upsertChatsToStore(chats) {
        if (Array.isArray(chats) && chats.length) {
            const updatedChatsMap = new Map(this.chatsMap)
            chats.forEach(chat => {
                updatedChatsMap.set(chat.id, chat)
            })
            this.chatsMap = updatedChatsMap
        }
    }

    async loadCurrentChat() {
        if (this.currentChatId) {
            this.isLoading = true
            const chats = await makeRpcCall('rpcGetChats', { filter: { ids: [this.currentChatId] } })
            this.upsertChatsToStore(chats)
            this.isLoading = false
        }
    }

    async loadChats() {
        this.isLoading = true
        const items = await makeRpcCall('rpcGetChats')
        this.upsertChatsToStore(items)
        this.isLoading = false
    }

    /**
     * @param {{ filter: {maxId?: Number, chatId: String}, limit?: Number}} input
     * @returns {Promise<[{}]>}
     */
    async loadMessages({ filter, limit }) {
        this.isLoading = true
        return await makeRpcCall('rpcGetChatMessages', { filter, limit })
            .then(items => (Array.isArray(items) && items) || [])
            .then(items => {
                this.isLoading = false
                this.appendNotStoredMessages(items)
            })
    }

    async subscribeToChat(chatId) {
        const subscribed = await makeRpcCall('rpcSubscribeToChat', chatId)
        if (!subscribed) {
            console.error(`ERROR: Cannot subscribe to chat ${chatId}`)
        }
        this.setCurrentChatId(chatId)
    }

    setCurrentChatId(chatId) {
        localStorage.setItem('currentChatId', chatId)
        this.currentChatId = chatId
    }
}

decorate(ChatsStore, {
    chatsMap: observable,
    chats: computed,
    haveWritePerms: computed,
    currentChat: computed,
    chatsMessages: observable,
    isLoading: observable,
    currentChatId: observable,
    currentChatMessages: computed,
    onlineUsers: computed,
})

export default new ChatsStore()

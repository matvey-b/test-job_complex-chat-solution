import { observable, decorate, computed } from 'mobx'
import { makeRpcCall, socket } from '../io'

class ChatsStore {
    chats = []
    // note: все время сортированы по убыванию и отсутствуют дубликаты
    chatsMessages = []
    storedMessagesIds = new Set()
    isLoading = false
    currentChatId = null

    get currentChatMessages() {
        return this.chatsMessages.filter(msg => msg.chatId === this.currentChatId)
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
        ].sort((a, b) => b.id - a.id)
        this.chatsMessages = mergedMessages
        console.log('mergedChatMessages ', this.chatsMessages)
        console.log('loadedMessagesIds ', this.storedMessagesIds)
    }

    async loadChats() {
        this.isLoading = true
        const items = await makeRpcCall('rpcGetChats')
        if (Array.isArray(items)) {
            this.chats = items
        }
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
        console.log('successfully subscribed to chat ', chatId)
        this.currentChatId = chatId
    }
}

decorate(ChatsStore, {
    chats: observable,
    chatsMessages: observable,
    isLoading: observable,
    currentChatId: observable,
    currentChatMessages: computed,
})

export default new ChatsStore()

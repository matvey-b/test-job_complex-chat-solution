import { observable, decorate } from 'mobx'
import { makeRpcCall, socket } from '../io'

class ChatsStore {
    items = []
    isLoading = false
    currentChat = null

    async loadChats() {
        this.isLoading = true
        console.log(this.items)
        const items = await makeRpcCall('rpcGetChats')
        if (Array.isArray(items)) {
            this.items = items
        }
        console.log(this.items)
        this.isLoading = false
    }
}

decorate(ChatsStore, {
    items: observable,
    isLoading: observable,
})

export default new ChatsStore()

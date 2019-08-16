import { observable, decorate, computed } from 'mobx'
import { makeRpcCall, socket } from '../io'

let loadUsersByIdsPromise = null
let loadUsersByIdsNextCallArgs = new Set()
let loadOnlineUsersOfChatPromise = null
class UsersStore {
    constructor() {
        socket.on('UserWasJoinedToChat', userId => {
            console.log('userWaJoinedToChat event', userId)
            this.onlineUsersIds.add(userId)
        })
        socket.on('UserWasLeftTheChat', userId => {
            console.log('userWaLeftTheChat event', userId)
            this.onlineUsersIds.delete(userId)
        })
    }
    // fixme: этот массив полностью перенаполняется пользователями конкретного чата при каждом новом запросе
    // Это сделано для простоты.
    // По хорошему нужно улучшить это. Научить бекенд отдавать только недостающих пользователей и т.п.
    onlineUsersIds = new Set()
    usersMap = new Map()

    get users() {
        return [...this.usersMap.values()]
    }

    /**
     * Отдает загруженных пользователей, ставит недостающим isLoading + ставит задачу на их догрузку
     */
    getUsers(ids) {
        const idsSet = new Set(ids)
        const loadedUsers = this.users.filter(u => idsSet.has(u.id))
        const loadedUsersIds = new Set(loadedUsers.map(u => u.id))
        const notLoadedUsersIds = [...idsSet].filter(id => !loadedUsersIds.has(id))
        if (notLoadedUsersIds.length && !loadUsersByIdsPromise) {
            loadUsersByIdsPromise = this.loadUsersByIds(notLoadedUsersIds)
        }
        return [...loadedUsers, ...notLoadedUsersIds.map(id => ({ id, isLoading: true }))]
    }

    appendUsers(...users) {
        // создаю копию Map, т.к. при каждом usersMap.set вызывается render на реакт компонентах
        const resultMap = new Map(this.usersMap)
        // делаю flatten при помощи concat, потом просто сую всех в Map, дальше он уже сам обеспечит неповторимость
        users.reduce((acc, item) => acc.concat(item), []).forEach(user => resultMap.set(user.id, user))
        // заменяю все разом, при этом вызывается один render на реакт компонентах и все работает гораздо шустрее
        this.usersMap = resultMap
    }

    async loadOnlineUsersOfChat(chatId) {
        if (loadOnlineUsersOfChatPromise) {
            return
        }
        try {
            const res = await makeRpcCall('rpcGetOnlineUsersOfChat', chatId)
            if (res.name === 'Error') {
                const err = new Error(`Cannot load online users of chat.`)
                err.reason = res
                throw err
            }

            this.onlineUsersIds = new Set(res)
        } finally {
            loadOnlineUsersOfChatPromise = null
        }
    }

    async loadUsersByIds(...ids) {
        ids = ids.reduce((acc, val) => acc.concat(val), [])
        if (loadUsersByIdsPromise) {
            loadUsersByIdsNextCallArgs = new Set(...ids, ...loadUsersByIdsNextCallArgs)
            return
        }

        try {
            const res = await makeRpcCall('rpcGetUsers', {
                filter: { ids },
            })
            if (res.name === 'Error') {
                throw new Error(`Cannot load users by ids`)
            }
            res.forEach(u => loadUsersByIdsNextCallArgs.delete(u.id))
            this.appendUsers(res)
        } finally {
            loadUsersByIdsPromise = null
        }

        if (loadUsersByIdsNextCallArgs.size) {
            return this.loadUsersByIds([...loadUsersByIdsNextCallArgs])
        }
    }
}

decorate(UsersStore, {
    onlineUsersIds: observable,
    usersMap: observable,
    users: computed,
})

export default new UsersStore()

import { observable, decorate } from 'mobx'

class UsersStore {
    items = []
}

decorate(UsersStore, {
    items: observable,
})

export default new UsersStore()

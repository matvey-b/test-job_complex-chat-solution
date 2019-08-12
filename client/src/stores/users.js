import { observable, decorate } from 'mobx'

class UsersStore {
    items = []
    me = (localStorage.getItem('user') && JSON.parse(localStorage.getItem('user'))) || null
    myJwt = localStorage.getItem('jwt') || null

    saveSession({ token, user }) {
        localStorage.setItem('jwt', token)
        localStorage.setItem('user', JSON.stringify(user))
        this.me = user
        this.myJwt = token
    }
}

decorate(UsersStore, {
    items: observable,
    me: observable,
    myJwt: observable,
})

export default new UsersStore()

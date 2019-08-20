const knex = require('../utils/knex')
const BaseHandler = require('./base')

class UsersHandlers extends BaseHandler {
    /**
     * Использовать для "догрузки" пользователей.
     * Нужно, чтобы фронтенд мог рендерить связанные данные.
     */
    async rpcGetUsers({ filter = {}, limit }) {
        this.validateAuthorization()
        const query = knex('users')
            .select('id', 'login', 'isAdmin')
            .limit(limit)
        if (filter.ids) {
            query.whereIn('id', filter.ids)
        }
        return query
    }
}

module.exports = UsersHandlers

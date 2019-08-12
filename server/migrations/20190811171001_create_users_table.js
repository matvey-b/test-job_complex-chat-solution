// note: подключаю knex только для того, чтобы работал автокомплит
// eslint-disable-next-line no-unused-vars
const knex = require('../utils/knex')
const uuid = require('uuid/v4')

/**
 * @param {knex} knex
 */
exports.up = async knex => {
    await knex.schema.createTable('users', table => {
        table.uuid('id').primary()
        table
            .string('login')
            .unique()
            .notNullable()
        table.string('password').notNullable()
        table.dateTime('createdAt').notNullable()
    })

    await knex('users').insert({
        id: uuid(),
        login: 'admin',
        password: 'asldfkjj',
        createdAt: new Date(),
    })
}

/**
 * @param {knex} knex
 */
exports.down = async knex => knex.schema.dropTable('users')

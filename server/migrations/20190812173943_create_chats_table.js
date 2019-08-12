// note: подключаю knex только для того, чтобы работал автокомплит
// eslint-disable-next-line no-unused-vars
const knex = require('../utils/knex')
const uuid = require('uuid/v4')

/**
 * @param {knex} knex
 */
exports.up = async knex => {
    await knex.schema.createTable('chats', table => {
        table.uuid('id').primary()
        table
            .string('name')
            .notNullable()
            .unique()
        // id создателя чата. Только он может удалить или переименовать чат.
        table.uuid('ownerId').notNullable()
        table.dateTime('createdAt').notNullable()
        table
            .foreign('ownerId')
            .references('users.id')
            .onUpdate('CASCADE')
            .onDelete('CASCADE')
    })
    const admin = await knex('users')
        .first()
        .where({ login: 'admin' })
    await knex('chats').insert({
        id: uuid(),
        name: 'General',
        ownerId: admin.id,
        createdAt: new Date(),
    })
}

/**
 * @param {knex} knex
 */
exports.down = async knex => {
    await knex.schema.dropTable('chats')
}

// note: подключаю knex только для того, чтобы работал автокомплит
// eslint-disable-next-line no-unused-vars
const knex = require('../utils/knex')

/**
 * @param {knex} knex
 */
exports.up = async knex => {
    await knex.schema.createTable('chat_messages', table => {
        table.bigIncrements('id').primary()
        table.uuid('chatId').notNullable()
        table.text('text').notNullable()
        table.dateTime('createdAt').notNullable()
        table.uuid('authorId').notNullable()
        table
            .foreign('authorId')
            .references('users.id')
            .onDelete('cascade')
            .onUpdate('cascade')
        table
            .foreign('chatId')
            .references('chats.id')
            .onDelete('cascade')
            .onUpdate('cascade')
    })
}

/**
 * @param {knex} knex
 */
exports.down = async knex => {
    await knex.schema.dropTable('chat_messages')
}

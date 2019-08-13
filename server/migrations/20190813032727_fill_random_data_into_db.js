// note: подключаю knex только для того, чтобы работал автокомплит
const _ = require('lodash')
// eslint-disable-next-line no-unused-vars
const knex = require('../utils/knex')
const chance = require('../tests/chance')

const users = _.times(10, () => chance.user())
const chats = users.map(({ id }) => chance.chat({ ownerId: id }))
const messages = _(_.times(300, () => chance.natural({ min: 1, max: 999999 })))
    .uniq()
    .map(id => chance.message({ id, authorId: _.sample(users).id, chatId: _.sample(chats).id }))
    .value()

/**
 * @param {knex} knex
 */
exports.up = async knex => {
    await knex('users').insert(users)
    await knex('chats').insert(chats)
    await knex('chat_messages').insert(messages)
}

/**
 * @param {knex} knex
 */
exports.down = async knex => {}

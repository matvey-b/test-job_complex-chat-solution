// note: подключаю knex только для того, чтобы работал автокомплит
const _ = require('lodash')
// eslint-disable-next-line no-unused-vars
const knex = require('../utils/knex')
const chance = require('../tests/chance')

const users = _.times(10, () => chance.user())
const chats = users.map(({ id }) => chance.chat({ ownerId: id }))
let createdAt = Date.now()
const messages = _(new Array(300).fill(null))
    .map(() =>
        chance.message({
            authorId: _.sample(users).id,
            chatId: _.sample(chats).id,
            createdAt: new Date((createdAt += 60000)),
        }),
    )
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

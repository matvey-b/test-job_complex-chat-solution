const _ = require('lodash')
const Chance = require('chance')

const chance = Chance()

chance.mixin({
    chat(params) {
        return {
            id: chance.guid(),
            ownerId: chance.guid(),
            name: _.capitalize(chance.word()),
            createdAt: chance.date(),
            ...params,
        }
    },

    user(params) {
        return {
            id: chance.guid(),
            login: chance.first().toLowerCase(),
            createdAt: chance.date(),
            password: chance.string({ length: 10 }),
            ...params,
        }
    },

    message(params) {
        return {
            id: chance.natural({ min: 1, max: 999999 }),
            chatId: chance.guid(),
            authorId: chance.guid(),
            text: chance.sentence(),
            createdAt: chance.date(),
            ...params,
        }
    },
})

module.exports = chance

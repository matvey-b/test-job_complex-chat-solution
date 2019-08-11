const knex = require('knex')
const config = require('./config-loader')

// note: это необязательно, т.к. конфиг уже скорее всего выгружен в process.env, но на всякий пожарный, на случай если где-то будет просто использоваться этот модуль
config.load()

module.exports = knex({ client: 'mysql', connection: process.env.DB })

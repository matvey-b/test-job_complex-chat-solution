const knex = require('knex')

console.log('knex.js', process.env.MYSQL_HOST)
module.exports = knex({
    client: 'mysql',
    connection: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        port: process.env.MYSQL_PORT,
        database: process.env.MYSQL_DATABASE,
    },
})

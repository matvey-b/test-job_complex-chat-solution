require('dotenv').config()

console.log('knexfile', process.env.MYSQL_HOST)
module.exports = {
    [process.env.NODE_ENV]: {
        client: 'mysql',
        connection: {
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            port: process.env.MYSQL_PORT,
            database: process.env.MYSQL_DATABASE,
        },
        migrations: { stub: 'migrations/stub.js' },
    },
}

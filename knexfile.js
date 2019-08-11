// Update with your config settings.
const config = require('./utils/config-loader')
config.load()

module.exports = {
    [process.env.NODE_ENV]: {
        client: 'mysql',
        connection: process.env.DB,
        migrations: { stub: 'migrations/stub.js' },
    },
}

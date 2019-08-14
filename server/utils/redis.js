const Redis = require('ioredis')
const config = require('./config-loader')

module.exports = new Redis({ ...config.load().redis })

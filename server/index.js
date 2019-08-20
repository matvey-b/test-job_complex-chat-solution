require('dotenv').config()
const _ = require('lodash')
const httpServer = require('http').createServer()
const io = require('socket.io')(httpServer)
const BaseHandler = require('./handlers/base')
const adapter = require('socket.io-redis')

io.adapter(adapter({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT }))

console.log(`Starting server...`)

io.on('connection', async function(socket) {
    console.log(`New socket connected. Count of connected sockets: ${Object.keys(io.sockets.sockets).length}`)
    socket.on('disconnect', reason => {
        console.log(
            `Socket was disconnected by reason: "${reason}. User: ${_.get(
                socket.ctx,
                'user.id',
                'UNKNOWN',
            )}. Count of connected sockets: ${Object.keys(io.sockets.sockets).length}`,
        )
    })
    await BaseHandler.attachHandlers(socket)
})

httpServer.listen({ host: '0.0.0.0', port: process.env.API_INTERNAL_HTTP_PORT }, () =>
    console.log(`Server listening on ${JSON.stringify(httpServer.address())}...`),
)

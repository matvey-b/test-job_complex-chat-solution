const _ = require('lodash')
const config = require('./utils/config-loader')
const httpServer = require('http').createServer()
const io = require('socket.io')(httpServer)
const authHandler = require('./handlers/auth')
const chatsHandlers = require('./handlers/chats')

console.log(`Starting server...`)

config.load()

io.on('connection', function(socket) {
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
    authHandler.attach(socket)
    chatsHandlers.attach(socket)
})

httpServer.listen({ host: '0.0.0.0', port: process.env.HTTP_PORT }, () =>
    console.log(`Server listening on ${httpServer.address().port}...`),
)

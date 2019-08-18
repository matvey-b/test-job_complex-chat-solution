require('dotenv').config()
const _ = require('lodash')
const httpServer = require('http').createServer()
const io = require('socket.io')(httpServer)
const authHandler = require('./handlers/auth')
const chatsHandlers = require('./handlers/chats')
const usersHandlers = require('./handlers/users')

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
    authHandler.attach(socket)
    chatsHandlers.attach(socket)
    usersHandlers.attach(socket)
})

httpServer.listen({ host: '0.0.0.0', port: process.env.HTTP_PORT }, () =>
    console.log(`Server listening on ${JSON.stringify(httpServer.address())}...`),
)

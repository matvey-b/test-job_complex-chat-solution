const config = require('./utils/config-loader')
const httpServer = require('http').createServer()
const io = require('socket.io')(httpServer)
const authHandler = require('./handlers/auth')

console.log(`Starting server...`)

config.load()

io.on('connection', function(socket) {
    authHandler.attach(socket)
})

setInterval(() => {
    console.log(Object.keys(io.clients().sockets).length)
}, 1000)

httpServer.listen({ host: '0.0.0.0', port: process.env.HTTP_PORT }, () =>
    console.log(`Server listening on ${httpServer.address().port}...`),
)

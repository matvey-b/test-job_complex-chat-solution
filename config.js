module.exports = {
    httpPort: 8080,
    nodeEnv: 'dev',
    db: {
        dev: {
            host: 'localhost',
            database: 'chat-on-ws',
            user: 'neuron',
            password: 'neuron',
        },
        tests: {},
        production: {},
    },
}

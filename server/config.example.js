/**
 * note: все эти параметры транслируются в UPPER_SNAKE_CASE и сохраняются в process.env.
 * Вы можете переопределить их путем установки соответствующих переменных окружения
 * Некоторые параметры, например db, сериализуются в строку по особым правилам. См в модуле config-loader
 */
module.exports = {
    httpPort: 8080,
    nodeEnv: 'dev', // для развертки в проде использовать значение "production"
    db: {
        // выбирается конфиг в соответствии с NODE_ENV
        dev: {
            host: 'mysql',
            database: 'chat',
            user: 'chat',
            password: 'chat',
        },
        tests: {},
        production: {},
    },
    redis: {
        dev: {
            host: 'redis',
            port: 6379,
            db: 0,
        },
        tests: {},
        production: {},
    },
}

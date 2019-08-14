const _ = require('lodash')

let parsedConfig = null
/* 
Загрузить конфиг в process.env
*/
module.exports.load = () => {
    if (parsedConfig) {
        return parsedConfig
    }
    try {
        const rawConfig = require('../config')
        const config = validateAndPrepareConfigParams(rawConfig)
        assignConfigToEnv(config)
        return (parsedConfig = config)
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error(
                `Cannot find config file. Please copy 'config.example.json' to 'config.json' and then try again.`,
            )
        }
        throw error
    }
}

/* 
В большинстве случаев бывает полезно проверить и подправить конфиг если нужно.
В данном случае, это просто заглушка, которая должна навести комрадов на верный путь.
*/
const validateAndPrepareConfigParams = config => {
    const env = process.env.NODE_ENV || config.nodeEnv
    _(config).forEach((val, key) => {
        if (val[env]) {
            config[key] = val[env]
        }
    })

    const { db } = config
    if (!db) {
        throw new Error(`Cannot find db config for '${env}' env. Please put config params into 'config.js:db.${env}'`)
    }
    config.db = `mysql://${db.user}:${db.password}@${db.host}${db.port ? ':' + db.port : ''}/${db.database}`

    return config
}

/**
 * Проходит по конфигу и привязывает параметры в UPPER_SNAKE_CASE формате.
 * Если параметры определены на уровне окружения (например так: 'export HTTP_PORT = 3128'), то они получают повышенный приоритет и не перезаписываются значением из конфига
 */
const assignConfigToEnv = config =>
    _(config).forEach((val, key) => {
        if (val && !_.isObject(val)) {
            const formattedKey = _(key)
                .chain()
                .snakeCase()
                .toUpper()
                .value()
            if (!process.env[formattedKey]) {
                process.env[formattedKey] = val
            }
        }
    })

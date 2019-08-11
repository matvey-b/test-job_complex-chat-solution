const _ = require('lodash')

/* 
Загрузить конфиг в process.env
*/
module.exports.load = () => {
    try {
        const rawConfig = require('../config.json')
        const config = validateAndPrepareConfigParams(rawConfig)
        assignConfigToEnv(config)
        return config
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
const validateAndPrepareConfigParams = config => config

const assignConfigToEnv = config =>
    _(config).forEach((val, key) => {
        process.env[
            _(key)
                .chain()
                .snakeCase()
                .toUpper()
                .value()
        ] = val
    })

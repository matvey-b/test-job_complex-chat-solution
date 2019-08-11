const jwt = require('jsonwebtoken')

const TOKEN_LIFE_TIME = 3600 * 24 // 1h, number needs for tests

const JWT_SALT = 'g9GDXQMKCY0g'

module.exports = {
    TOKEN_LIFE_TIME,

    sign: async user =>
        new Promise((resolve, reject) =>
            jwt.sign({ userId: user.id }, JWT_SALT, { expiresIn: TOKEN_LIFE_TIME }, (err, token) =>
                err ? reject(err) : resolve(token),
            ),
        ),

    verify: async token =>
        new Promise((resolve, reject) =>
            jwt.verify(token, JWT_SALT, (err, decoded) => (err ? reject(err) : resolve(decoded))),
        )
            // note: добавляем оставшееся время до устаревания токена, нужно для установки таймеров
            .then(res => Object.assign(res, { timeToExpiration: res.exp * 1000 - Date.now() })),

    decode: token => {
        const res = jwt.decode(token)
        return Object.assign(res, { timeToExpiration: res.exp * 1000 - Date.now() })
    },
}

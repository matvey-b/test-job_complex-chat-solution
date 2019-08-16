const _ = require('lodash')
const pMap = require('p-map')
const { expect, wait } = require('./utils')
const jwt = require('../utils/jwt')

describe('JWT utils tests', function() {
    it('sign and validate should work as expected', async function() {
        const user = { id: 'asldfkj' }
        const token = await jwt.sign(user)
        const actual = await jwt.verify(token)
        expect(actual).to.have.property('userId')
        expect(actual)
            .to.have.property('exp')
            .greaterThan((Date.now() + jwt.TOKEN_LIFE_TIME * 1000 - 1000) / 1000)
            .lessThan((Date.now() + jwt.TOKEN_LIFE_TIME * 1000 + 1000) / 1000)
        expect(actual)
            .to.have.property('timeToExpiration')
            .greaterThan(jwt.TOKEN_LIFE_TIME * 1000 - 1000)
            .lessThan(jwt.TOKEN_LIFE_TIME * 1000 + 1000)
    })

    it('decode should work as expected', async function() {
        const user = { id: 'asldfkj' }
        const token = await jwt.sign(user)
        const actual = jwt.decode(token)
        expect(actual).to.have.property('userId')
        expect(actual)
            .to.have.property('exp')
            .greaterThan((Date.now() + jwt.TOKEN_LIFE_TIME * 1000 - 1000) / 1000)
            .lessThan((Date.now() + jwt.TOKEN_LIFE_TIME * 1000 + 1000) / 1000)
        expect(actual)
            .to.have.property('timeToExpiration')
            .greaterThan(jwt.TOKEN_LIFE_TIME * 1000 - 1000)
            .lessThan(jwt.TOKEN_LIFE_TIME * 1000 + 1000)
    })
})

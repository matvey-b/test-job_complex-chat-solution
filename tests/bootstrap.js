/* eslint-disable mocha/no-hooks-for-single-case */
/* eslint-disable mocha/no-top-level-hooks */

const config = require('../utils/config-loader')

before('before all tests', async function() {
    await config.load()
})

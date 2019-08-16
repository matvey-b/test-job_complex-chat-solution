const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

module.exports.chai = chai
module.exports.expect = chai.expect
module.exports.chance = require('./chance')
module.exports.wait = ms => new Promise(resolve => setTimeout(() => resolve(), ms))

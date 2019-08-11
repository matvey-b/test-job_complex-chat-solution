const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

module.exports.chai = chai
module.exports.expect = chai.expect

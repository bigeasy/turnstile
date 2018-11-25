var Turnstile = { Set: require('./set') }
var operation = require('operation')

function Check () {
    var vargs = operation.vargs.apply(operation, arguments)
    this._operation = vargs.shift()
    this._set = new Turnstile.Set(this, '_check', vargs.shift())
    this.turnstile = this._set.turnstile
}

Check.prototype._check = function (envelope, callback) {
    envelope.body = null
    this._operation(envelope, callback)
}

Check.prototype.check = function (callback) {
    this._set.add('check', callback)
}

module.exports = Check

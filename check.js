var Turnstile = { Set: require('./set') }
var Operation = require('operation/variadic')

function Check () {
    var vargs = Array.prototype.slice.call(arguments)
    this._operation = Operation(vargs)
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

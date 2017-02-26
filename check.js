var Turnstile = { Set: require('./set') }
var Operation = require('operation/redux')

function Check (operation, options) {
    this._set = new Turnstile.Set({ object: this, method: '_check' }, options)
    this._operation = Operation(operation)
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

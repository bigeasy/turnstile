var Operation = require('operation/redux')
var Turnstile = require('./redux')

function Set (operation, options) {
    this._operation = Operation(operation)
    this._sets = {}
    this.turnstile = new Turnstile({ object: this, method: '_pop' }, options)
}

Set.prototype._pop = function (envelope, callback) {
    delete this._sets[envelope.body]
    this._operation(envelope, callback)
}

Set.prototype._callback = function (key, callback) {
    if (callback != null) {
        this._sets[key].callbacks.push(callback)
    }
}

Set.prototype.add = function (key, callback) {
    var set = this._sets[key]
    if (set == null) {
        set = this._sets[key] = {
            key: key,
            callbacks: []
        }
        this._callback(key, callback)
        this.turnstile.enqueue(key, function () {
            var vargs = Array.prototype.slice.call(arguments)
            set.callbacks.forEach(function (callback) {
                callback.apply(null, vargs)
            })
        })
    } else {
        this._callback(key, callback)
    }
}

module.exports = Set

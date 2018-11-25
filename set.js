var coalesce = require('extant')
var operation = require('operation')

function Set () {
    var vargs = operation.vargs.apply(operation, arguments)
    this._operation = vargs.shift()
    this.turnstile = vargs.shift()
    this._sets = {}
}

Set.prototype._pop = function (envelope, callback) {
    delete this._sets[envelope.body]
    this._operation.call(null, envelope, callback)
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
        this.turnstile.enter({
            object: this,
            method: this._pop,
            body: key,
            completed: function () {
                var vargs = Array.prototype.slice.call(arguments)
                set.callbacks.forEach(function (callback) {
                    callback.apply(null, vargs)
                })
            }
        })
    } else {
        this._callback(key, callback)
    }
}

module.exports = Set

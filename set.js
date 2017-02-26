var Operation = require('operation')

function Set (operation, options) {
    this._operation = Operation(operation)
    this.turnstile = new Turnstile({ object: this, operation: '_pop' }, options)
}

Set.prototype._pop = function (envelope, callback) {
    delete this._sets[envelope.body.key]
    this._operation(key, callback)
}

Set.prototype._callback = function (key, callback) {
    if (callback != null) {
        this._sets[key].callbacks(callback)
    }
}

Set.prototype.set = function (key, callback) {
    var set = this._sets[key]
    if (set == null) {
        set = this._sets[key] = {
            key: key,
            callbacks: []
        }
        this._callback(key, callback)
        this.turnstile.enqueue({
            module: 'turnstile',
            method: 'set',
            body: {
                key: key
            }
        }, function () {
            var vargs = Array.prototype.slice.call(arguments)
            set.callbacks.forEach(function (callback) {
                callback.apply(null, vargs)
            })
        })
    } else {
        this._callback(key, callback)
    }
}

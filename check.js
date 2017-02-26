function Check (operation, options) {
    this._set = new Set({ object: this, operation: '_check' })
    this._operation = Operation(operation)
    this.turnstile = new Turnstile({
        object: this, mehtod: '_pop'
    }, options)
}

Set.prototype._check = function (envelope, callback) {
    this._operation({
        module: 'turnstile',
        method: 'check',
        when: envelope.when,
        timedout: envelope.timedout
    }, callback)
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

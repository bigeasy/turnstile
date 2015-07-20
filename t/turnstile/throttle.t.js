require('proof')(1, require('cadence/redux')(prove))

function prove (async, assert) {
    var turnstile = require('../../sketch'),
        abend = require('abend')

    function Service () {
        this._turnstile = new turnstile.Turnstile
    }

    Service.prototype.immediate = turnstile.method(function (value, callback) {
        callback(null, value)
    })

    Service.prototype.delayed = turnstile.method(function (value, callback) {
        setImmediate(callback, null, value)
    })

    Service.prototype.error = turnstile.method(function (value, callback) {
        throw new Error('thrown')
    })

    var service = new Service

    async(function () {
        service.delayed(1, async())
        service.delayed(2, async())
        service.immediate(3, async())
    }, function (one, two, three) {
        assert([ one, two, three ], [ 1, 2, 3 ], 'service')
    }, function () {
        service.error(function () {})
    })
}

require('proof/redux')(2, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('..')
    Turnstile.Check = require('../check')
    var object = {
        method: function (envelope, callback) {
            assert(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 0,
                timedout: false,
                body: null,
            }, 'check')
            callback(null, 1)
        }
    }
    var turnstile = new Turnstile({
        Date: { now: function () { return 0 } }
    })
    var check = new Turnstile.Check(object, 'method', turnstile)
    async(function () {
        check.check(async())
    }, function (result) {
        assert(result, 1, 'checked')
    })
}

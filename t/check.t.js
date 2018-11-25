require('proof')(2, require('cadence')(prove))

function prove (async, okay) {
    var Turnstile = require('..')
    Turnstile.Check = require('../check')
    var object = {
        method: function (envelope, callback) {
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 0,
                timedout: false,
                body: null,
                error: null
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
        okay(result, 1, 'checked')
    })
}

require('proof')(2, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('..')
    Turnstile.Set = require('../set')

    var object = {
        method: function (envelope, callback) {
            assert(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 0,
                timedout: false,
                body: 'a'
            }, 'key')
            callback(null, 1)
        }
    }

    var turnstile = new Turnstile({ Date: { now: function () { return 0 } } })
    var set = new Turnstile.Set(object, 'method', turnstile)

    async(function () {
        set.add('a')
        set.add('a', async())
    }, function (result) {
        assert(result, 1, 'called')
    })
}

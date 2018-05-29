require('proof')(3, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('../redux')
    Turnstile.Set = require('../set')

    var expect = [{
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 'a',
            error: null
        },
        message: 'key'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 'b',
            error: null
        },
        message: 'doubled'
    }]

    var object = {
        method: function (envelope, callback) {
            var expected = expect.shift()
            assert(envelope, expected.envelope, expected.message)
            setImmediate(callback, null, 1)
        }
    }

    var turnstile = new Turnstile({ Date: { now: function () { return 0 } } })
    var set = new Turnstile.Set(object, 'method', turnstile)

    async(function () {
        set.add('a')
        set.add('b')
        set.add('b', async())
    }, function (result) {
        assert(result, 1, 'called')
    })
}

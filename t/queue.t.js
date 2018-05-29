require('proof')(3, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('..')
    Turnstile.Queue = require('../queue')

    var expect = [{
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 1,
            error: null
        },
        message: 'push'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 2,
            error: null
        },
        message: 'enqueue'
    }]
    var object = {
        method: function (envelope, callback) {
            var expected = expect.shift()
            assert(envelope, expected.envelope, expected.message)
            callback(null, envelope.body)
        }
    }

    var turnstile = new Turnstile({ Date: { now: function () { return 0 } } })
    var queue = new Turnstile.Queue(object, 'method', turnstile)

    async(function () {
        queue.push(1)
        queue.enqueue(2, async())
        queue.wait(async())
    }, function (result) {
        assert(result, 2, 'returned')
    })
}

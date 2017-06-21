require('proof')(7, require('cadence')(prove))

function prove (async, assert) {
    var abend = require('abend')
    var Turnstile = require('../redux')
    var Operation = require('operation/variadic')
    var expectations = [{
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 1
        },
        message: 'push'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 2
        },
        message: 'enqueue'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 4
        },
        message: 'did not timeout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 1,
            timedout: true,
            body: 5
        },
        message: 'timedout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 1,
            waited: 0,
            timedout: false,
            body: 6
        },
        message: 'resume after timeout'
    }]
    var object = {
        method: function (envelope, callback) {
            var expected = expectations.shift()
            assert(envelope, expected.envelope, expected.message)
            callback.apply(null, expected.vargs || [])
        }
    }
    var turnstile = new Turnstile
    assert({
        timeout: turnstile.timeout,
        health: turnstile.health
    }, {
        timeout: Infinity,
        health: {
            occupied: 0, waiting: 0, rejecting: 0, turnstiles: 1
        }
    }, 'defaults')
    turnstile.reconfigure({ timeout: 1, turnstiles: 2 })
    assert({
        timeout: turnstile.timeout,
        health: turnstile.health
    }, {
        timeout: 1,
        health: {
            occupied: 0, waiting: 0, rejecting: 0, turnstiles: 2
        }
    }, 'reconfigure')
    var now = 0
    var turnstile = new Turnstile({
        Date: { now: function () { return now } },
        timeout: 1
    }, function () { return abend })
    async(function () {
        turnstile.enter({
            object: object,
            method: object.method,
            body: 1
        })
        turnstile.enter({
            object: object,
            method: object.method,
            completed: async(),
            body: 2
        })
        turnstile.enter({
            checkpoint: true,
            completed: async()
        })
    }, function () {
        var wait = null
        turnstile.enter({               // starts loop
            object: object,
            method: function (envelope, callback) {
                wait = [ envelope, callback ]
            },
            completed: async(),
            body: 4
        })
        turnstile.enter({               // waits on queue
            object: object,
            method: object.method,
            completed: async(),
            body: 5
        })
        now++
        turnstile.enter({               // sees that waiting has expired, starts rejector
            object: object,
            method: object.method,
            completed: async(),
            body: 6
        })
        object.method.apply(object, wait)
    })
}

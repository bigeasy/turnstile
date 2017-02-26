require('proof/redux')(9, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('../redux')
    var expectations = [{
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            timedout: false,
            body: 1
        },
        message: 'push'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            timedout: false,
            body: 2
        },
        message: 'enqueue'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            timedout: false,
            body: 3
        },
        message: 'error',
        vargs: [ new Error('thrown') ]
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            timedout: true,
            body: 4
        },
        message: 'did not timeout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            timedout: true,
            body: 5
        },
        message: 'enqueue'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 1,
            timedout: false,
            body: 6
        },
        message: 'enqueue'
    }]
    var object = {
        method: function (envelope, callback) {
            var expected = expectations.shift()
            assert(envelope, expected.envelope, expected.message)
            callback.apply(null, expected.vargs || [])
        }
    }
    var turnstile = new Turnstile({ object: object, method: 'method' })
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
        object: object, method: 'method'
    }, {
        Date: { now: function () { return now } },
        timeout: 1
    })
    async(function () {
        turnstile.push(1)
        turnstile.enqueue(2, async())
    }, [function () {
        turnstile.enqueue(3, async())
    }, function (error) {
        assert(error.message, 'thrown', 'caught')
    }], function () {
        turnstile.enqueue(4, async())   // starts loop
        turnstile.enqueue(5, async())   // waits on queue
        now++
        turnstile.enqueue(6, async())   // sees that waiting has expired, starts rejector
    })
}

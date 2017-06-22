require('proof')(10, require('cadence')(prove))

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
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 0,
            timedout: false,
            body: 4,
            error: null
        },
        message: 'did not timeout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 0,
            waited: 1,
            timedout: true,
            body: 5,
            error: null
        },
        message: 'timedout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 1,
            waited: 0,
            timedout: false,
            body: 6,
            error: null
        },
        message: 'resume after timeout'
    }, {
        envelope: {
            module: 'turnstile',
            method: 'enter',
            when: 1,
            waited: 0,
            timedout: false,
            body: 7,
            error: null
        },
        message: 'thrown',
        vargs: [ new Error('thrown') ]
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
    }, [function () {
        // TODO When you error and you've passed a completed method, what does
        // the completed method return? It can't return an error because we
        // don't want to push errors back through the queue.
        turnstile.listen(async())
        turnstile.enter({
            object: object,
            method: object.method,
            body: 7
        })
    }, function (error) {
        assert(/^turnstile#exception$/m.test(error.message), 'caught')
        turnstile.drain(function (task) {
            assert(task.error.message, 'thrown', 'drained')
        })
    }])
}

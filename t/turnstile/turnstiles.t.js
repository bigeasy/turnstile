require('proof')(5, require('cadence')(prove))

function prove (async, assert) {
    var abend = require('abend')
    var wait
    var object = {
        block: function (state, value, callback) {
            wait = callback
        },
        goodness: function (state, value, callback) {
            setImmediate(callback, null, value * 2)
        },
        badness: function (state, value, callback) {
            callback(new Error('badness'))
        },
        timedout: function (state, value, callback) {
            callback(null, state.timedout)
        }
    }
    var Turnstiles = require('../..')
    var turnstiles = new Turnstiles, now = 0
    assert(turnstiles.health.turnstiles, 1, 'default constructor')
    turnstiles = new Turnstiles({
        timeout: 1,
        Date: {
            now: function () {
                return now
            }
        }
    })
    turnstiles.reconfigure({ turnstiles: 1, timeout: 0 })
    turnstiles.reconfigure({ turnstiles: 1, timeout: 1 })
    turnstiles.reconfigure({})
    assert(turnstiles.health, { occupied: 0, waiting: 0, rejecting: 0, turnstiles: 1 }, 'health')
    async(function () {
        turnstiles.enter({ object: object, method: 'goodness' }, [ 1 ], async())
        turnstiles.nudge(async())
    }, function (result) {
        assert(result, 2, 'result')
        async([function () {
            turnstiles.enter({ object: object, method: 'badness' }, [ 1 ], async())
        }, function (error) {
            assert(error.message, 'badness', 'catch error')
        }])
        async(function () {
            turnstiles.nudge(async())
        })
    }, function (result) {
        turnstiles.enter({ object: object, method: 'timedout' }, [ 1 ], async())
        turnstiles.nudge(async())
        turnstiles.enter({ object: object, method: 'timedout' }, [ 1 ], async())
        now = 3
        turnstiles.nudge(async())
        turnstiles.enter({ object: object, method: 'timedout' }, [ 1 ], async())
        turnstiles.nudge(async())
    }, function (timedout1, timedout2, completed) {
        assert([ timedout1, timedout2, completed ], [ true, true, false ], 'timedout')
    })
}

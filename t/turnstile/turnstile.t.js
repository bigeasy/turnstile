require('proof')(4, require('cadence')(prove))

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
    var Turnstile = require('../..')
    var turnstile = new Turnstile, now = 0
    assert(turnstile.workers, 1, 'default constructor')
    turnstile = new Turnstile({
        timeout: 1,
        _Date: {
            now: function () {
                return now
            }
        }
    })
    async(function () {
        turnstile.enter({ object: object, method: 'goodness' }, [ 1 ], async())
        turnstile.nudge(async())
    }, function (result) {
        assert(result, 2, 'result')
        async([function () {
            turnstile.enter({ object: object, method: 'badness' }, [ 1 ], async())
        }, function (error) {
            assert(error.message, 'badness', 'catch error')
        }])
        async(function () {
            turnstile.nudge(async())
        })
    }, function (result) {
        turnstile.enter({ object: object, method: 'timedout' }, [ 1 ], async())
        now = 3
        turnstile.enter({ object: object, method: 'timedout' }, [ 1 ], async())
        turnstile.nudge(async())
    }, function (timedout, completed) {
        assert([ timedout, completed ], [ true, false ], 'timedout')
    })
}

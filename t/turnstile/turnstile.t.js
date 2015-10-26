require('proof')(6, require('cadence')(prove))

function prove (async, assert) {
    var abend = require('abend')
    var wait
    var object = {
        block: function (state, value, callback) {
            wait = callback
        },
        goodness: function (state, value, callback) {
            callback(null, value * 2)
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
        var done = async()
        turnstile.enter(object, object.goodness, [ 1 ], function (error, result) {
            assert(result, 2, 'result')
        })
        turnstile.nudge(abend)
        turnstile.enter(object, object.badness, [ 1 ], function (error) {
            assert(error.message, 'badness', 'catch error')
            done()
        })
        turnstile.nudge(abend)
    }, function () {
        var done = async(), count = 0
        turnstile.enter(object, object.goodness, [ 1 ], function (error, result) {
            assert(result, 'timedout')
            if (++count == 3) done()
        })
        turnstile.nudge(abend)
        turnstile.enter(object, object.timedout, [ 1 ], function (error, result) {
            assert(result, 'timedout')
            if (++count == 3) done()
        })
        turnstile.nudge(abend)
        now = 1
        turnstile.enter(object, object.goodness, [ 1 ], function (error, result) {
            assert(result, 2, 'did not timeout')
            if (++count == 3) done()
        })
        now = 2
        turnstile.nudge(abend)
    })
}

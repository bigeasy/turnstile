require('proof')(2, prove)

function prove (assert) {
    var results = [], pause, count = 2
    var turnstile = require('../..')(function () {
        return count != 0 ? count-- : null
    }, function (value, callback) {
        if (!pause) {
            pause = function () { callback(null, value) }
        } else {
            callback(null, value)
        }
    }, function (error, result) {
        results.push(result)
    })
    turnstile.nudge()
    turnstile.nudge()
    pause()
    assert(results, [ 2, 1 ], 'completed')
    var turnstile = require('../..')(function () {
        return 1
    }, function (value, callback) {
        callback(new Error('thrown'))
    })
    try {
        turnstile.nudge()
    } catch (e) {
        assert(e.message, 'thrown', 'uncaught exception')
    }
}

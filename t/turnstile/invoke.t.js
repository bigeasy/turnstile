require('proof')(1, function (step, assert) {
    var results = [], pause
    var turnstile = require('../..')(function (callback) {
        if (!pause) {
            pause = callback
        } else {
            callback(null, 2)
        }
    }, function (error, result) {
        results.push(result)
    })
    turnstile()
    turnstile()
    turnstile()
    pause(null, 1)
    assert(results, [ 1, 2 ], 'completed')
})

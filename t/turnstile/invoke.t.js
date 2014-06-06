require('proof')(2, function (step, assert) {
    var results = [], pause
    var turnstile = require('../..')(function () {
        return 0
    }, function (value, callback) {
        if (!pause) {
            pause = callback
        } else {
            callback(null, 2)
        }
    }, function (error, result) {
        results.push(result)
    })
    turnstile(function (error, result) {
        assert(result, 1, 'waited')
    })
    turnstile()
    turnstile()
    pause(null, 1)
    assert(results, [ 1, 2 ], 'completed')
})

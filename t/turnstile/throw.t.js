require('proof')(1, function (step, assert) {
    var results = [], pause
    var turnstile = require('../..')(function (callback) {
        throw new Error('abend')
    }, function (error) {
        assert(error.message, 'abend', 'caught')
    })
    turnstile()
})

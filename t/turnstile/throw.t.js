require('proof')(2, function (step, assert) {
    var results = [], turnstile
    turnstile = require('../..')(function () {
        return 0
    }, function (value, callback) {
        throw new Error('abend')
    }, function (error) {
        assert(error.message, 'abend', 'caught')
    })
    turnstile()
    turnstile = require('../..')(function () {
        return 0
    }, function (value, callback) {
        callback(new Error('abend'))
    })
    try {
        turnstile(function (error) {
            throw error
        })
    } catch (error) {
        assert(error.message, 'abend', 'uncaught')
    }
})

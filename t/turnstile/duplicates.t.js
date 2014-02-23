require('proof')(1, function (step, equal) {
    var Turnstile = require('../..')
    var callback
    var turnstile = new Turnstile({
        error: function (error, object, method) {
            throw error
        }
    })
    var worker = {
        work: function (callback) { callback(null, 1) }
    }
    turnstile._pause = function (callback) {
        turnstile.enter('work', worker, 'work')
        callback()
    }
    step(function () {
        turnstile.enter('work', worker, 'work')(step())
    }, function (value) {
        equal(value, 1, 'worked')
    })
})

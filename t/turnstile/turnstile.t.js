require('proof')(3, require('cadence')(prove))

function prove (async, assert) {
    var abend = require('abend')
    var object = {
        goodness: function (value, callback) {
            callback(null, value * 2)
        },
        badness: function (value, callback) {
            callback(new Error('badness'))
        }
    }
    var Turnstile = require('../..')
    var turnstile = new Turnstile
    assert(turnstile.workers, 1, 'default constructor')
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
    })
}

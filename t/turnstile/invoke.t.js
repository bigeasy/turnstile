require('proof')(4, function (step, ok, equal) {
    var Turnstile = require('../..')
    var callback
    var turnstile = new Turnstile({
        error: function (error, object, method) {
            throw error
        }
    })
    var object = {
        echo: function (value, callback) {
            callback(null, value)
        }
    }
    step(function () {
        turnstile.enter(object, 'echo', 1)(step())
    }, function (value) {
        equal(value, 1, 'method echoed')
    }, function () {
        turnstile.enter(object.echo, 1)(step())
    }, function (value) {
        equal(value, 1, 'function echoed')
    }, function () {
        turnstile.enter('echo', object.echo, 1)(step())
        turnstile.once('echo', step(-1))
    }, function (value) {
        equal(value, 1, 'event echoed')
    }, function () {
        turnstile.enter('echo', object.echo, 1)
        turnstile.once('empty', step(-1))
    }, function () {
        ok(1, 'done')
    })
})

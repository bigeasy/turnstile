require('proof')(12, prove)

function prove (okay) {
    var Turnstile = require('..')
    var now = 0
    var turnstile = new Turnstile({
        Date: { now: function () { return now } },
        timeout: 1
    })
    turnstile.listen(function (error) {
        okay(arguments.length, 0, 'okay exit')
    })
    okay(turnstile.health, {
        occupied: 0, waiting: 0, rejecting: 0, turnstiles: 1
    }, 'health')
    var wait
    turnstile.enter({
        body: 0,
        method: function (envelope, callback) {
            console.log(envelope)
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 0,
                timedout: false,
                canceled: false,
                body: 0
            }, 'entered')
            wait = callback
        },
        completed: function (error, value) {
            okay({
                error: error,
                value: value
            }, {
                error: null,
                value: 1
            }, 'completed')
        }
    })
    turnstile.enter({
        body: 1,
        method: function (envelope, callback) {
            console.log(envelope)
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 2,
                timedout: true,
                canceled: true,
                body: 1
            }, 'timed out')
            callback(null, 0)
        },
        completed: function (error, value) {
            okay({
                error: error,
                value: value
            }, {
                error: null,
                value: 0
            }, 'timed out called back')
        }
    })
    now += 2
    console.log('--- again ---')
    turnstile.enter({
        body: 2,
        method: function (envelope, callback) {
            console.log(envelope)
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 2,
                waited: 0,
                timedout: false,
                canceled: false,
                body: 2
            }, 'next entry')
            callback(null, 2)
        },
        completed: function (error, value) {
            okay({
                error: error,
                value: value
            }, {
                error: null,
                value: 2
            }, 'next entry completed')
        }
    })
    console.log('--- wait ---')
    wait(null, 1)
    turnstile.destroy()
    turnstile.destroy()
    turnstile.enter({
        body: 2,
        method: function (envelope, callback) {
            console.log(envelope)
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 2,
                waited: 0,
                timedout: false,
                canceled: true,
                body: 2
            }, 'destroyed entry')
            callback(null, 3)
        },
        completed: function (error, value) {
            okay({
                error: error,
                value: value
            }, {
                error: null,
                value: 3
            }, 'destroyed completed')
        }
    })
    try {
        turnstile.enter({
            method: function (envelope, callback) {
                callback(new Error('abend'))
            }
        })
    } catch (error) {
        console.log(error.stack)
        okay(error.causes[0].message, 'abend', 'abend')
    }
    var turnstile = new Turnstile({
        Date: { now: function () { return now } },
        timeout: 1
    })
    turnstile.listen(function (error) {
        okay(error.causes[0].message, 'error', 'error')
    })
    turnstile.enter({
        method: function (envelope, callback) {
            callback(new Error('error'))
        }
    })
}

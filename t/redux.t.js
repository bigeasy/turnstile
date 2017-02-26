require('proof/redux')(1, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = require('../redux')
    var expectations = [{
        envelope: {
            module: 'turnstile',
            method: 'push',
            when: 0,
            timedout: false,
            body: 1
        },
        message: 'x'
    }]
    var object = {
        method: function (envelope, callback) {
            var expected = expectations.shift()
            assert(envelope, expected.envelope, expected.message)
            throw new Error
        }
    }
    var now = 0
    var turnstile = new Turnstile({
        object: object, method: 'method'
    }, {
        Date: { now: function () { return now } },
        timeout: 1
    })
    async(function () {
        turnstile.enqueue(1, async())
    }, function () {
    })
}

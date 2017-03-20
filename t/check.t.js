require('proof/redux')(2, require('cadence')(prove))

function prove (async, assert) {
    var Turnstile = { Check: require('../check') }
    var object = {
        method: function (envelope, callback) {
            assert(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                timedout: false,
                body: null,
            }, 'check')
            callback(null, 1)
        }
    }
    var check = new Turnstile.Check(object, 'method', {
        Date: { now: function () { return 0 } }
    })
    async(function () {
        check.check(async())
    }, function (result) {
        assert(result, 1, 'checked')
    })
}

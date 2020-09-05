require('proof')(2, prove)

async function prove (okay) {
    const Destructible = require('destructible')
    const Turnstile = require('..')
    Turnstile.Check = require('../check')
    var object = {
        method: function (envelope, callback) {
            okay(envelope, {
                module: 'turnstile',
                method: 'enter',
                when: 0,
                waited: 0,
                destroyed: false,
                timedout: false,
                body: null
            }, 'check')
            callback(null, 1)
        }
    }
    const test = []
    const destructible = new Destructible('t/set.t')
    const turnstile = new Turnstile(destructible, { Date: { now: () => 0 } })
    const check = new Turnstile.Check(turnstile, async (entry) => {
        test.push(entry)
        return 1
    })
    check.check()
    const result = await check.check()
    okay(result, 1, 'checked')
    okay(test, [{
        when: 0, waited: 0, timedout: false, destroyed: false, vargs: []
    }], 'gathered')
}

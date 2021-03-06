require('proof')(2, prove)

async function prove (okay) {
    const Destructible = require('destructible')
    const Turnstile = require('..')
    Turnstile.Set = require('../set')

    const test = []

    const destructible = new Destructible('t/set.t')
    const turnstile = new Turnstile(destructible, { Date: { now: () => { return 0 } } })
    const set = new Turnstile.Set(turnstile, async (entry) => {
        test.push(entry)
        return entry.key
    })

    set.add('a')
    set.add('b')
    okay(await set.add('b'), 'b', 'result')
    okay(test, [{
        key: 'a', when: 0, waited: 0, timedout: false, destroyed: false, canceled: false
    }, {
        key: 'b', when: 0, waited: 0, timedout: false, destroyed: false, canceled: false
    }], 'gathered')

    await destructible.destroy().rejected
}

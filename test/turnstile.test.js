require('proof')(3, prove)

async function prove (okay) {
    const test = []
    const Destructible = require('destructible')
    const destructible = new Destructible('test/turnstile.test.js')
    const Turnstile = require('../turnstile')
    let now = 0
    new Turnstile(destructible.durable('default'))
    const turnstile = new Turnstile(destructible.durable('turnstile'), {
        turnstiles: 1,
        Date: { now: () => now },
        timeout: 1
    })
    const futures = {}
    function addFuture(name) {
        futures[name] = {}
        futures[name].promise = new Promise(resolve => futures[name].resolve = resolve)
    }
    [ 'first', 'second', 'third' ].map(name => addFuture(name))
    turnstile.enter(async (value, state) => {
        test.push(state)
        futures.first.resolve(value)
        await futures.second.promise
    }, 'a')
    await new Promise(resolve => setImmediate(resolve))
    // This will reject because it is going to push and then be timed out.
    turnstile.enter(async function (value, state) {
        test.push(state)
    }, 1, { property: 1 }, -3)
    turnstile.enter(async function (value, state) {
        test.push(state)
        futures.third.resolve(this.property + value)
    }, 1, { property: 1 }, 0)
    okay(await futures.first.promise, 'a', 'first work')
    futures.second.resolve()
    okay(await futures.third.promise, 2, 'second work')
    turnstile.destroy()
    await destructible.promise
    okay(test, [{
        canceled: false,
        timedout: false,
        waited: 0,
        when: 0
    }, {
        canceled: true,
        timedout: true,
        waited: 3,
        when: -3
    }, {
        canceled: false,
        timedout: false,
        waited: 0,
        when: 0
    }], 'states')
}

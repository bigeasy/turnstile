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
    turnstile.enter({
        method: async (value, state) => {
            test.push(state)
            futures.first.resolve(value)
            await futures.second.promise
        },
        body: 'a'
    })
    await new Promise(resolve => setImmediate(resolve))
    // This will reject because it is going to push and then be timed out.
    turnstile.enter({
        method: async function (value, state) {
            test.push(state)
        },
        body: 1,
        object: { property: 1 },
        when: -3
    })
    turnstile.enter({
        method: async function (value, state) {
            test.push(state)
            futures.third.resolve(this.property + value)
        },
        body: 1,
        object: { property: 1 },
        when: 0
    })
    okay(await futures.first.promise, 'a', 'first work')
    futures.second.resolve()
    okay(await futures.third.promise, 2, 'second work')
    turnstile.drain()
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

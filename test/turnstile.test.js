require('proof')(3, prove)

async function prove (okay) {
    const test = []
    const Destructible = require('destructible')
    const destructible = new Destructible('test/turnstile.t')
    const Turnstile = require('../turnstile')
    let now = 0
    const turnstile = new Turnstile(destructible.durable('turnstile'), {
        turnstiles: 1,
        Date: { now: () => now },
        timeout: 1
    })
    destructible.durable('test', async function () {
        const futures = {}
        function addFuture(name) {
            futures[name] = {}
            futures[name].promise = new Promise(resolve => futures[name].resolve = resolve)
        }
        [ 'first', 'second', 'third' ].map(name => addFuture(name))
        turnstile.enter({
            method: async (entry) => {
                test.push(entry)
                futures.first.resolve(entry.body)
                await futures.second.promise
            },
            body: 'a'
        })
        await new Promise(resolve => setImmediate(resolve))
        // This will reject because it is going to push and then be timed out.
        turnstile.enter({
            method: async function (entry) {
                test.push(entry)
            },
            body: 1,
            object: { property: 1 },
            when: -3
        })
        turnstile.enter({
            method: async function (entry) {
                test.push(entry)
                futures.third.resolve(this.property + entry.body)
            },
            body: 1,
            object: { property: 1 },
            when: 0
        })
        okay(await futures.first.promise, 'a', 'first work')
        futures.second.resolve()
        okay(await futures.third.promise, 2, 'second work')
        turnstile.drain()
        await turnstile.drain()
        await turnstile.terminate()
        okay(test, [{
            body: 'a',
            canceled: false,
            timedout: false,
            waited: 0,
            when: 0
        }, {
            body: 1,
            canceled: true,
            timedout: true,
            waited: 3,
            when: -3
        }, {
            body: 1,
            canceled: false,
            timedout: false,
            waited: 0,
            when: 0
        }], 'states')
    } ())
    await destructible.destructed
}

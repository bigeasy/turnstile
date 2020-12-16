require('proof')(2, prove)

async function prove (okay) {
    const Destructible = require('destructible')
    const Turnstile = require('../turnstile')
    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        await destructible.terminal($ => $(), 'run and timeout', async function () {
            const test = []
            let now = 0
            const turnstile = new Turnstile(destructible.durable('turnstile'), {
                turnstiles: 1,
                Date: { now: () => now },
                timeout: 2
            })
            turnstile.enter({ value: 'a' }, async entry => {
                test.push(entry)
            })
            now++
            await turnstile.drain()
            okay(test, [{
                value: 'a',
                when: 0,
                waited: 1,
                timedout: false,
                destroyed: false,
                canceled: false
            }], 'simple run through turnstile')

            test.length = 0
            turnstile.enter({ value: 'b' }, async entry => {
                test.push(entry)
            })
            now += 2
            await turnstile.drain()
            okay(test, [{
                value: 'b',
                when: 1,
                waited: 2,
                timedout: true,
                destroyed: false,
                canceled: true
            }], 'timed out run through turnstile')
        })
        await destructible.rejected
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        await destructible.terminal($ => $(), 'run and timeout', async function () {
            let now = 0
            const turnstile = new Turnstile(destructible.durable('turnstile'), {
                turnstiles: 1,
                Date: { now: () => now },
                timeout: 2
            })
            const test = []
            function latch () {
                let capture
                return { promise: new Promise(resolve => capture = { resolve }), ...capture }
            }
            const work = { entered: latch(), blocked: latch() }
            turnstile.enter({ ...work, value: 'a' }, async ({ entered, blocked, value, timedout }) => {
                entered.resolve()
                await blocked.promise
                test.push({ value, timedout })
            })
            await work.entered.promise
            turnstile.enter({ value: 'b' }, async ({ value, timedout }) => {
                test.push({ value, timedout })
            })
            now += 2
            turnstile.enter({ value: 'c' }, async ({ value, timedout }) => {
                test.push({ value, timedout })
            })
            work.blocked.resolve()
            await turnstile.drain()
        })
        await destructible.destroy().rejected
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        await destructible.terminal($ => $(), 'run and timeout', async function () {
            let now = 0
            const turnstile = new Turnstile(destructible.durable('turnstile'), {
                turnstiles: 1,
                Date: { now: () => now },
                timeout: 2
            })
            const test = []
            turnstile.enter($ => $(), { value: 'a' }, async ({ value, destroyed }) => {
                throw new Error(value)
            })
            turnstile.enter($ => $(), { value: 'b' }, async ({ value, destroyed }) => {
                test.push({ value, destroyed })
            })
            await turnstile.drain()
            console.log(test)
        })
        try {
            await destructible.rejected
        } catch (error) {
            console.log(error.stack)
        }
    }
    return
    await destructible.terminal('test', async function () {
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
        okay(test, [{
            body: 'a',
            timedout: false,
            destroyed: false,
            waited: 0,
            when: 0,
            vargs: []
        }, {
            body: 1,
            timedout: true,
            destroyed: false,
            waited: 3,
            when: -3,
            vargs: []
        }, {
            body: 1,
            timedout: false,
            destroyed: false,
            waited: 0,
            when: 0,
            vargs: []
        }], 'states')
    } ())
    await destructible.rejected
}

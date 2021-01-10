require('proof')(7, prove)

async function prove (okay) {
    const semblance = require('semblance')
    const Destructible = require('destructible')
    const Turnstile = require('../turnstile')
    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        destructible.rescue($ => $(), 'run and timeout', async function () {
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
            destructible.destroy()
        })
        await destructible.promise
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        destructible.rescue($ => $(), 'run and timeout', async function () {
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
            console.log('here')
            turnstile.enter({ value: 'b' }, async ({ value, timedout }) => {
                test.push({ value, timedout })
            })
            now += 2
            turnstile.enter({ value: 'c' }, async ({ value, timedout }) => {
                test.push({ value, timedout })
            })
            work.blocked.resolve()
            await turnstile.drain()
            destructible.destroy()
        })
        await destructible.promise
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        destructible.rescue($ => $(), 'run and timeout', async function () {
            let now = 0
            const turnstile = new Turnstile(destructible.durable('turnstile'), {
                turnstiles: 1,
                Date: { now: () => now },
                timeout: 2
            })
            const test = []
            turnstile.enter($ => $(), { value: 'a' }, async ({ value, destroyed }) => {
                test.push({ value, destroyed })
            })
            turnstile.enter($ => $(), { value: 'b' }, async ({ value, destroyed }) => {
                throw new Error(value)
            })
            turnstile.enter($ => $(), { value: 'c' }, async ({ value, destroyed }) => {
                test.push({ value, destroyed })
            })
            destructible.destroy()
        })
        try {
            await destructible.promise
        } catch (error) {
            console.log(error.stack)
        }
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        destructible.rescue($ => $(), 'run and timeout', async function () {
            let now = 0
            const test = []
            const turnstile = new Turnstile(destructible.durable($ => $(), 'turnstile'))
            turnstile.deferrable.increment()
            turnstile.enter($ => $(), { value: 'a' }, async ({ value, destroyed }) => {
                test.push(value)
            })
            await turnstile.drain()
            turnstile.deferrable.destruct(() => console.log('destructed'))
            destructible.destroy()
            turnstile.enter($ => $(), Date.now(), { value: 'b' }, async ({ value, destroyed }) => {
                test.push(value)
            })
            await turnstile.drain()
            turnstile.deferrable.decrement()
            try {
                turnstile.enter($ => $(), { value: 'c' }, async ({ value, destroyed }) => {
                    test.push(value)
                })
            } catch (error) {
                okay(error.symbol, Destructible.Error.DESTROYED, 'turnstile was destroyed')
            }
            okay(test, [ 'a', 'b' ], 'deferrable')
        })
        await destructible.promise
    }

    {
        const destructible = new Destructible($ => $(), 'test/turnstile.t')
        await destructible.ephemeral($ => $(), 'run and timeout', async function () {
            let now = 0
            const test = []
            const turnstile = new Turnstile(destructible.durable($ => $(), 'turnstile'))
            const entry = turnstile.enter($ => $(), { value: 'a' }, async ({ value, destroyed }) => {
                test.push(value)
            })
            turnstile.unqueue(entry)
            await turnstile.drain()
            turnstile.enter($ => $(), Date.now(), { value: 'b' }, async ({ value, destroyed }) => {
                test.push(value)
            })
            await turnstile.drain()
            okay(test, [ 'b' ], 'unqueue')
            destructible.destroy()
        })
        await destructible.promise
    }

    {
        const options = Turnstile.options([ { value: 1 }, async () => {} ])
        okay(semblance(options, {
            trace: null,
            when: null,
            work: { value: 1 },
            worker: value => typeof value == 'function',
            object: null
        }), 'options')
        const vargs = Turnstile.vargs(options)
        okay(semblance(vargs, [
            { value: 1 },
            value => typeof value == 'function',
            null
        ], { length: 3 }), 'vargs')
    }
}

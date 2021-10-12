[![Actions Status](https://github.com/bigeasy/turnstile/workflows/Node%20CI/badge.svg)](https://github.com/bigeasy/turnstile/actions)
[![codecov](https://codecov.io/gh/bigeasy/turnstile/branch/master/graph/badge.svg)](https://codecov.io/gh/bigeasy/turnstile)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An evented, throttled work queue.

| What          | Where                                         |
| --- | --- |
| Discussion    | https://github.com/bigeasy/turnstile/issues/1 |
| Documentation | https://bigeasy.github.io/turnstile           |
| Source        | https://github.com/bigeasy/turnstile          |
| Issues        | https://github.com/bigeasy/turnstile/issues   |
| CI            | https://travis-ci.org/bigeasy/turnstile       |
| Coverage:     | https://codecov.io/gh/bigeasy/turnstile       |
| License:      | MIT                                           |


Turnstile installs from NPM.

```
//{ "mode": "text" }
npm install turnstile
```

## Living `README.md`

This `README.md` is also a unit test using the
[Proof](https://github.com/bigeasy/proof) unit test framework. We'll use the
Proof `okay` function to assert out statements in the readme. A Proof unit test
generally looks like this.

```javascript
//{ "code": { "tests": 8 }, "text": { "tests": 4  } }
require('proof')(%(tests)d, async okay => {
    //{ "include": "test", "mode": "code" }
    //{ "include": "proof" }
})
```

```javascript
//{ "name": "proof", "mode": "text" }
okay('always okay')
okay(true, 'okay if true')
okay(1, 1, 'okay if equal')
okay({ value: 1 }, { value: 1 }, 'okay if deep strict equal')
```

You can run this unit test yourself to see the output from the various
code sections of the readme.

```text
//{ "mode": "text" }
git clone git@github.com:bigeasy/turnstile.git
cd turnstile
npm install --no-package-lock --no-save
node test/readme.t.js
```

## Overview

Required.

```javascript
//{ "name": "test", "code": { "path": "'..'" }, "text": { "path": "'turnstile'" } }
const Turnstile = require(%(path)s)
```

Additional requires.

```javascript
//{ "name": "test" }
const Destructible = require('destructible')
```

Simple example with a timeout.

```javascript
//{ "name": "test", "unblock": true }
{
    const destructible = new Destructible('test/turnstile.t')
    destructible.durable('run and timeout', async function () {
        const test = []
        let now = 0
        const turnstile = new Turnstile(destructible.durable('turnstile'), {
            strands: 1,
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
```

Timeout. Note that b arrives before a because it was cancelled using the
cancellation strand.

```javascript
//{ "name": "test", "unblock": true }
{
    const destructible = new Destructible($ => $(), 'test/turnstile.t')
    destructible.ephemeral($ => $(), 'run and timeout', async function () {
        let now = 0
        const turnstile = new Turnstile(destructible.durable('turnstile'), {
            strands: 1,
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
            console.log('a')
            test.push({ value, timedout })
        })
        await work.entered.promise
        turnstile.enter({ value: 'b' }, async ({ value, timedout }) => {
            console.log('b')
            test.push({ value, timedout })
        })
        now += 2
        turnstile.enter({ value: 'c' }, async ({ value, timedout }) => {
            test.push({ value, timedout })
        })
        work.blocked.resolve()
        await turnstile.drain()
        destructible.destroy()
        console.log(test)
    })
    await destructible.promise
}
```

Errors come out of `Destructible`.

```javascript
//{ "name": "test", "unblock": true }
{
    const destructible = new Destructible($ => $(), 'test/turnstile.t')
    destructible.durable($ => $(), 'run and timeout', async function () {
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
        throw new Error('no error')
    } catch (error) {
        console.log(error.stack)
    }
}
```

The deferrable construct.

```javascript
//{ "name": "test", "unblock": true }
{
    const destructible = new Destructible($ => $(), 'test/turnstile.t')
    destructible.ephemeral($ => $(), 'run and timeout', async function () {
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
```

Example of unqueue.

```javascript
//{ "name": "test", "unblock": true }
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
```

Example of `options` and `vargs` static methods.

```javascript
//{ "name": "test", "unblock": true }
{
    const options = Turnstile.options([ { value: 1 }, async () => {} ])
    okay({
        trace: options.trace,
        when: options.when,
        work: options.work,
        worker: options.worker.toString(),
        object: options.object
    }, {
        trace: null,
        when: null,
        work: { value: 1 },
        worker: 'async () => {}',
        object: null
    }, 'options')
    const vargs = Turnstile.vargs(options)
    okay([
        vargs[0],
        vargs[1].toString(),
        vargs[2]
    ], [
        { value: 1 },
        'async () => {}',
        null
    ], 'vargs')
    okay(vargs.length, 3, 'vargs length')
}
```

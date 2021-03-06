require('proof')(2, prove)

async function prove (okay) {
    const Destructible = require('destructible')
    const Turnstile = require('..')
    Turnstile.Queue = require('../queue')

    const test = []

    const destructible = new Destructible('t/queue.t')
    const turnstile = new Turnstile(destructible, { Date: { now: () => 0 } })
    const queue = new Turnstile.Queue(turnstile, function (entry) {
        test.push(entry)
        return entry.value
    })

    queue.push(1)
    const result = await queue.enqueue(2)
    okay(result, 2, 'returned')
    okay(test, [{
        value: 1,
        when: 0,
        waited: 0,
        timedout: false,
        destroyed: false,
        canceled: false
    }, {
        value: 2,
        when: 0,
        waited: 0,
        timedout: false,
        destroyed: false,
        canceled: false
    }], 'test')

    await destructible.destroy().rejected
}

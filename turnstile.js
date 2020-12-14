// Return the first not null-like value.
const coalesce = require('extant')

const Queue = require('avenue')

const Interrupt = require('interrupt')

const noop = require('nop')

// Construct a turnstile.
//
// `options`
//
//  * `turnstiles` ~ number of concurrent invocations of the worker
//  function.
//  * `timeout` ~ time in millisecond before marking a task as timedout and
//  invoking the worker function for task cancelation.
//  * `Date` ~ provide a dummy date implementation, useful for unit testing
//  task timeouts.

//
class Turnstile {
    static Error = Interrupt.create('Turnstile.Error', {
        TERMINATED: 'attempted to enqueue new work into a terminated turnstile'
    })

    constructor (destructible, options = {}) {
        this.terminated = false
        this._instance = 0
        this._head = { timesout: Infinity }
        this._head.next = this._head.previous = this._head
        this.health = {
            occupied: 0, waiting: 0, rejecting: 0,
            turnstiles: coalesce(options.turnstiles, 1)
        }
        this.timeout = coalesce(options.timeout, Infinity)
        this._Date = coalesce(options.Date, Date)
        // Create a queue of work that has timed out.
        this._rejected = new Queue
        // Poll the rejectable queue for timed out work.
        this._drain = null
        this._drained = noop
        this.destroyed = false
        this._latches = []
        destructible.destruct(() => this.destroyed = true)
        destructible.durable($ => $(), 'rejector', this._rejector(this._rejected.shifter()))
        for (let i = 0; i < this.health.turnstiles; i++) {
            destructible.durable($ => $(), [ 'turnstile', i ], this._turnstile())
        }
    }

    // Return the total number of entries in the Turnstile, the number of
    // waiting entries plus any entry being processed or rejected.

    //
    get size () {
        return this.health.occupied + this.health.rejecting + this.health.waiting
    }

    drain () {
        if (this._drain == null) {
            this._drain = new Promise(resolve => this._drained = resolve)
        }
        const drain = this._drain
        this._checkDrain()
        return drain
    }

    // Like Conduit, when the Destructible destructs, we may not want to shut
    // down without working through our queue, so in response to Destructible
    // destruction we simply inform the worker function that we're in a
    // destroyed state.
    //
    // Wondering how to handle the case where we have an exception in one of our
    // turnstiles. Do we make an effort to shutdown or otherwise notify the
    // other worker functions that the Turnstile is in an error state? The
    // problem is that there is a reduced capacity. What happens if there are
    // many turnstiles, they all crash but one, and we try to shutdown working
    // through a workload that it will take a long time to handle? Could
    // conceiable just set a flag that says that the Turnstile is impaired.

    //
    terminate (cancel = false) {
        if (!this.terminated) {
            this.terminated = true
            const drain = this.drain()
            this._rejected.push(null)
            this._latches.splice(0).forEach(latch => latch.resolve())
            this._checkDrain()
            return drain
        }
        return this._drain || Promise.resolve()
    }

    _checkDrain () {
        if (this._drain != null && this.size == 0) {
            this._drain = null
            const drained = this._drained
            this._drained = noop
            drained.call()
        }
    }

    // Enter work into the queue. Properties of the `envelope` argument can include:
    //
    //  * `body` ~ body of task, your data, or `null` if not specified.
    //  * `method` ~ the work function.
    //  * `object` ~ the object to use as the `this` property of the work function
    //  invocation, or `null` if not specified.
    //  * `completed` ~ an error-first callback function to invoke with the result
    //  of the work function.
    //  * `when` ~ time to use as the start time of the task or `Date.now()` if not
    //  specified.

    //
    enter ({ method, body, when, object, vargs = [] }) {
        Turnstile.Error.assert(!this.terminated, 'terminated', { code: 'terminated' })
        // Pop and shift variadic arguments.
        const now = coalesce(when, this._Date.now())
        const task = {
            method: method,
            object: coalesce(object),
            body: body,
            when: now,
            timesout: now + this.timeout,
            vargs: vargs,
            previous: this._head.previous,
            next: this._head
        }
        task.next.previous = task
        task.previous.next = task
        this.health.waiting++
        if (this._latches.length != 0) {
            this._latches.shift().resolve()
        }
        // We check for rejections on entry assuming that if we've managed to
        // make our work queue a certain length, there is no harm in leaving it
        // that length for however long it takes for us to detect that it is
        // stuggling. We just won't grow it when messages are timing out.
        for (;;) {
            if (now < this._head.next.timesout) {
                break
            }
            const entry = this._head.next
            this._head.next = entry.next
            this._head.next.previous = this._head
            this._rejected.push(entry)
        }
    }

    // Perform work.
    //
    // We have two nested loops. The inner loop is a best-foot-forward loop, if
    // there is no error as there shouldn't be, it will forgo the overhead of a
    // try/catch block while chewing through a backlog. This optimzation may not be
    // that much of an optimization and simpler would be better so we should
    // TODO benchmark it at some point.
    //
    // If we catch an error from the work function for a canceled task we through it
    // and we hope it blows the whole application up because it's too late to do
    // anything meaningful at all with an exception. We used to use `abend` to
    // ensure calamity befalls our dear user, but I'm curious to see if this can be
    // raised and not swallowed with my current exception handling disciplines.
    //
    // But if we get an error form the work function for an actual task, we'll
    // record it and report it as so as we're done destroying ourselves.

    //
    async _turnstile () {
        for (;;) {
            if (this.health.waiting == 0) {
                if (this.terminated) {
                    break
                }
                const latch = { promise: null, resolve: null }
                latch.promise = new Promise(resolve => latch.resolve = resolve)
                this._latches.push(latch)
                await latch.promise
                continue
            }
            try {
                this.health.occupied++
                // Work through the work in the queue.
                while (this.health.waiting != 0) {
                    const now = this._Date.now()
                    // Shift a task off of the work queue.
                    const entry = this._head.next
                    this._head.next = entry.next
                    this._head.next.previous = this._head
                    this.health.waiting--
                    // Run the task and mark it as completed if it succeeds.
                    const timedout = entry.timesout <= now
                    const waited = now - entry.when
                    await entry.method.call(entry.object, {
                        body: entry.body,
                        when: entry.when,
                        waited: now - entry.when,
                        timedout,
                        destroyed: this.destroyed,
                        vargs: entry.vargs
                    })
                }
            } finally {
                this.health.occupied--
                this._checkDrain()
            }
        }
    }

    // `fracture._reject(shifter)` &mdash; invoke worker function with a timed
    // out state.
    //
    //  * `shifter` &mdash; shifter for rejected queue.
    //
    // When we call this function, we've already asserted that the entry in
    // question has expired, so do not repeat the test.
    //
    // Tempted to optimize the loop with an internal synchronous peek of the
    // shifter, but this is not the critical path of this class, and we ought to
    // be happy to have the relief it provides in those times of crisis when we
    // will call it.

    //
    async _rejector (shifter) {
        try {
            this.health.rejecting++
            for (;;) {
                let entry = shifter.sync.shift()
                if (entry == null) {
                    this.health.rejecting--
                    this._checkDrain()
                    entry = await shifter.shift()
                    this.health.rejecting++
                }
                if (entry == null) {
                    break
                }
                this.health.waiting--
                const now = this._Date.now()
                await entry.method.call(entry.object, {
                    body: entry.body,
                    when: entry.when,
                    waited: now - entry.when,
                    timedout: true,
                    destroyed: this.destroyed,
                    vargs: entry.vargs
                })
            }
        } finally {
            // The only statement that throws above is the worker function call.
            this.health.rejecting--
            this._checkDrain()
        }
    }
}

module.exports = Turnstile

// Return the first not null-like value.
const coalesce = require('extant')

const Interrupt = require('interrupt')

const noop = require('nop')

// Construct a turnstile.
//
// `options`
//
//  * `strands` ~ number of concurrent invocations of the worker function.
//  * `timeout` ~ time in millisecond before marking a task as timedout and
//  invoking the worker function for task cancelation.
//  * `Date` ~ provide a dummy date implementation, useful for unit testing
//  task timeouts.

//
class Turnstile {
    static Error = Interrupt.create('Turnstile.Error', {
        DESTROYED: 'attempted to enqueue new work into a terminated turnstile',
        ERRORED: 'errors encountered while running turnstile',
        CAUGHT: 'errors encountered while running turnstile',
        INVALID_ARGUMENT: 'dequeue argument is not a Turnstile entry'
    })

    static ENTRY = Symbol('ENTRY')

    static NULL_ENTRY = Object.defineProperties({}, {
        type: { value: Turnstile.ENTRY, enumerable: true, writable: false, configurable: false },
        unlinked: { value: true, enumerable: true, writable: false, configurable: false }
    })

    constructor (destructible, options = {}) {
        this.terminated = false
        this._instance = 0
        this._head = { timesout: Infinity }
        this._head.next = this._head.previous = this._head
        this.health = {
            occupied: 0, waiting: 0, rejecting: 0,
            strands: coalesce(options.strands, 1)
        }
        this.timeout = coalesce(options.timeout, Infinity)
        this._Date = coalesce(options.Date, Date)
        // Create a queue of work that has timed out.
        this._reject = { promise: null, resolve: noop }
        // Poll the rejectable queue for timed out work.
        this._drain = null
        this._drained = noop
        this.destroyed = false
        this._latches = []
        this._errors = []
        destructible.destruct(() => {
            this.destroyed = true
            while (this._latches.length != 0) {
                this._latches.shift().resolve.call()
            }
            this._reject.resolve.call()
            destructible.ephemeral($ => $(), 'shutdown', async () => {
                await this.drain()
                if (this._errors.length != 0) {
                    throw new Turnstile.Error('ERRORED', this._errors, { ...this.health }, 1)
                }
            })
        })
        destructible.durable($ => $(), 'rejector', this._turnstile(true))
        for (let i = 0; i < this.health.strands; i++) {
            destructible.durable($ => $(), [ 'turnstile', i ], this._turnstile(false))
        }
        this._destructible = destructible
    }
    //

    // Return the total number of entries in the Turnstile, the number of
    // waiting entries plus any entry being processed or rejected.

    //
    get size () {
        return this.health.occupied + this.health.rejecting + this.health.waiting
    }

    _unlink (entry) {
        entry.previous.next = entry.next
        entry.next.previous = entry.previous
        entry.next = entry.previous = null
        entry.unlinked = true
    }

    dequeue (entry) {
        Turnstile.Error.assert(entry.type === Turnstile.ENTRY, 'INVALID_ARGUMENT')
        if (!entry.unlinked) {
            this._unlink(entry)
            return true
        }
        return false
    }

    drain () {
        if (this._drain == null) {
            this._drain = new Promise(resolve => this._drained = resolve)
        }
        const drain = this._drain
        this._checkDrain()
        return drain
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
    enter (...vargs) {
        const trace = typeof vargs[0] == 'function' ? vargs.shift() : null
        const when = typeof vargs[0] == 'number' ? vargs.shift() : this._Date.now()
        const work = vargs.shift()
        const worker = vargs.shift()
        const object = coalesce(vargs.shift())
        Turnstile.Error.assert(!this.destroyed, 'DESTROYED')
        // Pop and shift variadic arguments.
        const now = coalesce(when, this._Date.now())
        const entry = {
            unlinked: false,
            trace: trace,
            work: work,
            worker: worker,
            object: coalesce(object),
            when: when,
            timesout: now + this.timeout,
            previous: this._head.previous,
            next: this._head
        }
        entry.next.previous = entry
        entry.previous.next = entry
        this.health.waiting++
        if (this._latches.length != 0) {
            this._latches.shift().resolve()
        }
        // We check for rejections on entry assuming that if we've managed to
        // make our work queue a certain length, there is no harm in leaving it
        // that length for however long it takes for us to detect that it is
        // stuggling. We just won't grow it when messages are timing out.
        if (now < this._head.next.timesout) {
            this._reject.resolve.call()
        }
        return entry
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
    async _turnstile (rejector) {
        for (;;) {
            if (
                this.health.waiting == 0 ||
                (
                    rejector &&
                    this._Date.now() > this._head.next.timesout
                )
            ) {
                if (this.destroyed) {
                    break
                }
                let capture
                const latch = { promise: new Promise(resolve => capture = { resolve }), ...capture }
                if (rejector) {
                    this._reject = latch
                } else {
                    this._latches.push(latch)
                }
                await latch.promise
                continue
            }
            let entry
            try {
                if (rejector) {
                    this.health.rejecting++
                } else {
                    this.health.occupied++
                }
                // Work through the work in the queue.
                while (this.health.waiting != 0) {
                    const now = this._Date.now()
                    // Shift a task off of the work queue.
                    entry = this._head.next
                    this._unlink(entry)
                    this.health.waiting--
                    // Run the task and mark it as completed if it succeeds.
                    entry.next = entry.previous = null
                    const timedout = entry.timesout <= now
                    const waited = now - entry.when
                    const work = {
                        ...entry.work,
                        when: entry.when,
                        waited: now - entry.when,
                        timedout,
                        destroyed: this.destroyed,
                        canceled: timedout || this.destroyed,
                    }
                    await entry.worker.call(entry.object, work)
                }
            } catch (error) {
                // Gather any errors and shutdown.
                this._errors.push(new Turnstile.Error({ $trace: entry.trace }, 'CAUGHT', [ error ], 1))
                this._destructible.destroy()
            } finally {
                if (rejector) {
                    this.health.rejecting--
                } else {
                    this.health.occupied--
                }
                this._checkDrain()
            }
        }
    }
}

module.exports = Turnstile

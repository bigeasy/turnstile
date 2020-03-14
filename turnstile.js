const assert = require('assert')
// Return the first not null-like value.
const coalesce = require('extant')

// Exceptions you can catch by type.
const Interrupt = require('interrupt').create('turnstile')

const Avenue = require('avenue')

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
    constructor (destructible, options = {}) {
        this.destroyed = false
        this._destructible = destructible
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
        this._rejected = new Avenue
        // Poll the rejectable queue for timed out work.
        destructible.durable('rejector', this._reject(this._rejected.shifter()))
        // Mark destroyed on destruct.
        destructible.destruct(() => this.destroyed = true)
        // End reject loop on destruct.
        destructible.destruct(() => this._rejected.push(null))
    }

    // We need to destroy explicity. Seems like we want to forgo time timeout
    // mechanism, because we did something similar to that in Conduit, but once
    // we push an end to the rejected loop we start the countdown, unless we
    // make that ephemeral. Also, we probably don't want to keep working through
    // the workload if we get an exception, so we do want to make things as
    // destroyed. We already have that though. The `_turnstile` loop ending will
    // trigger destroy, and propagate the error.

    //
    drain () {
        this._draining = true
        this._checkDrain()
    }

    _checkDrain () {
        if (this._draining && this.health.occupied == 0) {
            this._destructible.destroy()
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
    enter ({ method, body, when, object }) {
        assert(!this.destroyed, 'already destroyed')
        // Pop and shift variadic arguments.
        const now = coalesce(when, this._Date.now())
        const task = {
            method: method,
            object: coalesce(object),
            body: body,
            when: now,
            timesout: now + this.timeout,
            previous: this._head.previous,
            next: this._head
        }
        task.next.previous = task
        task.previous.next = task
        this.health.waiting++
        if (this.health.occupied < this.health.turnstiles) {
            const instance = this._instance = (this._instance + 1) & 0xfffffff
            this._destructible.ephemeral([ 'turnstile', now, instance ], this._turnstile())
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
            this.health.waiting--
            this.health.rejecting++
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
                const canceled = this.destroyed || timedout
                await entry.method.call(entry.object, {
                    body: entry.body,
                    when: entry.when,
                    waited: now - entry.when,
                    timedout, canceled
                })
            }
        } finally {
            this.health.occupied--
            this._checkDrain()
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
    async _reject (shifter) {
        for await (const entry of shifter.iterator()) {
            const now = this._Date.now()
            try {
                await entry.method.call(entry.object, {
                    body: entry.body,
                    when: entry.when,
                    waited: now - entry.when,
                    timedout: true ,
                    canceled: true
                })
            } finally {
                this.health.rejecting--
            }
        }
    }
}

module.exports = Turnstile

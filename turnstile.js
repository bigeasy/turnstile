// Control-flow utilities.
var cadence = require('cadence')
var abend = require('abend')

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var noop = require('nop')

// Exceptions you can catch by type.
var Interrupt = require('interrupt').createInterrupter('turnstile')

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
function Turnstile (options) {
    options = coalesce(options, {})
    this.destroyed = false
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.health = {
        occupied: 0,
        waiting: 0,
        rejecting: 0,
        turnstiles: coalesce(options.turnstiles, 1)
    }
    this._listener = abend
    this._callback = null
    this.errors = []
    this.health.occupied = 0
    this.health.waiting = 0
    this.health.rejecting = 0
    this.timeout = coalesce(options.timeout, Infinity)
    this._Date = coalesce(options.Date, Date)
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
Turnstile.prototype.enter = function (envelope) {
    var now = this._Date.now()
    var when = coalesce(envelope.when, now)
    var task = {
        object: coalesce(envelope.object),
        method: envelope.method,
        when: when,
        timesout: when + this.timeout,
        body: coalesce(envelope.body),
        completed: coalesce(envelope.completed, noop),
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
    if (this.health.occupied < this.health.turnstiles) {
        this._turnstile('occupied', false)
    } else if (this.health.rejecting == 0 && now >= this._head.next.timesout) {
        this._turnstile('rejecting', true)
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
Turnstile.prototype._work = cadence(function (async, counter, rejector) {
    // We increment and decrement a counter based on whether we're working
    // through tasks or rejecting them because they've expired.
    async([function () {
        this.health[counter]--
    }], function () {
        this.health[counter]++
    }, function () {
        //
        var task, canceled
        // Outer loop for error handling, which is off the happy path. (See
        // above.)
        var errored = async.loop([], [function () {
            // Work through the work in the queue.
            async.loop([], function () {
                var now = this._Date.now()
                // Loop exit.
                if (
                    this.health.waiting == 0 ||
                    (
                        counter == 'rejecting' &&
                        this._head.next.timesout >= now
                    )
                ) {
                    return [ errored.break ]
                }
                // Shift a task off of the work queue.
                task = this._head.next
                this._head.next = task.next
                this._head.next.previous = this._head
                this.health.waiting--
                // Run the task and mark it as completed if it succeeds.
                var timedout = task.timesout <= now
                var waited = now - task.when
                canceled = this.destroyed || timedout
                async(function () {
                    task.method.call(task.object, {
                        module: 'turnstile',
                        method: 'enter',
                        when: task.when,
                        waited: now - task.when,
                        timedout: timedout,
                        canceled: canceled,
                        body: task.body
                    }, async())
                }, [], function (vargs) {
                    vargs.unshift(null)
                    task.completed.apply(null, vargs)
                })
            })
        }, function (error) {
            if (canceled) {
                // Maximum panic.
                throw error
            } else {
                // Mark this Turnstile destroyed.
                this.destroyed = true
                this._callback = this._listener
                // Take note of the exception for our summary exception while
                // returning it to the caller.
                this.errors.push(error)
                task.completed.call(null, error)
            }
        }])
    })
})

// Start an asynchronous loop to consume work on the work queue. The `counter`
// indicates which counter to increment in `heath`, either `occupied` to
// indicate a running turnstile or `rejecting` for the special rejector
// turnstile that only processes timedout tasks.

//
Turnstile.prototype._turnstile = function (counter) {
    var self = this
    this._work(counter, function (error) { self._calledback(error) })
}

Turnstile.prototype._calledback = function (error) {
    if (error) {
        // TODO Do you really need `abend`?
        throw new Interrupt('canceled', { causes: [[ error ]] })
    } else if (
        this.destroyed &&
        this._callback &&
        this.health.waiting == 0 &&
        this.health.occupied == 0 &&
        this.health.rejecting == 0
    ) {
        var callback = [ this._callback, this._callback = null ][0]
        if (this.errors.length) {
            callback(new Interrupt('error', {
                causes: this.errors.map(function (error) { return [ error ] }),
                module: 'turnstile',
                health: this.health
            }))
        } else {
            callback()
        }
    }
}

Turnstile.prototype.listen = function (callback) {
    this._listener = callback
}

Turnstile.prototype.destroy = function () {
    if (!this.destroyed) {
        this.destroyed = true
        this._callback = this._listener
        this._calledback()
    }
}

module.exports = Turnstile

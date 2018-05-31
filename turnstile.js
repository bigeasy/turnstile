// Control-flow utilities.
var cadence = require('cadence')
var abend = require('abend')

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var noop = require('nop')

// Asynchronous semaphore.
var Signal = require('signal')

var interrupt = require('interrupt').createInterrupter('turnstile')

var Drain = require('./drain')

// Create a turnstile that will invoke the given operation with each entry
// pushed into the work queue.

function _stopWorker (turnstile) {
    return turnstile.paused || turnstile.health.waiting == 0
}

function _stopRejector (turnstile) {
    return turnstile.paused
        || turnstile.health.waiting == 0
        || turnstile._Date.now() - turnstile._head.next.when <= turnstile.timeout
}

//
function Turnstile (options) {
    options || (options = {})
    this.paused = false
    this.closed = false
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.health = {
        occupied: 0,
        waiting: 0,
        rejecting: 0,
        turnstiles: coalesce(options.turnstiles, 1)
    }
    this._callbacks = { occupied: [], rejecting: [] }
    this._listener = abend
    this.errors = []
    this._failures = []
    this.errored = new Signal
    this.health.occupied = 0
    this.health.waiting = 0
    this.health.rejecting = 0
    this.paused = 0
    this.timeout = coalesce(options.timeout, Infinity)
    this._Date = coalesce(options.Date, Date)
    this.setImmediate = coalesce(options.setImmediate, true)
}

Turnstile.prototype.reconfigure = function (options) {
    options.turnstiles == null || (this.health.turnstiles = options.turnstiles)
    options.timeout == null || (this.timeout = options.timeout)
}

Turnstile.prototype.enter = function (envelope) {
    var task = {
        error: coalesce(envelope.error),
        object: coalesce(envelope.object),
        method: envelope.method,
        when: coalesce(envelope.when, this._Date.now()),
        body: coalesce(envelope.body),
        started: coalesce(envelope.started, noop),
        completed: coalesce(envelope.completed, noop),
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
    if (this.paused) {
    } else if (this.health.occupied < this.health.turnstiles) {
        this._stack('occupied', _stopWorker)
    } else if (this.health.rejecting == 0 && this._Date.now() - this._head.next.when >= this.timeout) {
        this._stack('rejecting', _stopRejector)
    }
}

Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    // We increment and decrement a counter based on whether we're working
    // through tasks or rejecting them because they've expired.
    async([function () {
        this.health[counter]--
    }], function () {
        this.health[counter]++
    }, function () {
        var task, envelope // TODO Wrong scope and dubious respectively.
        async([function () {
            // Work through the work in the queue.
            var loop = async(function () {
                // Loop exit.
                if (stopper(this)) {
                    return [ loop.break ]
                }
                // Shift a task off of the work queue.
                task = this._head.next
                this._head.next = task.next
                this._head.next.previous = this._head
                this.health.waiting--
                // Notify caller that we've begun.
                task.started.call(null)
                // If case we crash restart the task we don't want to call
                // started a second time.
                task.started = noop
                // Run the task and mark it as completed if it succeeds.
                async(function () {
                    var waited = this._Date.now() - task.when
                    task.method.call(task.object, envelope = {
                        module: 'turnstile',
                        method: 'enter',
                        when: task.when,
                        waited: waited,
                        timedout: waited >= this.timeout,
                        body: task.body,
                        error: task.error
                    }, async())
                }, [], function (vargs) {
                    vargs.unshift(null)
                    task.completed.apply(null, vargs)
                })
            })()
        }, function (error) {
            // Notify anyone listening of pending destruction.
            this.errored.unlatch()
            // Mark destroyed?
            this.paused = true
            // Save the error for an exception we'd like to raise.
            this.errors.push(error)
            // Save the task so we can return it from a drain.
            this._failures.push({
                module: 'turnstile',
                when: task.when,
                body: task.body,
                error: error
            })
        }])
    })
})

Turnstile.prototype._stack = function (type, stopper) {
    var self = this
    this._work(type, stopper, function () { self._calledback() })
}

Turnstile.prototype._calledback = function () {
    if (
        (this.paused || (this.closed && this.health.waiting == 0)) &&
        this.health.occupied == 0 && this.health.rejecting == 0
    ) {
        this.drain = new Drain(this.health.waiting, this._head, this._failures)
        var listener = [ this._listener, this._listener = abend ][0]
        if (this.errors.length) {
            listener(interrupt('error', this.errors.slice(), {
                module: 'turnstile',
                health: this.health
            }))
        } else {
            listener()
        }
    }
}

Turnstile.prototype.listen = function (callback) {
    this._listener = callback
}

Turnstile.prototype.close = function () {
    this.closed = true
    this._calledback()
}

module.exports = Turnstile

// Control-flow utilities.
var cadence = require('cadence')

// Common utilities.
var coalesce = require('extant')

// Create bound user callback.
var Operation = require('operation/variadic')

var nop = require('nop')

var abend = require('abend')

var interrupt = require('interrupt').createInterrupter('turnstile')

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

function createCallback (turnstile, type) {
    function callback (error) {
        turnstile._calledback(error, type)
    }
    return callback
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
        method: envelope.checkpoint
            ? function (envelope, callback) { callback() }
            : envelope.method,
        when: coalesce(envelope.when, this._Date.now()),
        body: coalesce(envelope.body),
        started: coalesce(envelope.started, nop),
        completed: coalesce(envelope.completed, nop),
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

Turnstile.prototype._nudge = function () {
}

Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    // We increment and decrement a counter based on whether we're working
    // through tasks or rejecting them because they've expired.
    async([function () {
        this.health[counter]--
    }], function () {
        this.health[counter]++
    }, function () {
        var task, envelope
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
                task.started = nop
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
                }, function () {
                    task.completed.call(null)
                })
            })()
        }, function (error) {
            // Put the error in the task so we can see that it failed if we try
            // to run it again.
            task.error = error
            // Push the work back onto the front of the queue.
            task.next = this._head.next
            task.previous = this._head
            task.next.previous = task
            task.previous.next = task
            // Throw a wrapped exception that has all the envelope properties.
            throw new interrupt('exception', error, {}, {
                properties: envelope
            })
        }])
    })
})

Turnstile.prototype._stack = function (type, stopper) {
    this._work(type, stopper, this._callbacks[type].shift() || createCallback(this, type))
}

Turnstile.prototype._calledback = function (error) {
    if (error) {
        this.paused = true
        this.errors.push(error)
    }
    if (
        (this.paused || (this.closed && this.health.waiting == 0)) &&
        this.health.occupied == 0 && this.health.rejecting == 0
    ) {
        var listener = [ this._listener, this._listener = abend ][0]
        if (this.errors.length) {
            listener(this.errors[0])
        } else {
            listener()
        }
    }
}

Turnstile.prototype.listen = function (callback) {
    this._listener = callback
}

Turnstile.prototype.pause = function () {
    this.paused = true
    if (this.health.waiting == 0 && this.health.occupied == 0 && this.health.rejecting == 0) {
        [ this._listener, this._listener = abend ][0]()
    }
}

Turnstile.prototype.resume = function () {
    interrupt.assert(this.paused && this.health.occupied == 0 && this.health.rejecting == 0, 'unpaused')
    this.paused = false
    this.errors.splice(0, this.errors.length)
    while (this.health.waiting && this.health.occupied < this.health.turnstiles) {
        this._stack('occupied', _stopWorker)
    }
}

Turnstile.prototype.close = function () {
    this.closed = true
}

Turnstile.prototype.drain = function (consumer) {
    var f = consumer
    if (typeof consumer != 'function') {
        f = function (task) { consumer.enter(task) }
    }
    while (this._head.next !== this._head) {
        var task = this._head.next
        this._head.next = task.next
        this._head.next.previous = this._head
        f({
            error: task.error,
            object: task.object,
            method: task.method,
            when: task.when,
            body: task.body,
            started: task.started,
            completed: task.completed
        })
    }
}

module.exports = Turnstile

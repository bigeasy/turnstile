// Control-flow utilities.
var cadence = require('cadence')

// Common utilities.
var coalesce = require('extant')

// Create bound user callback.
var Operation = require('operation/variadic')

var nop = require('nop')

var abend = require('abend')

// Create a turnstile that will invoke the given operation with each entry
// pushed into the work queue.

function _stopWorker (turnstile) {
    return turnstile.destroyed || turnstile.health.waiting == 0
}

function _stopRejector (turnstile) {
    return turnstile.destroyed
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
    this.destroyed = false
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
        object: coalesce(envelope.object),
        method: envelope.checkpoint
            ? function (envelope, callback) { callback() }
            : envelope.method,
        when: this._Date.now(),
        body: coalesce(envelope.body),
        started: coalesce(envelope.started, nop),
        completed: coalesce(envelope.completed, nop),
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
    if (this.destroyed) {
    } else if (this.health.occupied < this.health.turnstiles) {
        this._stack('occupied', _stopWorker)
    } else if (this.health.rejecting == 0 && this._Date.now() - this._head.next.when >= this.timeout) {
        this._stack('rejecting', _stopRejector)
    }
}

Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    async([function () {
        this.health[counter]--
    }], function () {
        this.health[counter]++
    }, function () {
        var loop = async(function () {
            if (stopper(this)) {
                return [ loop.break ]
            }
            var task = this._head.next
            this._head.next = task.next
            this._head.next.previous = this._head
            this.health.waiting--
            task.started.call(null)
            async(function () {
                var waited = this._Date.now() - task.when
                task.method.call(task.object, {
                    module: 'turnstile',
                    method: 'enter',
                    when: task.when,
                    waited: waited,
                    timedout: waited >= this.timeout,
                    body: task.body
                }, async())
            }, [], function (vargs) {
                task.completed.apply(null, [ null ].concat(vargs))
            })
        })()
    })
})

Turnstile.prototype._stack = function (type, stopper) {
    this._work(type, stopper, this._callbacks[type].shift() || createCallback(this, type))
}

Turnstile.prototype._calledback = function (error) {
    if (error) {
        this.destroyed = true
        this.errors.push(error)
    }
    if (this.destroyed && this.health.occupied == 0 && this.health.rejecting == 0) {
        if (this.errors.length) {
            this._listener.call(null, this.errors[0])
        } else {
            this._listener.call(null)
        }
    }
}

Turnstile.prototype.listen = function (callback) {
    this._listener = callback
}

module.exports = Turnstile

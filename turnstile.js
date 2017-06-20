// Control-flow utilities.
var cadence = require('cadence')
var abend = require('abend')

// Common utilities.
var coalesce = require('extant')

// Create bound user callback.
var Operation = require('operation/variadic')

// Create a turnstile that will invoke the given operation with each entry
// pushed into the work queue.

//
function Turnstile (options) {
    var vargs = Array.prototype.slice.call(arguments)
    var options = coalesce(vargs.shift(), {})
    var callbackify = function () { return abend }
    if (vargs.length) {
        callbackify = Operation(vargs)
    }
    this.destroyed = false
    this._counter = 0xffffffff
    this._callbackify = callbackify
    this._vargs = vargs
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.health = {
        occupied: 0,
        waiting: 0,
        rejecting: 0,
        turnstiles: coalesce(options.turnstiles, 1)
    }
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
        started: coalesce(envelope.started, abend),
        completed: coalesce(envelope.completed, abend),
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
    if (!this.destroyed) {
        if (this.health.waiting && this.health.occupied < this.health.turnstiles) {
            this._stack('occupied', '_stopWorker')
        } else if (this.health.waiting && !this.health.rejecting && this._Date.now() - this._head.next.when >= this.timeout) {
            this._stack('rejecting', '_stopRejector')
        }
    }
}

Turnstile.prototype._stopWorker = function () {
    return this.destroyed || this.health.waiting == 0
}

Turnstile.prototype._stopRejector = function () {
    return this.destroyed
        || this.health.waiting == 0
        || this._Date.now() - this._head.next.when <= this.timeout
}

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    var severed = ! this.setImmediate
    async([function () {
        async([function () {
            this.health[counter]--
        }], function () {
            this.health[counter]++
        }, function () {
            var loop = async(function () {
                if (this[stopper]()) {
                    return [ loop.break ]
                }
                var task = this._head.next
                this._head.next = task.next
                this._head.next.previous = this._head
                this.health.waiting--
                task.started.call(null)
                async(function () {
                    if (!severed) {
                        severed = true
                        setImmediate(async()) // <- price, we only pay it to start work.
                    }
                }, [function () {
                    var waited = this._Date.now() - task.when
                    task.method.call(task.object, {
                        module: 'turnstile',
                        method: 'enter',
                        when: task.when,
                        waited: waited,
                        timedout: waited >= this.timeout,
                        body: task.body
                    }, async())
                }, function (error) {
                    task.completed.call(null, error)
                    return [ loop.continue ]
                }], [], function (vargs) {
                    task.completed.apply(null, [ null ].concat(vargs))
                })
            })()
        })
    }, function (error) {
        this.destroyed = true
        throw error
    }])
})

Turnstile.prototype._stack = function (name, stopper) {
    if (this._counter == 0xffffffff) {
        this._counter = 0
    } else {
        this._counter++
    }
    var callback = this._callbackify.apply(null, this._vargs.concat([ this._counter ]))
    this._work(name, stopper, callback)
}

module.exports = Turnstile

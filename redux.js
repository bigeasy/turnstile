// Control-flow utilities.
var cadence = require('cadence')
var abend = require('abend')

// Return the first not null-like value.
var coalesce = require('extant')

// Do nothing.
var noop = require('nop')

var Interrupt = require('interrupt').createInterrupter('turnstile')

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
    this.errors = []
    this.health.occupied = 0
    this.health.waiting = 0
    this.health.rejecting = 0
    this.timeout = coalesce(options.timeout, Infinity)
    this._Date = coalesce(options.Date, Date)
}

// TODO If you do want to drain, maybe push some sort of special drain work onto
// the queue.
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
        this._stack('occupied', false)
    } else if (this.health.rejecting == 0 && now >= this._head.next.timesout) {
        console.log('no start enter ---> ', this._head.next.body)
        this._stack('rejecting', true)
    } else {
        console.log('no start enter')
    }
}

Turnstile.prototype._work = cadence(function (async, counter, rejector) {
    // We increment and decrement a counter based on whether we're working
    // through tasks or rejecting them because they've expired.
    async([function () {
        this.health[counter]--
    }], function () {
        this.health[counter]++
    }, function () {
        var canceled = false
        var errored = async([function () {
            // Work through the work in the queue.
            var loop = async(function () {
                var now = this._Date.now()
                // Loop exit.
                if (
                    this.health.waiting == 0 ||
                    (
                        rejector
                        && this._head.next.timesout >= now
                    )
                ) {
                    return [ errored.break ]
                }
                // Shift a task off of the work queue.
                var task = this._head.next
                this._head.next = task.next
                this._head.next.previous = this._head
                this.health.waiting--
                // Run the task and mark it as completed if it succeeds.
                var timedout = task.timesout <= now
                console.log('now', counter, now)
                var waited = now - task.when
                canceled = this.destroyed || timedout
                async(function () {
                    task.method.call(task.object, {
                        module: 'turnstile',
                        method: 'enter',
                        when: task.when,
                        waited: now - task.when,
                        destroyed: this.destroyed,
                        timedout: timedout,
                        canceled: canceled,
                        body: task.body
                    }, async())
                }, [], function (vargs) {
                    console.log(vargs)
                    vargs.unshift(null)
                    task.completed.apply(null, vargs)
                })
            })()
        }, function (error) {
            if (canceled) {
                throw error
            } else {
                // Mark destroyed.
                this.destroyed = true
                // Save the error for an exception we'd like to raise.
                this.errors.push(error)
            }
        }])()
    })
})

Turnstile.prototype._stack = function (type, reject) {
    var self = this
    this._work(type, reject, function (error) { self._calledback(error) })
}

Turnstile.prototype._calledback = function (error) {
    if (error) {
        // TODO Do you really need `abend`?
        throw new Interrupt('canceled', { causes: [[ error ]] })
    } else if (
        this.destroyed &&
        this.health.waiting == 0 &&
        this.health.occupied == 0 &&
        this.health.rejecting == 0
    ) {
        var listener = [ this._listener, this._listener = abend ][0]
        if (this.errors.length) {
            listener(new Interrupt('error', {
                causes: this.errors.map(function (error) { return [ error ] }),
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

Turnstile.prototype.destroy = function () {
    this.destroyed = true
    this._calledback()
}

module.exports = Turnstile

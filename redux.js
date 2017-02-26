// Control-flow utilities.
var cadence = require('cadence')
var abend = require('abend')

// Common utilities.
var coalesce = require('nascent.coalesce')

// Create bound user callback.
var Operation = require('operation/redux')

// Create a turnstile that will invoke the given operation with each entry
// pushed into the work queue.

//
function Turnstile (operation, options) {
    options || (options = {})
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.health = {}
    this.health.occupied = 0
    this.health.waiting = 0
    this.health.rejecting = 0
    this.health.turnstiles = coalesce(options.turnstiles, 1)
    this.timeout = coalesce(options.timeout, Infinity)
    this._operation = Operation(operation)
    this._Date = coalesce(options.Date, Date)
    this._setImmediate = coalesce(options.setImmediate, true)
}

Turnstile.prototype.reconfigure = function (options) {
    options.turnstiles == null || (this.health.turnstiles = options.turnstiles)
    options.timeout == null || (this.timeout = options.timeout || Infinity)
}

// Push an entry into the work queue along with a callback. The callback is the
// difference between a work queue and a message queue.

//
Turnstile.prototype._enqueue = function (work, callback) {
    var task = {
        when: this._Date.now(),
        body: work,
        callback: callback,
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
}

Turnstile.prototype.enqueue = function (work, callback) {
    this._enqueue(work, callback)
    this._nudge(abend)
}

Turnstile.prototype.push = function (work) {
    this.enqueue(work, abend)
}

Turnstile.prototype._stopWorker = function () {
    return this.health.waiting == 0
}

Turnstile.prototype._stopRejector = function () {
    return this.health.waiting == 0
        || this._Date.now() - this._head.next.when <= this.timeout
}

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    var severed = ! this._setImmediate
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
            async(function () {
                if (!severed) {
                    severed = true
                    setImmediate(async()) // <- price, we only pay it to start work.
                }
            }, [function () {
                this._operation.call(null, {
                    module: 'turnstile',
                    method: 'enter',
                    when: task.when,
                    timedout: this._Date.now() - this._head.next.when > this.timeout,
                    body: task.body
                }, async())
            }, function (error) {
                (task.callback)(error)
                return [ loop.continue ]
            }], [], function (vargs) {
                task.callback.apply(null, [ null ].concat(vargs))
            })
        })()
    })
})

Turnstile.prototype.listen = function (callback) {
    var loop = async(function () {
        this._workers.dequeue(async())
    }, function (worker) {
        async(function () {
            this._queue.dequeue(async())
        }, function (work) {
            worker.work(work)
        })
    })()
}

Turnstile.prototype._nudge = function (callback) {
    if (this.health.waiting && this.health.occupied < this.health.turnstiles) {
        this._work('occupied', '_stopWorker', callback)
    } else if (this.health.waiting && !this.health.rejecting && this._Date.now() - this._head.next.when > this.timeout) {
        this._work('rejecting', '_stopRejector', callback)
    } else {
        callback()
    }
}

module.exports = Turnstile

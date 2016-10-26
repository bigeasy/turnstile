var cadence = require('cadence')
var Operation = require('operation')

function immediate (callback) {
    callback()
}

function Turnstile (options) {
    options || (options = {})
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.health = {}
    this.health.occupied = 0
    this.health.waiting = 0
    this.health.rejecting = 0
    this.health.turnstiles = options.turnstiles || 1
    this.timeout = options.timeout || Infinity
    this._Date = options.Date || Date
    this._setImmediate = options.immediate ? immediate : setImmediate
}

Turnstile.prototype.reconfigure = function (options) {
    options.turnstiles == null || (this.health.turnstiles = options.turnstiles)
    options.timeout == null || (this.timeout = options.timeout || Infinity)
}

Turnstile.prototype.enter = function (operation, vargs, callback) {
    var task = {
        when: this._Date.now(),
        operation: new Operation(operation),
        vargs: vargs,
        callback: callback,
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.health.waiting++
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
    var severed = false
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
                    this._setImmediate.call(null, async()) // <- price, we only pay it to start work.
                }
            }, [function () {
                task.operation.apply([{
                    turnstile: this,
                    timedout: this._Date.now() - task.when > this.timeout,
                    when: task.when
                }].concat(task.vargs, async()))
            }, function (error) {
                (task.callback)(error)
                return [ loop.continue ]
            }], [], function (vargs) {
                task.callback.apply(null, [ null ].concat(vargs))
            })
        })()
    })
})

Turnstile.prototype.nudge = function (callback) {
    if (this.health.waiting && this.health.occupied < this.health.turnstiles) {
        this._work('occupied', '_stopWorker', callback)
    } else if (this.health.waiting && !this.health.rejecting && this._Date.now() - this._head.next.when > this.timeout) {
        this._work('rejecting', '_stopRejector', callback)
    } else {
        callback()
    }
}

module.exports = Turnstile

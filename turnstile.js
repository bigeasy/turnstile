var cadence = require('cadence')

function Turnstile (options) {
    options || (options = {})
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.working = 0
    this.workers = options.workers || 1
    this.waiting = 0
    this.rejecting = 0
    this.timeout = options.timeout || Infinity
    this._Date = options._Date || Date
}

Turnstile.prototype.enter = function (object, method, vargs, callback) {
    var task = {
        when: this._Date.now(),
        object: object,
        method: method,
        vargs: vargs,
        callback: callback,
        previous: this._head.previous,
        next: this._head
    }
    task.next.previous = task
    task.previous.next = task
    this.waiting++
}

Turnstile.prototype._stopWorker = function () {
    return this.waiting == 0
}

Turnstile.prototype._stopRejector = function () {
    return this.waiting == 0
        || this._Date.now() - this._head.next.when <= this.timeout
}

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._work = cadence(function (async, counter, stopper) {
    var severed = false
    async([function () {
        this[counter]--
    }], function () {
        this[counter]++
    }, function () {
        var loop = async(function () {
            if (this[stopper]()) {
                return [ loop.break ]
            }
            var task = this._head.next
            this._head.next = task.next
            this._head.next.previous = this._head
            this.waiting--
            async(function () {
                if (!severed) {
                    severed = true
                    setImmediate(async()) // <- price, we only pay it to start work.
                }
            }, [function () {
                task.method.apply(task.object, [{
                    turnstile: this,
                    timedout: !! (this._Date.now() - task.when),
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
    while (this.waiting && this.working < this.workers) {
        this._work('working', '_stopWorker', callback)
    }
    if (this.waiting && !this.rejecting && this._Date.now() - this._head.next.when > this.timeout) {
        this._work('rejecting', '_stopRejector', callback)
    }
}

module.exports = Turnstile

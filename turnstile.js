var cadence = require('cadence')

function Turnstile (options) {
    options || (options = {})
    this._head = {}
    this._head.next = this._head.previous = this._head
    this.working = 0
    this.workers = options.workers || 1
    this.waiting = 0
}

Turnstile.prototype.enter = function (object, method, vargs, callback) {
    var task = {
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

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._nudge = cadence(function (async) {
    async([function () {
        this.working--
    }], function () {
        this.working++
        setImmediate(async()) // <- price, we only pay it to start work.
    }, function () {
        var loop = async(function () {
            if (this.waiting == 0) {
                return [ loop.break ]
            }
            var task = this._head.next
            this._head.next = task.next
            this._head.next.previous = this._head
            this.waiting--
            async([function () {
                task.method.apply(task.object, task.vargs.concat(async()))
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
        this._nudge(callback)
    }
}

module.exports = Turnstile

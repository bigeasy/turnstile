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
    var work = {
        object: object,
        method: method,
        vargs: vargs,
        callback: callback,
        next: this._head.next,
        previous: this._head
    }
    work.next.previous = work
    work.previous.next = work
    this.waiting++
}

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._nudge = cadence(function (async) {
    async([function () {
        this.working--
    }], function () {
        setImmediate(async()) // <- price, we only pay it to start work.
    }, function () {
        this.working++
        var loop = async(function () {
            if (this.waiting == 0) {
                return [ loop.break ]
            }
            var work = this._head.next
            this._head.next = work.next
            this._head.next.previous = this._head
            this.waiting--
            async([function () {
                work.method.apply(work.object, work.vargs.concat(async()))
            }, function (error) {
                (work.callback)(error)
                return [ loop.continue ]
            }], [], function (vargs) {
                work.callback.apply(null, [ null ].concat(vargs))
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

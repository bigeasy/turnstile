function Buffer (options) {
    this._buffers = {}
    this.turnstile = options.turnstile
    this.groupBy = options.groupBy || function () { return 1 }
}

Buffer.prototype.push = function (object) {
    var key = this.groupBy(object), work
    if (buffer = this._buffers[key]) {
        buffer.value.push(object)
    } else {
        this._buffer = buffer = { values: [ object ] }
        this._turnstile.enter(this, this.pop, buffer, key)
    }
}

Buffer.prototype.pop = cadence(function (async, buffer, key) {
    if (this._buffers[key] === buffer) {
        delete this._buffers[key]
    }
    async([function () {
        this.count -= buffer.values.length
    }], [function () {
        this.operation([ buffer.values ], async())
    }, function () {
    }], function () {
    })
})

function Work () {
}

function Turnstile (options) {
    this._head._next = this._head = {}
    this.working = 0
    this.workers = options.workers || 1
    this.waiting = 0
}

Turnstile.prototype.enter = function () {
    var vargs = slice.call(arguments)
    var work = {
        object: vargs.shift(),
        method: vargs.shift(),
        vargs: vargs,
        next: work._head.next,
        previous: work._head
    }
    work.next.previous = work
    work.previous.next = work
}

Turnstile.prototype._nudge = cadence(function (async) {
    async([function () {
        this.working--
    }], function () {
        this.working++
        var loop = async(function () {
            if (!this.waiting) {
                return [ loop ]
            }
            var task = this._head.next
            this._head.next = task.text
            this._head.next.previous = this._head
            async([function () {
                this._attempt(task, async())
            }, function (error) {
                task.callback.call(null, error)
            }], [], function (vargs) {
                task.callback.apply(null, [ null ].concat(vargs))
            })
        })()
    })
})

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._attempt = cadence(function (async, task) {
    async([function () {
        task.finalize()
    }], function () {
        task.run(async())
    })
})

Turnstile.prototype.nudge = function (callback) {
    while (this._source._waiting() && this._source.working < this._source.workers) {
        this._nudge(callback)
    }
}

exports.Turnstile = Turnstile

var cadence = require('cadence/redux'),
    abend = require('abend'),
    eject = require('eject'),
    adhere = require('adhere'),
    Operation = require('operation')

function noop () {}

function done (callback, error) {
    if (error) {
        callback(error)
    } else {
        callback()
    }
}

function Buffer (options) {
    this._buffers = {}
    this.turnstile = options.turnstile
    this.groupBy = options.groupBy || function () { return 1 }
    this._catcher = options.catcher || eject
    this._operation = new Operation(options.operation)
}

Buffer.prototype.write = function (items, callback) {
    var catcher = this._catcher, seen = {}, created = [], buffers = 0, callbacks = 0, fiasco

    callback || (callback = noop)

    var seen = {}

    this.count += items.length

    items.forEach(function (item) {
        var key = this.groupBy(item), buffer

        seen[key] = true

        if (!(buffer = this._buffers[key])) {
            this._buffers[key] = buffer = { values: [], callbacks: [] }
            created.push(key)
        }

        buffer.values.push(item)
    }, this)

    Object.keys(seen).forEach(function (key) {
        var buffer = this._buffers[key]
        buffer.callbacks.push(complete)
        buffers++
    }, this)


    created.forEach(function (key) {
        var buffer = this._buffers[key]
        this.turnstile.enter(this, this._consume, [ key ], function (error) {
            buffer.callbacks.forEach(function (callback) {
                done(callback, error)
            })
        })
    }, this)

    this.turnstile.nudge(abend)

    function complete (error) {
        catcher(error)
        if (error) {
            if (!fiasco) {
                fiasco = new Error('write failure')
                fiasco.errors = []
            }
            fiasco.errors.push(error)
        }
        if (++callbacks == buffers) {
            if (fiasco) {
                callback(fiasco)
            } else {
                callback()
            }
        }
    }
}

Buffer.prototype._consume = cadence(function (async, key) {
    var buffer = this._buffers[key]
    delete this._buffers[key]
    async([function () {
        this.count -= buffer.values.length
    }], function () {
        this._operation.apply([ buffer.values ].concat(async()))
    })
})

exports.Buffer = Buffer

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
        this.working++
        var loop = async(function () {
            if (this.waiting == 0) {
                return [ loop ]
            }
            var work = this._head.next
            this._head.next = work.next
            this._head.next.previous = this._head
            this.waiting--
            async([function () {
                work.method.apply(work.object, work.vargs.concat(async()))
            }, function (error) {
                (work.callback)(error)
                return [ loop() ]
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

exports.Turnstile = Turnstile

exports.method = function (method) {
    return adhere(method, function (object, vargs) {
        object._turnstile.enter(object, method, vargs, vargs.pop())
        object._turnstile.nudge(abend)
    })
}

var slice = [].slice,
    cadence = require('cadence/redux'),
    abend = require('abend')

function noop () { }

function done (callback, error) {
    if (error) {
        callback(error)
    } else {
        callback()
    }
}

function Operation (operation) {
    if (typeof operation == 'function') {
        this.operation = operation
        this.object = null
    } else if (typeof operation.object == 'object') {
        this.object = operation.object
        if (typeof operation.method == 'string') {
            this.operation = function (vargs) {
                this[operation.method].apply(this, vargs)
            }
        } else {
            this.operation = operation.method
        }
    }
}

Operation.prototype.apply = function (vargs) {
    this.operation.apply(this.object, vargs)
}

function Buffer (options) {
    this._buffers = {}
    this.turnstile = options.turnstile
    this.groupBy = options.groupBy || function () { return 1 }
    this._catcher = options.error || abend
    this._operation = new Operation(options.operation)
}

Buffer.prototype.write = function (items, callback) {
    var seen = {}, created = [], buffers = 0, callbacks = 0, fiasco

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
        this.turnstile.enter(this, this._consume, [ buffer, key ], function (error) {
            buffer.callbacks.forEach(function (callback) {
                done(callback, error)
            })
        })
    }, this)

    this.turnstile.nudge(abend)

    function complete (error) {
        if (error) {
            this._catcher(error)
            if (!fiasco) {
                fiasco = new Error('write failure')
                fiasco.errors = []
            }
            fiasco.push(error)
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

Buffer.prototype._consume = cadence(function (async, buffer, key) {
    if (this._buffers[key] === buffer) {
        delete this._buffers[key]
    }
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
                work.callback.call(work.object, error)
                return [ loop() ]
            }], [], function (vargs) {
                work.callback.apply(work.object, [ null ].concat(vargs))
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
    while (this.waiting && this.working < this.workers) {
        this._nudge(callback)
    }
}

exports.Turnstile = Turnstile

exports.method = function (method) {
    var throttle

    // Preserving arity costs next to nothing; the call to `execute` in
    // these functions will be inlined. The airty function itself will never
    // be inlined because it is in a different context than that of our
    // dear user, but it will be compiled.
    switch (method.length) {
    case 0:
        throttle = function () {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            this._turnstile.enter(this, method, vargs, vargs.pop())
            this._turnstile.nudge(abend)
        }
        break
    case 1:
        throttle = function (one) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            this._turnstile.enter(this, method, vargs, vargs.pop())
            this._turnstile.nudge(abend)
        }
        break
    case 2:
        throttle = function (one, two) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            this._turnstile.enter(this, method, vargs, vargs.pop())
            this._turnstile.nudge(abend)
        }
        break
    case 3:
        throttle = function (one, two, three) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            this._turnstile.enter(this, method, vargs, vargs.pop())
            this._turnstile.nudge(abend)
        }
        break
    case 4:
        throttle = function (one, two, three, four) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            this._turnstile.enter(this, method, vargs, vargs.pop())
            this._turnstile.nudge(abend)
        }
        break
    default:
        // Avert your eyes if you're squeamish.
        var args = []
        for (var i = 0, I = steps[0].length; i < I; i++) {
            args[i] = '_' + i
        }
        var throttle = (new Function('method', '                            \n\
            return function (' + args.join(',') + ') {                      \n\
                var vargs = new Array                                       \n\
                for (var i = 0, I = arguments.length; i < I; i++) {         \n\
                    vargs.push(arguments[i])                                \n\
                }                                                           \n\
                this._turnstile.enter(this, method, vargs, vargs.pop())     \n\
                this._turnstile.nudge(abend)                                \n\
            }                                                               \n\
       '))(method)
    }

    throttle.toString = function () { return method.toString() }

    return throttle
}

var slice = [].slice,
    cadence = require('cadence/redux')

function abend (error) { if (error) throw error }

function TurnstileFactory (catcher) {
    this._catcher = catcher
}

TurnstileFactory.prototype.queue = function (f, workers) {
    var vargs = slice.call(arguments)
    var name = typeof vargs[0] === 'string' ? vargs.shift() : null
    var object = typeof vargs[0] === 'object' ? vargs.shift() : null
    var f = vargs.shift()
    var workers = vargs.shift() || 1
    return new Queue(this._catcher, name, object, f, workers)
}

TurnstileFactory.prototype.buffer = function (chunkSize, f) {
    var vargs = slice.call(arguments)
    var name = typeof vargs[0] === 'string' ? vargs.shift() : null
    var chunkSize = typeof vargs[0] === 'number' ? vargs.shift() : Infinity
    var object = typeof vargs[0] === 'object' ? vargs.shift() : null
    var f = vargs.shift()
    var workers = vargs.shift() || 1
    return new Buffer(this._catcher, name, object, f, chunkSize, workers)
}

TurnstileFactory.prototype.throttle = function (options) {
    var vargs = slice.call(arguments)
    var workers = typeof vargs[0] === 'number' ? vargs.shift() : 1
    var object = typeof vargs[0] === 'object' ? vargs.shift() : null
    var method = vargs.shift()
    var f = typeof method === 'string'
          ? function () { this[method].apply(this, slice.call(arguments)) }
          : method
    var callback = typeof vargs[0] === 'function' ? vargs.shift() : this._catcher
    return new Throttle(workers, object, f, callback, vargs)
}

function Throttle (workers, object, f, callback, vargs) {
    this._callback = callback
    this._vargs = vargs
    this.count = 0
    this.waiting = 0
    this.workers = workers
    this.working = 0
    this._next = this._previous = this
    this._turnstile = new Turnstile(this, object, f)
}

Throttle.prototype._decrement = function (work) {
    this.count--
    this.working--
}

Throttle.prototype._shift = function () {
    // Unlink a task.
    var task = this._previous
    this._previous = task._previous
    this._previous._next = this
    // Adjust waiting to working.
    this.waiting--
    this.working++
    return task
}

Throttle.prototype.enqueue = function () {
    var vargs, task = {
        vargs: vargs = slice.call(arguments),
        callback: this._catcher,
        _next: this._next,
        _previous: this
    }
    if (typeof vargs[vargs.length - 1] === 'function') {
        task.callback = vargs.pop()
    }
    task._next._previous = task
    task._previous._next = task
    this.waiting++
    this.count++
    this._turnstile.nudge()
}

function Queue (catcher, name, object, f, workers) {
    this._catcher = catcher
    this._name = name
    this._object = object
    this._f = f
    this.count = 0
    this.waiting = 0
    this.workers = workers
    this.working = 0
    this._next = this._previous = this
}

Queue.prototype.enqueue = function () {
    var vargs, task = {
        vargs: vargs = slice.call(arguments),
        callback: null,
        _next: this._next,
        _previous: this
    }
    if (typeof vargs[vargs.length - 1] === 'function') {
        task.callback = vargs.pop()
    }
    task._next._previous = task
    task._previous._next = task
    this.waiting++
    this.count++
    this.nudge()
}

Queue.prototype.nudge = function () {
    var queue = this
    if (queue.waiting && queue.working < queue.workers) {
        // Unlink a task.
        var task = queue._previous
        queue._previous = task._previous
        queue._previous._next = queue
        // Adjust waiting to working.
        queue.waiting--
        queue.working++
        // Attempt to execute the task.
        queue._attempt(task.vargs, function (error) {
            if (error) {
                queue._catcher.call(null, error, false)
            }
            if (task.callback) {
                task.callback.apply(null, slice.call(arguments))
            }
            queue.nudge()
        })
    }
}

// We use Cadence because of its superior try/catch abilities.
Queue.prototype._attempt = cadence(function (async, vargs) {
    async([function () {
        this.working--
        this.count--
    }], function () {
        this._f.apply(this._object, vargs.concat(async()))
    })
})

function Buffer (catcher, name, object, f, chunkSize, workers) {
    this._catcher = catcher
    this._name = name
    this._object = object
    this._f = f
    this._chunkSize = chunkSize
    this.count = 0
    this.waiting = 0
    this.workers = workers
    this.working = 0
    this._next = this._previous = this
    this._add()
}

Buffer.prototype._add = function () {
    var node = {
        items: [],
        callbacks: [],
        _previous: this,
        _next: this._next
    }
    node._next._previous = node
    node._previous._next = node
}

Buffer.prototype.push = function (item, callback) {
    if (this._next.items.length === this._chunkSize) {
        this._add()
    }
    this._next.items.push(item)
    if (callback) {
        this._next.callbacks.push(callback)
    }
    this.waiting++
    this.count++
    this.nudge()
}

Buffer.prototype.nudge = function () {
    var buffer = this
    if (buffer.waiting && buffer.working < buffer.workers) {
        // Unlink a task.
        var task = buffer._previous
        buffer._previous = task._previous
        buffer._previous._next = buffer
        // Adjust waiting to working.
        buffer.waiting -= task.items.length
        buffer.working++
        // Attempt to execute the task.
        buffer._attempt(task.items, function (error) {
            if (error) {
                buffer._catcher.call(null, error, false)
            }
            if (task.callbacks.length) {
                task.callbacks.forEach(function (callback) {
                    callback.apply(null, this)
                }, slice.call(arguments))
            }
            buffer.nudge()
        })
    }
}

// We use Cadence because of its superior try/catch abilities.
Buffer.prototype._attempt = cadence(function (async, items) {
    async([function () {
        this.working--
        this.count -= items.length
    }], function () {
        this._f.call(null, items, async())
    })
})

function Turnstile (source, object, f) {
    this._object = object
    this._f = f
    this._source = source
}

Turnstile.prototype.nudge = function () {
    var turnstile = this, source = turnstile._source
    if (source.waiting && source.working < source.workers) {
        var task = source._shift()
        turnstile._attempt(task, function () {
            task.callback.apply(null, slice.call(arguments))
            turnstile.nudge()
        })
    }
}

// We use Cadence because of its superior try/catch abilities.
Turnstile.prototype._attempt = cadence(function (async, task) {
    async([function () {
        this._source._decrement(task)
    }], function () {
        this._f.apply(this._object, task.vargs.concat(async()))
    })
})

module.exports = function (catcher) {
    return new TurnstileFactory(catcher)
}

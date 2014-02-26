var __slice = [].slice
var cadence = require('cadence')
var util = require('util')
var events = require('events')

function Turnstile (options) {
    this._enqueued = {}
    this._queue = []
    this._next = []
    this._error = options.error
    this._pause = options.pause || function (callback) { callback() }
    events.EventEmitter.call(this)
}
util.inherits(Turnstile, events.EventEmitter)

Turnstile.prototype.listener = function (object, method) {
    var turnstile = this
    return function () {
        turnstile._subseqeunt(object, method, __slice.call(arguments), function (error) {
            if (error) throw error
        })
    }
}

Turnstile.prototype._subseqeunt = cadence(function (step, object, method, vargs) {
    step([function () {
        object[method].apply(object, vargs.concat(step()))
    }, function (errors, error) {
        this._catch(errors, error, object, method, vargs)
    }])
})

Turnstile.prototype.enter = function () {
    var events = [ 'through' ], context = null, method, event
    var vargs = __slice.call(arguments)
    if (typeof vargs[0] == 'string') {
        events.unshift(event = vargs.shift())
    }
    if (typeof vargs[0] == 'object') {
        context = vargs.shift()
    }
    if (typeof vargs[0] == 'string') {
        method = context[vargs.shift()]
    } else {
        method = vargs.shift()
    }
    var entry = {
        events: events,
        context: context,
        method: method,
        parameters: vargs
    }
    if (!event || vargs.length || !this._enqueued[event]) {
        if (event && !vargs.length) {
            this._enqueued[event] = true
        }
        this._queue.push(entry)
        if (this._queue.length == 1) {
            this._consume(function (error) {
                if (error) throw error
                this.emit('empty')
            }.bind(this))
        }
    }
    return function (callback) {
        entry.callback = callback
    }
}

Turnstile.prototype._consume = cadence(function (step) {
    step(function () {
        setImmediate(step())
    }, [function () {
        step(function () {
            this._pause(step())
        }, function () {
            return this._queue[0]
        }, function (entry) {
            if (!entry) {
                step(null)
            }
        }, function (entry) {
            step(function () {
                setImmediate(step())
            }, function () {
                if (entry.events.length == 2 && !entry.parameters.length) {
                    delete this._enqueued[entry.events[0]]
                }
                entry.method.apply(entry.context, entry.parameters.concat(step()))
            }, function () {
                return [  __slice.call(arguments) ]
            }, function (result) {
                entry.events.forEach(function (event) {
                    this.emit.apply(this, [ event ].concat(result))
                }, this)
                if (entry.callback) {
                    entry.callback.apply(null, [ null ].concat(result))
                }
            })
        }, function () {
            this._queue.shift()
        })()
    }, function (errors, error) {
        this._catch(errors, error, this._queue.shift())
    }])
})

Turnstile.prototype._catch = function (errors, error, object, method, vargs) {
    try {
        this._error.apply(this, [ error ].concat([ object, method, vargs ]))
    } catch (thrown) {
        if (error !== thrown) {
            errors.push(thrown)
        }
        throw errors
    }
}

module.exports = Turnstile

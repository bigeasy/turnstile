var coalesce = require('extant')
var Operation = require('operation/variadic')
var abend = require('abend')

function Queue () {
    var vargs = Array.prototype.slice.call(arguments)
    this._operation = Operation(vargs)
    this._sets = {}
    this.turnstile = vargs.shift()
}

Queue.prototype._shift = function (envelope, callback) {
    this._operation.call(null, envelope, callback)
}

Queue.prototype.push = function (value) {
    this.enqueue(value, abend)
}

Queue.prototype.enqueue = function (value, callback) {
    this.turnstile.enter({
        object: this,
        method: this._shift,
        body: value,
        completed: callback
    })
}

module.exports = Queue

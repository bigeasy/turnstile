// Control-flow utilities.
var cadence = require('cadence')

// Return the first not null-like value.
var coalesce = require('extant')

// Contextualized callbacks and event handlers.
var Operation = require('operation/variadic')

// Do nothing.
var nop = require('nop')

function checkpoint (envelope, callback) {  callback() }

function Queue () {
    var vargs = Array.prototype.slice.call(arguments)
    this._operation = Operation(vargs)
    this.turnstile = vargs.shift()
}

Queue.prototype.push = function (value) {
    this.turnstile.enter({ method: this._operation, body: value })
}

Queue.prototype.enqueue = function (value, callback) {
    this.turnstile.enter({ method: this._operation, completed: callback, body: value })
}

Queue.prototype.wait = function (callback) {
    this.turnstile.enter({ method: checkpoint, completed: callback })
}

module.exports = Queue

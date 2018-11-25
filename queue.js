// Control-flow utilities.
var cadence = require('cadence')

// Return the first not null-like value.
var coalesce = require('extant')

// Contextualized callbacks and event handlers.
var operation = require('operation')

// Do nothing.
var nop = require('nop')

function checkpoint (envelope, callback) {  callback() }

function Queue () {
    var vargs = operation.vargs.apply(operation, arguments)
    this._operation = vargs.shift()
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

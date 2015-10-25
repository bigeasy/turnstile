var cadence = require('cadence'),
    abend = require('abend'),
    Operation = require('operation')

function noop () {}

function Reservoir (options) {
    this.turnstile = options.turnstile
    this._groupBy = options.groupBy || function () { return 1 }
    this._buffers = {}
    this._operation = new Operation(options.operation)
}

Reservoir.prototype.write = function (items, callback) {
    var catcher = this._catcher, seen = {}, created = [], buffers = 0, callbacks = 0, fiasco

    callback || (callback = noop)

    var seen = {}

    this.count += items.length

    items.forEach(function (item) {
        var key = (this._groupBy)(item), buffer

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
            abend(error)
            buffer.callbacks.forEach(function (callback) { callback() })
        })
    }, this)

    this.turnstile.nudge(abend)

    function complete () {
        if (++callbacks == buffers) {
            callback()
        }
    }
}

Reservoir.prototype._consume = cadence(function (async, key) {
    var buffer = this._buffers[key]
    delete this._buffers[key]
    async([function () {
        this.count -= buffer.values.length
    }], function () {
        this._operation.apply([ buffer.values ].concat(async()))
    })
})

module.exports = Reservoir

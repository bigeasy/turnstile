require('proof')(12, prove)

function prove (assert) {
    function Service () {
        this._database = {}
        this._turnstile = new Turnstile({ workers: 3 })
    }

    Service.prototype.add = turnstile.method(function () {
        this._turnstile.enter(function () {
            this._database.begin(async())
            this._database.add(async())
            this._database.end(async())
        })
    })

    Service.prototype.remove = turnstile.method(cadence(function (async) {
    }))

    var turnstile = new Turnstile({ workers: 3 })
    var buffer = new Buffer({
        key: function (object) { return object.id }
    })

    queue.enter(buffer.push(object))
}

require('proof')(1, prove)

function prove (assert, callback) {
    var turnstile = require('../../redux')()
    var object = {
        method: function (callback) {
            if (this.visited) {
                callback()
            } else {
                this.visited = true
                setTimeout(callback, 0)
            }
        }
    }
    var throttle = turnstile.throttle({
        procedure: { object: object, method: 'method' }
    })
    for (var i = 0; i < 50000; i++) {
        throttle.enqueue()
    }
    throttle.enqueue(function () {
        assert(true, 'no overflow')
        callback()
    })
}

require('proof')(1, prove)

function prove (assert) {
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
    var throttle = turnstile.throttle(object, 'method')
    for (var i = 0; i < 50000; i++) {
        throttle.enqueue()
    }
    throttle.enqueue(function () {
        assert(true, 'no overflow')
    })
}

var __slice = [].slice

module.exports = function (guarded, procedure, subsequent) {
    var running, waiting, value, callbacks = { queue: [] }
    function run (callback) {
        if (callback) {
            callbacks.queue.push(callback)
        }
        if (!running) {
            running = true
            callbacks.next = callbacks.queue.splice(0, callbacks.queue.length)
            value = guarded()
            if (subsequent) {
                callbacks.next.unshift(subsequent)
            }
            try {
                procedure(value, function () {
                    var vargs = __slice.call(arguments)
                    running = false
                    callbacks.next.splice(0, callbacks.next.length).forEach(function (callback) {
                        callback.apply(null, vargs)
                    })
                    if (waiting) {
                        waiting = false
                        run()
                    }
                })
            } catch (error) {
                running = false
                if (callbacks.next.length) {
                    callbacks.next.forEach(function (callback) { callback.call(null, error) })
                } else {
                    throw error
                }
            }
        } else {
            waiting = true
        }
    }
    return run
}

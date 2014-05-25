module.exports = function (procedure, subsequent) {
    var running, waiting, callbacks = []
    function run (callback) {
        if (callback) {
            callbacks.push(callback)
        }
        if (!running) {
            running = true
            try {
                procedure(function () {
                    running = false
                    subsequent.apply(null, arguments)
                    while (callbacks.length) {
                        callbacks.shift().apply(null, arguments)
                    }
                    if (waiting) {
                        waiting = false
                        run()
                    }
                })
            } catch (e) {
                running = false
                subsequent(e)
            }
        } else {
            waiting = true
        }
    }
    return run
}

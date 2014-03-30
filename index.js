module.exports = function (procedure, subsequent) {
    var running, waiting
    function run () {
        if (!running) {
            running = true
            try {
                procedure(function () {
                    running = false
                    subsequent.apply(null, arguments)
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

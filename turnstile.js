var slice = [].slice,
    cadence = require('cadence')

function Turnstile (nudge) {
    this.nudge = nudge
    this.workers = 1
    this.working = 0
}

module.exports = function (source, transform, sink) {
    var turnstile = new Turnstile(nudge)

    var worker = cadence(function (async, work) {
        turnstile.working++
        async([function () {
            turnstile.working--
        }], function () {
            transform(work, async())
        })
    })

    function nudge () {
        if (turnstile.working >= turnstile.workers) return
        var work = source()
        if (work) {
            worker(work, function () {
                sink.apply(null, slice.call(arguments))
                turnstile.nudge()
            })
        }
    }

    return turnstile
}

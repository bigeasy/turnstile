require('proof')(3, require('cadence/redux')(prove))

function prove (async, assert) {
    var turnstile = require('../../sketch')

    function Service () {
        this._turnstile = new turnstile.Turnstile
    }

    Service.prototype.immediate = turnstile.method(function (value, callback) {
        callback(null, value)
    })

    Service.prototype.delayed = turnstile.method(function (value, callback) {
        setImmediate(callback, null, value)
    })

    var service = new Service

    /*
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
        key: function (object) { return object.id },
        consumer: cadence(function (async, items) {
            async([function () {
            }, function () {
                return false
            }], function () {
                return true
            })
        }),
        catcher: abend
    })
    */

    var consumed = false
    var buffer = new turnstile.Buffer({
        turnstile: new turnstile.Turnstile({ workers: 1 }),
        operation: function (values, callback) {
            consumed = true
            assert(values, [ 1, 2, 3 ], 'queued')
            callback()
        }
    })

    // What does the callback to the enqueuing mean? Can it report an error? If
    // it where the case that the entire set of items was to be handled by a
    // single invocation of the worker, then yes, the worker could report an
    // error, but we are first grouping the work by by a chunk size, so right
    // there the callback comes apart. Some portion of these items are processed
    // in one call, the rest are processed in another. If the first call
    // produces an error, which error gets reported?
    //
    // Error first-callbacks fall down in the face of this sort of parallelism.
    //
    // It may be the case that the caller should not proceed until the work is
    // done, however, what exactly is that case? If we depend on this write of
    // work to complete, then if there is an error, we're going to need to know,
    // but that's weird. We're saying, do all this work, then I'll know to
    // continue to do what it is I have to do. If any of that work cannot be
    // done, I can't do what I have to do, so I won't do it.
    //
    // This becomes easier when there is some sort of multi-error, one what has
    // one or more causes, and yes, I've been here before with Cadence, and it
    // wasn't pretty and I walked back from it.
    //
    // The next question becomes, what sort of error could be recoverable at
    // this point, so that error handling is meaningful? Do we want to report
    // the errors that the work generates, or do we simply want to report that
    // the worker failed in some way? We can simply report some sort of write
    // error, and we can guarantee that it will always be an error of a single
    // type, that is, that we're not going to pass on the error thrown by the
    // worker, and in fact, at this point, we can guarantee that there will be an
    // error array, since this is not cadence.
    //
    // In Cadence, gathering up errors is a problem because the default action
    // is to throw the error, which is going to give you a stack trace that does
    // the right thing. Once you're writing documentation about how you've
    // created this new, better, smarter exception, and explaining it a lot.
    //
    // But here, that exception is a given. It didn't work in Cadence without
    // being too clever, because if there is only one async operation then we
    // don't want an array of exceptions, do we detect, pass both the array and
    // the first exception, what gets reported when we throw. I'm happy with how
    // that sorted out.

    async(function () {
        buffer.write([ 1, 2, 3 ], async())
    }, function () {
        assert(consumed, 'done')
        service.delayed(1, async())
        service.delayed(2, async())
        service.immediate(3, async())
    }, function (one, two, three) {
        assert([ one, two, three ], [ 1, 2, 3 ], 'service')
    })
}

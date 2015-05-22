require('proof')(12, prove)

function prove (assert) {
    var turnstile = require('../../redux')
    var factory = turnstile(function () {})
    var object = {}, queue, buffer
    queue = factory.queue(function () {}, 2)
    assert(queue.workers, 2, 'set queue workers')
    queue = factory.queue('queue', object, function (one, two, three, callback) {
        assert([ one, two, three ], [ 1, 2, 3 ], 'compare')
        assert(object === this, 'context set')
        callback()
    })
    queue.enqueue(1, 2, 3)
    queue = factory.queue(object, function (callback) {
        throw new Error('test')
    })
    queue.enqueue(function (error) {
        assert(error.message, 'test', 'queue error')
    })
    buffer = factory.buffer(function () {}, 2)
    assert(buffer.workers, 2, 'set buffer workers')
    var chunks = []
    buffer = factory.buffer('buffer', 3, object, function (values, callback) {
        chunks.push(values)
        callback()
    })
    buffer.workers = 0
    for (var i = 0; i < 4; i++) {
        buffer.push(i)
    }
    buffer.workers = 1
    buffer.nudge()
    assert(chunks[0].length, 3, 'buffer limit')
    assert(chunks[1].length, 1, 'buffer remainder')
    buffer = factory.buffer(3, object, function (values, callback) {
        throw new Error('test')
    })
    buffer.push(1, function (error) {
        assert(error.message, 'test', 'buffer error')
    })
    var throttle = factory.throttle(3, object, 'method', function (error) {
        assert(error.message, 'throttle', 'throttle error')
    })
    object.method = function (a, callback) {
        assert(a, 1, 'throttle called')
        callback(null, 2)
    }
    assert(throttle.workers, 3, 'throttle workers')
    throttle.enqueue(1, function (error, result) {
        assert(result, 2, 'throttle called back')
    })
    // test a healthy monkey doodle.
    object.shift = function () {
        return this.items.length && [ this.items.splice(0, this.items.length) ]
    }
    object.items = [ 1 ]
    object.consume = function (items, callback) {
        assert(items, [ 1 ], 'consumer called')
        callback(null, items)
    }
    var consumer = factory.consumer(3, object, 'shift', 'consume', function (error) {
    })
    consumer.nudge()
}

require('proof')(8, prove)

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
}

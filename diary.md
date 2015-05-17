# Diary

Thoughts on turnstile. First, it ought to be simple, with minimal back-off
logic, since we if we really cared about backing off we'd use a real event
queue.

```javascript
var turnstile = new Turnstile.batch(cadence(function (step, values, attept) {
    step(function (value) {
        ua.post({ body: value }, step())
    })(values)
}), function (error) {
    if (error) throw error
})
turnstile.enqueue({ value: 1 }, step())
turnstile.enqueue({ value: 1 })
```
Gets to clever and ugly. Let's let turnstile be a builder? Or just an object
with properties. We don't need to fetishize it.

```javascript
var turnstile = new Turnstile
turnstile.batch(cadence(function (step, values) {
    step([function () {
        ua.post({ body: values }, step())
    }, function (_, error) {
        console.log(error)
        throw errors
    }])
}))
turnstile.enqueue({ value: 1 })
trunstile.retry(function (values, attempt) {
    if (turnstile.length) {
    }
})

Database.prototype.insert = cadence(function (step, value) {
    step(function () {
        this.insert(step())
    }, function (success) {
        if (success) {
            this.compact()
        }
        return success
    })
})
```

Thoughts on an API that also provides a universal sink.

```
var turnstile = createTurnstile(function (error, context) {
    if (context == 'fatal') {
        throw error
    } else {
        console.log({ context: context, stack: error.stack })
    }
})

turnstile(256, function (value, callback) {
})
turnstile(function (values, callback) {
}).push(1)
turnstile(function () {
}, function () {
})

// so maybe one more construction step...

// queued and one at a time.
turnstile.invoke(function () {
}, function (value, callback) {
})

// no queueing.
var queue = turnstile.immediate(function (value, callback) {
})
// queued and one at a time.
turnstile.queue(function (value, callback) {
})

// queued with a maximum of 256 at a time.
turnstile.queue(256, function (values, callback) {
})

// run in background
turnstile.once(function (callback) {
})
turnstile.daemon(3000, function (callback) {
})

turnstile.push.bind(turnstile)

var turnstylist = new Turnstylist(function (error, context) {
})
turnstylist.createTurnstile(function () {
    return true
}, function (value, callback) {
    foo
}, 'fatal')
```

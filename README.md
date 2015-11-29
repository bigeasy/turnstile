[![Build Status](https://travis-ci.org/bigeasy/turnstile.svg?branch=master)](https://travis-ci.org/bigeasy/turnstile) [![Coverage Status](https://coveralls.io/repos/bigeasy/turnstile/badge.svg?branch=master&service=github)](https://coveralls.io/github/bigeasy/turnstile?branch=master)

Turnstile is part of the [Cadence](https://github.com/bigeasy/cadence) Universe.
It is a work queue primitive that feeds work into an error first callback. This
is how I do parallel operations, in an orderly fashion;

 * with a runtime adjustable limit on the number of concurrent operations,
 * with a fifo queue that can be measured and monitored instead of using the
 event loop as an implicit queue,
 * with a mechanism to actively time out messages in the queue that have grown
 stale.

Without a queue, parallelism is unmanagable.

You need to create an object or function that will do your work

```
function Service (processor) {
    this._processor = processor
}

Serivce.prototype.serve = function (status, value, callback) {
    if (status.timedout) {
        console.log('timed out: ' + value)
        callback()
    }  else {
        this._processor.process(value, callback)
    }
}
```

If your work has timed out, return as soon as possible. Otherwise, do your work.

You use the queue in this way.

```javascript
var service = new Service
var turnstile = new Turnstile
turnstile.enter({ object: service, method: 'serve' }, [ 'arg' ], function (error) {
    if (error) throw error
})
turnstile.nudge(function (error) {
    if (error) throw error
})
```

The work enters the turnstile using `Turnstile.enter`. It is an operation to
perform, the argumentst to pass, and a callback when the operation completes.

This work gets added to the work queue.

We then call `Turnstile.nudge`. If there is no event loops reading the queue, a
new event loop is started that will call the callback when it completes. If
there is an event loop running, then the callback is called immediately.

Key to the effective use of Tunstile is knowing that you are supposed to panic
when a `nudge` returns an error. It is not a good place to handle an error. You
should handle all errors in the context of the operation.

If you do want to recover or log the error and continue with the next task, you
should recover in the operation. You should not allow your error to turn the
corner and arrive in `nudge` error handler.

If you are using Cadence, you can create a try/catch block in your operation and
recover there. This is how I design my libraries, to use the robust try/catch of
Cadence, instead of having myriad, context-lossy error event handlers.

Without Cadennce (or Streamline.js) this can be hard to sort out. Try using
[Restrictor](https://github.com/bigeasy/restrictor) or
[Reactor](https://github.com/bigeasy/reactor) for higher-level, yet still as
performant, implementations that will do everything right, or else go crush your
dreams against object streams or other nonsense.

#### `new Turnstile(options)`

Create a new `Turnstile` where `options` can be.

 * `workers` &mdash; optional count of workers, defaults to `1`.
 * `timeout` &mdash; optional timeout, defaults to `Infinity`.
 * `Date` &mdash; optional `Date` implemenation that should implement
 `Date.now`. (Used for unit testing your timeouts.)

#### turnstile.enter(operation, vargs, callback)

Add work to the `Turnstile`.

 * `operation` &mdash; The operation to perform, either a function or an object
 with an `object` and `method` property.
 * `vargs` &mdash; The argumetns to pass to the operation.
 * `callback` &mdash; The required error-first callback to call when the
 operation is done.

#### turnstile.nudge(callback)

Start an event loop if there is work to do and the number of working event loops
is less than the maximum number of event loops. If there end of the queue
contains work that has trimed out, a special rejector event loop will work
through the timed out events.

#### turnstile.waiting

The number of items waiting in the work queue.

#### turnstile.working

The number of currently running concurrent loops.

#### turnstile.workers

The number of currently running concurrent loops.

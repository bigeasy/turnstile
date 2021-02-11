// Return the first not null-like value.
const { coalesce } = require('extant')

class Queue {
    constructor (turnstile, method, object) {
        this.turnstile = turnstile
        this._method = method
        this._object = coalesce(object)
    }

    push (value, ...vargs) {
        this.turnstile.enter($ => $(), { value }, this._method, this._object)
    }

    enqueue (value, ...vargs) {
        return new Promise(resolve => {
            this.turnstile.enter($ => $(), { value }, async entry => {
                resolve(await this._method.call(this._object, entry))
            })
        })
    }
}

module.exports = Queue

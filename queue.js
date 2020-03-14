// Return the first not null-like value.
const coalesce = require('extant')

class Queue {
    constructor (turnstile, method, object) {
        this.turnstile = turnstile
        this._entry = { method, object: coalesce(object) }
    }

    push (value) {
        this.turnstile.enter({ ...this._entry, body: value })
    }

    enqueue (value) {
        return new Promise(resolve => {
            this.turnstile.enter({
                method: async (entry) => {
                    resolve(await this._entry.method.call(this._entry.object, entry))
                },
                body: value
            })
        })
    }
}

module.exports = Queue

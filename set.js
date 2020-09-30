const coalesce = require('extant')

class Set {
    constructor (turnstile, method, object) {
        this.turnstile = turnstile
        this._method = method
        this._object = coalesce(object)
        this._set = new Map
    }

    add (key, ...vargs) {
        let set = this._set.get(key)
        if (set == null) {
            set = this._set.set(key, {
                key: key,
                promise: new Promise(resolve => {
                    this.turnstile.enter({
                        method: async entry => {
                            this._set.delete(key)
                            resolve(await this._method.call(this._object, entry))
                        },
                        body: key,
                        vargs
                    })
                })
            })
        }
        return set.promise
    }
}

module.exports = Set

const Turnstile = { Set: require('./set') }

class Check {
    constructor (turnstile, method, object) {
        this._set = new Turnstile.Set(turnstile, async function (entry) {
            return await method.call(this, {
                when: entry.when,
                waited: entry.waited,
                timedout: entry.timedout,
                destroyed: entry.destroyed,
                vargs: entry.vargs
            })
        }, object)
        this.turnstile = this._set.turnstile
    }

    check (...vargs) {
        return this._set.add.apply(this._set, [ 'check' ].concat(vargs))
    }
}

module.exports = Check

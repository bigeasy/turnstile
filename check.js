const Turnstile = { Set: require('./set') }

class Check {
    constructor (turnstile, method, object) {
        this._set = new Turnstile.Set(turnstile, async function (entry) {
            return await method.call(this, {
                when: entry.when,
                waited: entry.waited,
                timedout: entry.timedout,
                canceled: entry.canceled
            })
        }, object)
        this.turnstile = this._set.turnstile
    }

    check (callback) {
        return this._set.add('check')
    }
}

module.exports = Check

class Decorator {
    constructor (turnstile, interceptor) {
        this._turnstile = turnstile
        this._interceptor = interceptor
    }

    get health () {
        return this._turnstile.health
    }

    enter (method, body, ...vargs) {
        const when = typeof vargs[vargs.length - 1] == 'number' ? vargs.pop() this._Date.now()
        const object = coalesce(vargs.pop())
        this._turnstile.enter(async (body, state) => {
            this.interceptor.start(body, state)
            this.interceptor.end(body, await method.call(this, body), state)
        }, body, object, vargs)
    }
}

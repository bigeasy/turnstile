function Drain (waiting, head, failures) {
    this._head = head
    this._failures = failures
    this.count = waiting + failures.length
}

Drain.prototype.shift = function () {
    if (this._failures.length) {
        return this._failures.shift()
    }
    if (this._head.next === this._head) {
        return null
    }
    var task = this._head.next
    this._head.next = task.next
    this._head.next.previous = this._head
    this.count--
    return {
        module: 'turnstile',
        error: task.error,
        when: task.when,
        body: task.body
    }
}

module.exports = Drain

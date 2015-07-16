function Operation (operation) {
    if (typeof operation == 'function') {
        this.operation = operation
        this.object = null
    } else if (typeof operation.object == 'object') {
        this.object = operation.object
        if (typeof operation.method == 'string') {
            this.operation = function (vargs) {
                this[operation.method].apply(this, vargs)
            }
        } else {
            this.operation = operation.method
        }
    }
}

Operation.prototype.apply = function (vargs) {
    this.operation.apply(this.object, vargs)
}

module.exports = Operation

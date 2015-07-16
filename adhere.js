module.exports = adhere

function adhere (method, wrapper) {
    var adherence

    // Preserving arity costs next to nothing; the call to `execute` in
    // these functions will be inlined. The airty function itself will never
    // be inlined because it is in a different context than that of our
    // dear user, but it will be compiled.
    switch (method.length) {
    case 0:
        adherence = function () {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            wrapper(this, vargs)
        }
        break
    case 1:
        adherence = function (one) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            wrapper(this, vargs)
        }
        break
    case 2:
        adherence = function (one, two) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            wrapper(this, vargs)
        }
        break
    case 3:
        adherence = function (one, two, three) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            wrapper(this, vargs)
        }
        break
    case 4:
        adherence = function (one, two, three, four) {
            var vargs = new Array
            for (var i = 0, I = arguments.length; i < I; i++) {
                vargs.push(arguments[i])
            }
            wrapper(this, vargs)
        }
        break
    default:
        // Avert your eyes if you're squeamish.
        var args = []
        for (var i = 0, I = steps[0].length; i < I; i++) {
            args[i] = '_' + i
        }
        var adherence = (new Function('wrapper', '                          \n\
            return function (' + args.join(',') + ') {                      \n\
                var vargs = new Array                                       \n\
                for (var i = 0, I = arguments.length; i < I; i++) {         \n\
                    vargs.push(arguments[i])                                \n\
                }                                                           \n\
                wrapper(this, vargs)                                        \n\
            }                                                               \n\
       '))(wrapper)
    }

    adherence.toString = function () { return method.toString() }

    return adherence
}

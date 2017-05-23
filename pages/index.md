Look at the [Docco](./docco/) for now.

Ascension is a comparator builder. It builds comparators for composite keys. I
created it because I find myself writing this function over and over again.

```javascript
function compare (left, right) {
    var compare = left.lastName < right.lastName
                ? -1 : left.lastName > right.lastName
                     ? 1 : 0
    if (compare != 0) {
        compare = left.lastName < right.lastName
                ? -1 : left.lastName > right.lastName
                     ? 1 : 0
    }
    return compare
}
```

Not last name first specifically, but that sort of compare these properties and
if they're equal, then compare those properties.

What I really don't like about these comparators is having to unit test these
functions because they're usually not directly accessible to the code, so I have
to expose them for unit testing or else set up and tear down more complicated
tests to tickle each branch with different values.

With Ascension the comparator is declarative.

```javascript
var comparator = ascension([ String, String ], function (object) {
    return [ object.lastName, object.firstName ]
})
```

Now the comparator only needs to be invoked once in a unit test to get complete
coverage.

The first argument is an array with comparator methods for each member of the
composite key. The second argument is a method that returns an array that
contains the members of the composite key.

Heres an example with a single field key.

```javascript
var comparator = ascension([ function (left, right) { return left - right } ], function (object) {
    return [ object.createdAt ]
})
```

The above can be simplified by using `Numeric` to tell Ascention to use a
default numeric comparator.

```javascript
var comparator = ascension([ Numeric ], function (object) {
    return [ object.createdAt ]
})
```

You can use both `Numeric` and `String` as sigils.

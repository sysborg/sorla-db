# sorla-db
A simple and temporary database focused to use in browser environment that will bring capabilities for other tools that will be launched as soon as possible.

This idea is from our founder #andmarruda that give this idea and alot of this idea are developed by him.

## Installation

```
npm install sorla-db
```

```js
// Node / bundlers
const sorla = require('sorla-db');
// or
import sorla from 'sorla-db';
```

```html
<!-- browser, 9.5 kB: registers window.sorla -->
<script src="https://cdn.jsdelivr.net/npm/sorla-db@1/dist/sorla.min.js"></script>
```

TypeScript declarations are included.

## Development

```
npm install
npm test          # jest
npm run build     # dist/sorla.min.js
```

Prohibited characters $ and .,
$ because is used to call operators and . because uses to search key inside a object's object

## Registering and creating a collection example
```
window.sorla = new sorla();
window.sorla.createDb('tags');
window.sorla.useDb('tags');
window.sorla.db.createCollection('updatedTags');
window.sorla.db.updatedTags.insertMany([
  {
    name: 'Sonia',
    age: 53
  },
  {
    name: 'Anderson',
    age: 36
  }
]);
```

## Inserting documents

`insertOne` stores a **copy** of the document and returns its `_id` (a uuid v4 when the document
has none). `insertMany` validates the whole array first, so an invalid document never leaves the
collection with half of the batch, and returns the ids.

```
const id = window.sorla.db.updatedTags.insertOne({ name: 'Ana', nickname: null });
const ids = window.sorla.db.updatedTags.insertMany([{ name: 'Bia' }, { _id: 'custom', name: 'Caio' }]);
```

- `null` values are allowed, at any depth
- a duplicated `_id` throws
- keys with `$` or `.` throw, at any depth
- values must be cloneable (no functions or DOM nodes)

Documents returned by the collection are read-only: assigning a field throws.

## Reading results

`find()` returns a cursor:

```
const cursor = window.sorla.db.updatedTags.find({ age: { $gte: 18 } });
cursor.length;              // number of documents
cursor.first();             // data of the first one, null when empty
cursor.last();              // data of the last one, null when empty
cursor.toArray();           // plain copies
while(cursor.hasNext()) cursor.next();
```

`findOne()` returns the data of the first matching document, or `null`.

## Sorting

```
window.sorla.db.updatedTags.find({}).sort({ age: -1, name: 1 }).toArray();
```

`1` is ascending and `-1` descending, and `"a.b"` paths work. `sort()` returns the cursor. Values of
different types follow MongoDB's order: missing and null, numbers, strings, objects, arrays,
booleans, dates. Strings compare by code point. Pass a collation to compare by language rules,
using the `Intl.Collator` options:

```
cursor.sort({ name: 1 }, { collation: { locale: 'pt-BR', sensitivity: 'base', numeric: true } });
```

## Paging and projection

```
collection.find({}).sort({ age: 1 }).skip(20).limit(10).toArray();
collection.find({}, { name: 1, age: 1 });   // only name, age and _id
collection.find({}, { name: 1, _id: 0 });   // only name
collection.find({}, { password: 0 });       // everything except password
```

`limit(0)` means no limit. Inclusion and exclusion cannot be mixed (except `_id`), and projection
works on top level fields.

## Updating documents

```
collection.updateOne({ _id: id }, { $set: { 'address.city': 'Recife' }, $inc: { visits: 1 } });
collection.updateMany({ active: false }, { $unset: { token: '' } });
collection.updateOne({ email: 'a@b.c' }, { $set: { name: 'Ana' } }, { upsert: true });
```

| Operator | Effect |
|---|---|
| `$set` | sets fields, creating missing objects of `"a.b"` paths |
| `$unset` | removes fields |
| `$inc` | adds a number (missing fields start at 0) |
| `$push` | appends to an array, `{ $push: { tags: { $each: ['a', 'b'] } } }` appends several |
| `$pull` | removes array items equal to a value, matching a condition (`{ $in: [...] }`) or a sub document (`{ ok: false }`) |

They return `{ matchedCount, modifiedCount, upsertedId }`. Updates are applied to a copy first: if an
operator fails (for example `$inc` on a text field) no document changes. `_id` cannot change. With
`{ upsert: true }`, a document is inserted from the equality conditions of the filter when nothing matches.

`replaceOne(filter, document)` replaces the whole document and keeps its `_id`.

## Deleting and counting

```
collection.deleteOne({ _id: id });         // { deletedCount: 1 }
collection.deleteMany({ age: { $lt: 18 } });
collection.deleteMany({});                 // empties the collection
collection.count();                        // every document
collection.count({ active: true });        // matching documents, without copying them
```

## Change events

```
const off = collection.on('change', event => {
  // event.type: 'insert' | 'update' | 'replace' | 'delete'
  // event.ids, event.documents (copies), event.previous (before update / replace)
});
collection.on('delete', event => console.log(event.ids));
off();
```

`insertMany` and `updateMany` emit one event for the whole operation, and nothing is emitted when nothing
changed. A listener that throws does not undo or interrupt the write.

## Databases and collections

```
sorla.listDatabases();            // ['tags', ...]
sorla.dropDb('tags');
sorla.db.listCollections();       // ['updatedTags', ...]
sorla.db.getCollection('stats');  // any collection, also when its name shadows a method
sorla.db.dropCollection('updatedTags');
sorla.db.getStats();              // { name, documents, collections: [{ name, documents }] }
```

## Find Operators

### $and

The **$and** operator meticulously processes arrays, employing a loop chain mechanism. During this process, it's engineered for efficiency: if it encounters any comparison that yields **false**, it immediately halts the ongoing chain. This intelligent design is aimed at preventing unnecessary computation time, especially when dealing with documents that don't meet the specified condition. It's all about optimizing performance and ensuring swift, precise operations.

### Example

```
const results = window.sorla.db.updatedTags.find({
  $and: [
    {name: 'Anderson'},
    {age: 36}
  ]
});
```

### $or
The **$or** operator processes arrays, emploing a loop chain mechanism. During this process, it~s engineered for efficiency: if it enconters any comparison that yields **true**, it imediately halts
the ongoing chain. The intelligent design is aimed at preventing unnecessary computation time, especially when dealing with documents that the first condition matchs the needs. It's all about optimizing
performance and ensuring swift, precise operations.

### Example

```
const results = window.sorla.db.updatedTags.find({
  $or: [
    {name: 'Anderson'},
    {age: 53}
  ]
});
```

### $not
The **$not** operator processes the queries and invert the bool result, for example if {age: 36} return true for Anderson and false for Sonia then Sonia will be the one who will be returned,
remember about invert the boolean result? Anderson that is true becomes false and Sonia that is false becomes true.

```
const results = window.sorla.db.updatedTags.find({
  age: {
    $not: {$eq: 36}
  }
});
```

### $nor
The **$nor** operator returns the documents that match none of the queries in the array.

```
const results = window.sorla.db.updatedTags.find({
  $nor: [
    {name: 'Anderson'},
    {age: {$lt: 18}}
  ]
});
```

### Nesting logical operators
**$and**, **$or** and **$nor** can be nested at any depth, and every query inside them can mix
fields and other logical operators. This returns everyone aged 30 or more whose name is Sonia
or who lives in A or B:

```
const results = window.sorla.db.updatedTags.find({
  $and: [
    {age: {$gte: 30}},
    {$or: [
      {name: 'Sonia'},
      {city: {$in: ['A', 'B']}}
    ]}
  ]
});
```

### More than one operator per field
A field condition can hold several operators and the document must satisfy all of them,
at the top level or inside any logical operator:

```
const results = window.sorla.db.updatedTags.find({
  $or: [
    {age: {$gte: 30, $lte: 40}},
    {name: 'Anderson'}
  ]
});
```

**$not** inverts the whole condition it wraps: `{age: {$not: {$gte: 30, $lte: 40}}}` returns
the documents whose age is *not* between 30 and 40. It must be used inside a field condition.

### Missing fields and null
A document without the queried field does not match `$eq`, `$gt`, `$in`... but does match
`$ne` and `$nin`, like MongoDB. `null` can be used as a value: `{name: null}`.

Unknown operators and logical operators that do not receive an array throw an error.

### $regex
Matches strings with a regular expression. `$options` takes the flags `i` (case insensitive), `m` and `s`.
A RegExp can be used directly as the value. Array fields match when one of their strings does.

```
const results = window.sorla.db.updatedTags.find({ name: { $regex: '^an', $options: 'i' } });
const same = window.sorla.db.updatedTags.find({ name: /^an/i });
```

### $exists
`{ field: { $exists: true } }` matches documents that have the field, even when it is `null`;
`false` matches documents without it.

### Arrays
Equality is strict: `{ tags: 'dev' }` does not match `tags: ['dev']`. Use `{ tags: { $in: ['dev'] } }`.

## Comparison operators

### $eq
$eq get all the documents that has exactly the same value as requested.
For example if we ask age: { $eq: 53 }, will return one document in this example,
but in general pourpose will return all documents that age is equal than 53.

```
const results = window.sorla.db.updatedTags.find({
  age: { $eq: 36 }
});
```

### $ne
$ne or not equal operator search all lines that doens't have the inputed value.
For example $ne:36, will return 1 line in this example, but for general pourpose will
return all lines that age isn't 36.

```
const results = window.sorla.db.updatedTags.find({
  age: { $ne: 36 }
});
```

### $gt
$gt compares values that is greater than, for example everyone who have age above 20, all the documents will return in this example.
```
const results = window.sorla.db.updatedTags.find({
  age: { $gt: 36 }
});
```

### $gte
$gte compares values that is greater or equal than, for example everyone who have age above 20, all the documents will return in this example.
But if we put there for example greater or equal than 53, will return only one document.
```
const results = window.sorla.db.updatedTags.find({
  age: { $gte: 36 }
});
```

### $lt
$lt compares values that is smaller than, for example everyone who have age smaller than 30, in the documents in this example will return no one,
because no one has age smaller than 30.
```
const results = window.sorla.db.updatedTags.find({
  age: { $lt: 30 }
});
```

### $lte
$lte compares values that is smaller or equal than, for example veryone who have age smaller then 36, in the documents in this example will return one,
because Anderson has age of 36 that is equal 36, remember smaller or equal.
```
const results = window.sorla.db.updatedTags.find({
  age: { $lte: 36 }
});
```

### $in
$in operator compares if any value inside an array exists, like in operator in SQL, i will add a exemplo here that will return only one document.
Will return Anderson because age 36 exists is in array object.
```
const results = window.sorla.db.updatedTags.find({
  age: { $in: [36, 44]}
});
```

### $nin
$nin operator is opposite of $in operator, returns only documents that the values doesn't match with any of the query.
This will result in a total of 0 documents.
```
const results = window.sorla.db.updatedTags.find({
  age: { $nin: [36, 53]}
});
```
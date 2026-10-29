# Querying

Queries are objects in the MongoDB query language. `find(query)` returns a [cursor](05-cursors.md),
`findOne(query)` the first match, and `count(query)` the number of matches.

```js
people.find({ city: 'Recife', age: { $gte: 18 } });
people.findOne({ email: 'ana@example.com' });
people.count({ active: true });
people.find({});                       // everything
```

The examples on this page use this collection:

```js
const app = new sorla();
app.useDb('docs');
app.db.createCollection('people');
const people = app.db.people;
people.insertMany([
  { _id: 1, name: 'Ana',   age: 31, city: 'Recife',   tags: ['dev', 'ops'], address: { zip: '50000-000' } },
  { _id: 2, name: 'Bruno', age: 17, city: 'Curitiba', tags: ['design'] },
  { _id: 3, name: 'Carla', age: 45, city: 'Recife',   tags: [], manager: null },
  { _id: 4, name: 'Davi',  age: 28, city: 'São Paulo' }
]);
```

## find

```js
people.find(query, projection?)   // → Cursor
```

The cursor holds the matches; read them with `toArray()`, iterate with `for…of`, sort, page and
more, see [Cursors](05-cursors.md). `projection` picks fields: `people.find({}, { name: 1 })`.

## findOne

```js
people.findOne({ city: 'Recife' });          // copy of Ana, the first match in insertion order
people.findOne({ name: 'Nobody' });          // null
people.findOne({ _id: 3 }, { name: 1 });     // { _id: 3, name: 'Carla' }
```

## count

```js
people.count();                        // 4, every document
people.count({ city: 'Recife' });      // 2, without copying anything
```

## Field conditions

A plain value means equality; an object of operators means conditions that must all hold:

```js
people.find({ city: 'Recife' });                       // equality
people.find({ age: { $gte: 18, $lt: 40 } });           // 18 ≤ age < 40: Ana, Davi
people.find({ city: 'Recife', age: { $gt: 40 } });     // several fields: all must match (AND)
```

### Comparison operators

| Operator | Matches when the field… | Example |
|---|---|---|
| `$eq` | equals the value | `{ age: { $eq: 31 } }` (same as `{ age: 31 }`) |
| `$ne` | does not equal it (also when the field is missing) | `{ city: { $ne: 'Recife' } }` |
| `$gt`, `$gte` | is greater (or equal) | `{ age: { $gt: 30 } }` |
| `$lt`, `$lte` | is smaller (or equal) | `{ age: { $lte: 17 } }` |
| `$in` | equals one of the values (or, for an array field, contains one) | `{ city: { $in: ['Recife', 'Curitiba'] } }` |
| `$nin` | equals none of them (also when missing) | `{ tags: { $nin: ['dev'] } }` |
| `$exists` | exists (`true`) or not (`false`) | `{ manager: { $exists: true } }` → Carla |
| `$regex` | is a string matching a pattern | `{ name: { $regex: '^c', $options: 'i' } }` |
| `$not` | does **not** satisfy the condition inside | `{ age: { $not: { $gte: 18, $lte: 40 } } }` → Bruno, Carla |

Comparisons work on numbers, strings (by code point: `'B' < 'a'`) and `Date` objects (by time).

### $in and $nin

```js
people.find({ city: { $in: ['Recife', 'São Paulo'] } });   // Ana, Carla, Davi
people.find({ tags: { $in: ['ops', 'design'] } });         // Ana, Bruno: array fields contain one
people.find({ name: { $in: [/^a/i, 'Davi'] } });           // regular expressions match strings
people.find({ city: { $nin: ['Recife'] } });               // Bruno, Davi
```

`$in` and `$nin` need an array: `The $in operator must be an array`.

### $regex

```js
people.find({ name: { $regex: 'an' } });                     // case sensitive: none
people.find({ name: { $regex: 'an', $options: 'i' } });      // Ana
people.find({ name: /^b/i });                                // a RegExp value works directly
people.find({ tags: { $regex: '^de' } });                    // arrays match when one string matches
```

`$options` accepts `i` (ignore case), `m` (multiline) and `s` (dot matches new lines). Non-string
values never match. To search for text typed by a user, escape it:

```js
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
people.find({ name: { $regex: escape(input), $options: 'i' } });
```

### $exists, missing fields and null

| Query | Ana (no `manager`) | Carla (`manager: null`) |
|---|---|---|
| `{ manager: null }` | | ✔ |
| `{ manager: { $exists: true } }` | | ✔ |
| `{ manager: { $exists: false } }` | ✔ | |
| `{ manager: { $eq: 'x' } }`, `$gt`, `$in`… | | |
| `{ manager: { $ne: 'x' } }`, `$nin` | ✔ | ✔ |

A missing field matches `$ne` and `$nin`, like MongoDB. Unlike MongoDB, `{ field: null }` matches only
documents where the field **is** `null`; to find documents without the field, use
`{ field: { $exists: false } }`, and for both, `{ $or: [{ field: null }, { field: { $exists: false } }] }`.

## Logical operators

```js
// OR: anyone from Curitiba, or older than 40
people.find({ $or: [{ city: 'Curitiba' }, { age: { $gt: 40 } }] });         // Bruno, Carla

// AND written explicitly (useful to repeat a field)
people.find({ $and: [{ age: { $gte: 18 } }, { age: { $ne: 31 } }] });      // Carla, Davi

// NOR: none of the conditions
people.find({ $nor: [{ city: 'Recife' }, { age: { $lt: 18 } }] });         // Davi

// nest at any depth, mix with fields
people.find({
  age: { $gte: 18 },
  $or: [
    { city: 'Recife', tags: { $in: ['dev'] } },
    { $and: [{ city: 'São Paulo' }, { name: { $regex: '^d', $options: 'i' } }] }
  ]
});                                                                             // Ana, Davi
```

| Operator | Value | Matches when |
|---|---|---|
| `$and` | array of queries | all match |
| `$or` | array of queries | at least one matches |
| `$nor` | array of queries | none matches |
| `$not` | a condition, inside a field | the condition does not hold |

Logical operators must receive an array; unknown operators throw. Evaluation stops early: `$and` at
the first false, `$or` at the first true.

## Nested fields

Dot paths reach into objects:

```js
people.find({ 'address.zip': '50000-000' });            // Ana
people.find({ 'address.zip': { $regex: '^5' } });
```

## Arrays

```js
people.find({ tags: { $in: ['dev'] } });     // contains 'dev'
people.find({ tags: { $exists: true } });    // has the field (Carla's empty array counts)
people.find({ tags: [] });                   // equality on arrays is not supported: use $in / $exists
```

Equality is strict: `{ tags: 'dev' }` does **not** match `tags: ['dev', 'ops']`. Use `$in`.

## Queries by _id are indexed

`{ _id: x }`, `{ _id: { $eq: x } }` and `{ _id: { $in: [...] } }` jump straight to the documents
through the collection's index instead of scanning, in `find`, `findOne`, `count`, every update and
delete, and `bulkWrite`. Other conditions in the same query are still checked:

```js
people.find({ _id: { $in: [3, 1, 99] } }).ids();   // [1, 3], in collection order
people.find({ _id: 1, age: { $gt: 40 } }).length;   // 0
```

## Sharing queries with a server

Queries are plain JSON (except RegExp values: use `{ $regex, $options }` instead), so you can send
the same object to a MongoDB backend, store it, or build it with a query builder UI:

```js
const query = { $and: [{ age: { $gte: 30 } }, { $or: [{ name: 'Ana' }, { city: { $in: ['A', 'B'] } }] }] };
fetch('/api/people?where=' + encodeURIComponent(JSON.stringify(query)));
people.find(query);   // the same result locally
```

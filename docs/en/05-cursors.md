# Cursors

`find()` returns a cursor: the matching documents, ready to be sorted, paged, projected and read.

```js
const page = people.find({ city: 'Recife' })
  .sort({ age: -1, name: 1 })
  .skip(20)
  .limit(10)
  .toArray();
```

## How a cursor works

A cursor holds **references** to the stored documents, not copies. Matching, `sort()`, `skip()`,
`limit()`, `length` and `ids()` copy nothing; a document is copied only when you **read** it with
`next()`, `toArray()`, `first()`, `last()`, `forEach()` or `for…of`. Reading one page of a million
matches copies one page.

Stored documents are never changed in place (an update stores a new version), so a cursor is a
**snapshot**: it keeps showing the documents as they were when `find()` ran, even if they are
updated or deleted afterwards.

```js
const cursor = people.find({ city: 'Recife' });
people.updateOne({ _id: 1 }, { $set: { age: 99 } });
cursor.toArray()[0].age;          // 31: the snapshot
people.find({ _id: 1 }).first().age;   // 99: a new find sees the change
```

## Reading

| Member | Returns | Description |
|---|---|---|
| `toArray()` | `object[]` | Copies of every document, as plain objects |
| `for (const doc of cursor)` | `object` each | Copies one at a time (stop early with `break` and the rest is never copied) |
| `forEach(fn)` | `void` | `fn(copy, index)` for each document |
| `first()` / `last()` | `object \| null` | Copy of the first / last document |
| `ids()` | `unknown[]` | The `_id` of each document, **no copies at all** |
| `length` | `number` | Number of documents |
| `hasNext()` / `next()` / `reset()` | | Step through the documents; `next()` throws `No more item to the cursor` at the end |

```js
for (const person of people.find({ age: { $gte: 18 } })) {
  if (person.name === 'Davi') break;   // the documents after Davi are never copied
}

const ids = people.find({ tags: { $in: ['dev'] } }).ids();   // [1]

const cursor = people.find({});
while (cursor.hasNext()) {
  const doc = cursor.next();   // a copy wrapped like a document: doc.name, doc._data
}
cursor.reset();                 // start again
```

`next()` returns a document wrapper (fields read as properties, the data in `doc._data`); the other
readers return plain objects. Both are copies.

## Sorting

```js
people.find({}).sort({ age: 1 });               // ascending
people.find({}).sort({ city: 1, age: -1 });     // by city, then age descending
people.find({}).sort({ 'address.zip': 1 });     // nested paths
```

`1` is ascending, `-1` descending; anything else throws (`Sort direction of "age" must be 1 or -1`).
`sort()` sorts in place and returns the cursor. The sort is stable: documents that compare equal keep
their insertion order.

### Missing and null values

Missing and `null` values go **last** in both directions, like a spreadsheet:

```js
tasks.find({}).sort({ due: 1 });                          // dated tasks first, then undated ones
tasks.find({}).sort({ due: -1 });                         // latest first, undated still last
tasks.find({}).sort({ due: 1 }, { nulls: 'first' });      // undated first
```

Set the default for a collection with `createCollection(name, schema, { nulls: 'first' })` or
`collection.setOptions({ nulls })`; the sort option overrides it. Before 1.6 they came first in
ascending order (MongoDB's order); `{ nulls: 'first' }` gives that order again.

### Mixed types

Values of different types are ordered like MongoDB: numbers, strings, objects, arrays, booleans,
dates (then missing / null, or first with `nulls: 'first'`).

### Language aware text

Strings compare by code point by default (`'B' < 'a'`, `'é' > 'z'`). Pass a collation, with the
options of `Intl.Collator`, to sort by language rules:

```js
people.find({}).sort({ name: 1 }, { collation: { locale: 'pt-BR', sensitivity: 'base' } });
files.find({}).sort({ name: 1 }, { collation: { locale: 'en', numeric: true } });   // 'item 2' before 'item 10'
```

## Paging

```js
const pageSize = 20;
const page = n => people.find({}).sort({ name: 1 }).skip(n * pageSize).limit(pageSize).toArray();
```

| Member | Description |
|---|---|
| `skip(count)` | Drops the first `count` documents (apply after `sort`, like MongoDB) |
| `limit(count)` | Keeps at most `count`; `0` means no limit |

Both need a non-negative integer. The total for a pager is `people.count(query)` or the cursor's
`length` before `skip`.

## Projection

Choose the fields of the copies you get back:

```js
people.find({}, { name: 1, age: 1 });   // only name, age and _id
people.find({}, { name: 1, _id: 0 });   // only name
people.find({}, { tags: 0 });           // everything except tags
people.find({}).projection({ name: 1 }); // same as the second argument
```

Inclusion (`1`) and exclusion (`0`) cannot be mixed, except for `_id`; projection works on top level
fields (`Projection supports top level fields only`). It applies to the copies: stored documents keep
every field, and sorting can use fields the projection hides.

## Cheat sheet

```js
const c = people.find(query, projection);
c.sort({ field: 1 }, { nulls: 'last', collation: { locale: 'pt-BR' } });
c.skip(40).limit(20);
c.length;  c.ids();                        // no copies
c.toArray();  c.first();  c.last();        // copies
for (const doc of c) {}  c.forEach(fn);     // copies, one at a time
c.hasNext();  c.next();  c.reset();
```

# Documents and inserting

A document is a plain object: strings, numbers, booleans, `null`, arrays, nested objects and `Date`
objects. Every document has an `_id`.

```js
{
  _id: '6f1c…',            // generated, or yours
  name: 'Coffee',
  price: 12.5,
  tags: ['hot'],
  supplier: { name: 'Fazenda Boa', city: 'Patrocínio' },
  createdAt: new Date()
}
```

## Rules for documents

| Rule | What happens otherwise |
|---|---|
| The document is an object (not an array, not `null`) | `Error: Invalid document type` |
| No key contains `$` or `.`, at any depth | `Error: Invalid document keys` (`$` starts operators, `.` separates paths) |
| Values are cloneable: no functions, DOM nodes or class instances with private state | `Error: Documents can only contain cloneable values (no functions or DOM nodes)` |
| `_id` is unique in the collection | `Error: Duplicate _id "…"` |
| The schema, when the collection has one, is satisfied | `ValidationError` with every problem, see [Schema validation](07-schema-validation.md) |

`_id` can be any value you like (number, string…). Without one, sorla-db generates a uuid v4 string.

## Copies everywhere

sorla-db stores a **copy** of what you insert, and hands out **copies** when you read:

```js
const product = { name: 'Coffee', tags: ['hot'] };
const id = products.insertOne(product);

product.tags.push('changed');               // your object: the collection does not see it
const copy = products.findOne({ _id: id });
copy.tags.push('also changed');             // a copy: the collection does not see it either
products.findOne({ _id: id }).tags;         // ['hot']
```

The objects you pass in are never modified (sorla-db does not add `_id` to them). Stored documents
are never changed in place either: an update stores a new version. That is what makes cursors
consistent snapshots and lets updates share the unchanged parts between versions (see
[Performance](14-performance.md)).

## insertOne

```js
const id = products.insertOne({ name: 'Coffee', price: 12.5 });
products.insertOne({ _id: 'tea', name: 'Tea' }, id => console.log('stored', id));   // optional callback
```

Returns the `_id`. Schema defaults are filled in before validation (see
[Schema validation](07-schema-validation.md#defaults)). Emits an `insert` event.

## insertMany

```js
const ids = products.insertMany([
  { name: 'Tea', price: 8 },
  { name: 'Juice', price: 9.9 }
]);
// ['…', '…']
```

**All or nothing:** the whole array is checked first (types, keys, duplicate ids inside the batch and
against the collection, schema), so one bad document stores nothing:

```js
try {
  products.insertMany([{ _id: 1, name: 'A' }, { _id: 1, name: 'B' }]);
} catch (error) {
  error.message;      // 'Duplicate _id "1"'
  products.count();   // unchanged
}
```

Emits one `insert` event for the whole batch. The optional second argument is a callback that
receives the ids. Inserting is linear: 100 000 documents take well under a second.

Need inserts, updates and deletes in one call? Use [`bulkWrite`](06-updating-and-deleting.md#bulkwrite).

## Dates

`Date` objects are stored as dates (copied), compared by time in queries and sorted after the other
types. Many apps store ISO strings instead (`'2026-11-01'`): they sort and compare correctly as
text, and they survive `JSON.stringify` when you send data to a server.

```js
events.insertOne({ title: 'Launch', at: new Date('2026-11-01T10:00:00Z') });
events.find({ at: { $gte: new Date('2026-11-01') } });
```

## Nested objects and arrays

Nested values are reached with dot paths in queries, sorting and updates:

```js
products.insertOne({ name: 'Coffee', supplier: { city: 'Patrocínio' }, tags: ['hot', 'strong'] });
products.find({ 'supplier.city': 'Patrocínio' });
products.find({ tags: { $in: ['strong'] } });
products.updateOne({ name: 'Coffee' }, { $set: { 'supplier.city': 'Franca' } });
```

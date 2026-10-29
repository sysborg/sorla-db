# Updating and deleting

```js
products.updateOne({ _id: 'tea' }, { $set: { price: 9 }, $inc: { sold: 1 } });
products.updateMany({ stock: 0 }, { $set: { available: false } });
products.replaceOne({ _id: 'tea' }, { name: 'Green tea', price: 10 });
products.deleteOne({ _id: 'juice' });
products.deleteMany({ available: false });
products.bulkWrite([ /* many of the above in one call */ ]);
```

Filters are [queries](04-querying.md). Filters on `_id` use the index, so `{ _id: x }` is the fastest
way to address one document.

## updateOne and updateMany

```js
collection.updateOne(filter, update, { upsert })    // the first match
collection.updateMany(filter, update, { upsert })   // every match
// → { matchedCount, modifiedCount, upsertedId }
```

`modifiedCount` counts the documents that actually changed: setting a field to the value it already
has matches but does not modify (and emits no event).

### Update operators

| Operator | Effect | Example |
|---|---|---|
| `$set` | Sets fields, creating missing objects along `"a.b"` paths | `{ $set: { price: 9, 'supplier.city': 'Franca' } }` |
| `$unset` | Removes fields (the value is ignored) | `{ $unset: { discount: '' } }` |
| `$inc` | Adds a number; a missing field starts at 0 | `{ $inc: { stock: -1, sold: 1 } }` |
| `$push` | Appends to an array (created when missing); `$each` appends several | `{ $push: { tags: 'new' } }`, `{ $push: { tags: { $each: ['a', 'b'] } } }` |
| `$pull` | Removes array items equal to a value, matching a condition or a sub document | `{ $pull: { tags: 'old' } }`, `{ $pull: { scores: { $lt: 5 } } }`, `{ $pull: { items: { ok: false } } }` |

Several operators can be combined in one update. An update must contain operators only; a plain
object (`{ price: 9 }`) throws and points you to `replaceOne`.

### Safe updates

- **Atomic per call.** Every new version is computed and validated before any document is replaced:
  if `$inc` hits a text field in the 500th match of an `updateMany`, nothing changes.
- **`_id` cannot change** (`The _id field cannot be updated`).
- **Schema checked.** With a schema, the new version must satisfy it (`ValidationError`).
- **Clear errors.** `Cannot $inc "name": it is not a number`, `Cannot $push to "tags": it is not an array`,
  `Unknown update operator $rename`.

### Upsert

```js
users.updateOne(
  { email: 'ana@example.com' },
  { $set: { name: 'Ana' }, $inc: { visits: 1 } },
  { upsert: true }
);
// nothing matched: inserts { email: 'ana@example.com', name: 'Ana', visits: 1 }
// → { matchedCount: 0, modifiedCount: 0, upsertedId: '…' }
```

The new document starts from the equality conditions of the filter (`field: value` and
`field: { $eq: value }` at the top level), then the update is applied. Schema defaults are filled in.

## replaceOne

```js
products.replaceOne({ _id: 'tea' }, { name: 'Green tea', price: 10 });
products.replaceOne({ name: 'Mate' }, { name: 'Mate', price: 7 }, { upsert: true });
```

Replaces the whole document of the first match and keeps its `_id` (a different `_id` in the
replacement throws). The replacement cannot contain update operators.

## deleteOne and deleteMany

```js
products.deleteOne({ _id: 'tea' });       // { deletedCount: 1 }
products.deleteMany({ price: { $gt: 100 } });
products.deleteMany({});                  // empties the collection
```

A filter is always required: `deleteMany()` without one throws
(`The filter must be a query object, use {} to match every document`), so an empty collection is
always a deliberate `{}`.

## bulkWrite

Many writes in one call, with the operations of MongoDB:

```js
const result = products.bulkWrite([
  { insertOne: { document: { _id: 'mate', name: 'Mate', price: 7 } } },
  { updateOne: { filter: { _id: 'tea' }, update: { $inc: { stock: 10 } } } },
  { updateMany: { filter: { stock: 0 }, update: { $set: { available: false } } } },
  { replaceOne: { filter: { _id: 'juice' }, replacement: { name: 'Orange juice', price: 11 }, upsert: true } },
  { deleteOne: { filter: { _id: 'old' } } },
  { deleteMany: { filter: { discontinued: true } } }
]);
// { insertedCount, matchedCount, modifiedCount, deletedCount, upsertedCount, insertedIds: { 0: 'mate' }, upsertedIds: {} }
```

- Operations run in order. Filters on `_id` use the index: 50 000 `updateOne` by `_id` take a fraction
  of a second.
- **One event per type at the end**: one `update` event listing every updated document, one
  `insert`… instead of one per operation. Live queries and listeners refresh once.
- **Errors, like MongoDB.** With `ordered: true` (default) the first failing operation stops the
  batch; with `{ ordered: false }` the others still run. Either way the operations before an error
  stay applied, and a `BulkWriteError` reports what happened:

```js
try {
  products.bulkWrite(operations, { ordered: false });
} catch (error) {
  error.name;          // 'BulkWriteError'
  error.writeErrors;   // [{ index: 3, operation: {…}, error: ValidationError }]
  error.result;        // the counts of what was applied
}
```

Use `bulkWrite` to apply changes from a server, to import data with a mix of new and existing rows,
or to update many documents by id with different values.

## Events

Every write that changes something emits an event (`insert`, `update`, `replace`, `delete`, and
`change` for all of them), see [Events](09-events.md). Writes that change nothing emit nothing.

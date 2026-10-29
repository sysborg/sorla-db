# Performance

sorla-db is built to stay fast with 100 000 documents and usable well beyond that. This page explains
what makes it fast and how to keep it that way.

## What is fast

| Operation | Cost | Notes |
|---|---|---|
| `insertMany` | linear | 50 000 documents in well under a second |
| any filter on `_id` (`{ _id }`, `$eq`, `$in`) | constant per id | uses the index, in reads, updates, deletes and `bulkWrite` |
| `find(query)` | one pass over the documents | no copies: the cursor keeps references |
| `cursor.ids()`, `length`, `count(query)` | | no copies at all |
| `toArray()` / iteration | proportional to what you read | `skip` and `limit` before reading copy only one page |
| `updateOne` by `_id` | constant | copies only the changed path of the document |
| `bulkWrite` of 100 000 `$set` by `_id` | about 180 ms | one event per type at the end |
| `watch()` after a change | proportional to the changed documents | plus a re-sort of the result |

## Why

- **An `_id` index.** Every collection keeps a map from `_id` to position. Filters on `_id` go straight
  to the documents; other conditions in the same query are still checked.
- **Copy on read, not on find.** A cursor holds references to stored documents and copies a document
  only when you read it. Filtering 100 000 documents to count them, or to get their ids, copies none.
- **Immutable stored documents.** sorla-db never changes a stored document in place: an update stores
  a new version. That makes cursors consistent snapshots for free, and lets an update copy only the
  objects along the changed path; the rest is shared with the previous version.
- **Events copy only when someone listens.** Without listeners, writes do not copy anything for
  events.
- **Batches.** `insertMany`, `updateMany` and `bulkWrite` emit one event per operation type, so
  listeners and live queries do their work once.

## Tips

```js
// ✔ count without reading
orders.count({ status: 'open' });
// ✘ orders.find({ status: 'open' }).toArray().length

// ✔ ids when that is all you need
const ids = orders.find({ status: 'open' }).ids();

// ✔ page before reading
orders.find({}).sort({ due: 1 }).skip(200).limit(50).toArray();

// ✔ address documents by _id
orders.updateOne({ _id: id }, { $set: { status: 'done' } });

// ✔ many updates with different values: one bulkWrite
orders.bulkWrite(changes.map(c => ({ updateOne: { filter: { _id: c.id }, update: { $set: c.fields } } })));
// ✘ a loop of updateOne calls with a listener or a live query: one notification per call

// ✔ stop iterating early: the rest is never copied
for (const order of orders.find({ total: { $gt: 1000 } })) { if (found(order)) break; }

// ✔ project large documents when you only need a few fields
orders.find({}, { _id: 1, total: 1 }).toArray();
```

## Memory

Each document is stored once. Copies exist only while you hold the results you read. A cursor of
100 000 matches costs an array of 100 000 references (under 1 MB). In a browser, a few hundred
thousand documents of a dozen fields fit comfortably; for millions, load them in blocks with
[Server-Sent Events](11-server-sync.md) and keep only what the screen needs, or page from the
server.

## Measuring

```js
console.time('query');
orders.find({ city: { $in: ['Recife', 'Natal'] }, total: { $gte: 100 } }).sort({ total: -1 }).limit(20).toArray();
console.timeEnd('query');
```

The test suite has performance tests with generous limits that catch accidental quadratic behavior
(`test/feature_performance.test.js`, `test/feature_bulk_write.test.js`, `test/feature_live_query.test.js`).

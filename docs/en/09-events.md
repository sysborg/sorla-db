# Events

Collections tell you about every change. Use events to save to `localStorage`, sync with a server,
log, or update a UI by hand (for UIs, [live queries](10-live-queries.md) are usually simpler).

```js
const off = products.on('change', event => {
  console.log(event.type, event.ids);   // 'update' ['tea']
});
products.updateOne({ _id: 'tea' }, { $set: { price: 9 } });
off();   // stop listening
```

## Event types

| Event | Emitted by | Payload |
|---|---|---|
| `insert` | `insertOne`, `insertMany`, upserts, `bulkWrite` inserts | `{ type, ids, documents }` |
| `update` | `updateOne`, `updateMany`, `bulkWrite` updates | `{ type, ids, documents, previous }` |
| `replace` | `replaceOne` | `{ type, ids, documents, previous }` |
| `delete` | `deleteOne`, `deleteMany` | `{ type, ids, documents }` |
| `change` | all of the above | the same payload, `type` tells which |

`documents` are copies of the new versions and `previous` copies of the versions before an update or
replace, in the order of `ids`. For `delete`, `documents` are the removed documents themselves (they
are no longer in the collection).

## One event per operation

`insertMany`, `updateMany` and `deleteMany` emit **one** event for the whole operation, and
`bulkWrite` one per type at the end. A write that changes nothing (updating a field to the value it
already has, deleting with a filter that matches nothing) emits nothing.

## API

```js
const off = products.on('update', listener);     // returns an unsubscribe function
products.once('insert', listener);                // only the next one
products.off('update', listener);                 // remove one listener
products.off('update');                           // remove every listener of that type
```

## Listeners cannot break writes

A listener that throws does not undo or interrupt the write, and the other listeners still run; the
error is rethrown asynchronously so it shows up in the console.

## Copies only when someone listens

The `documents` and `previous` copies are made only when there is a listener for that type or for
`change`. Without listeners a write pays nothing for events.

## Recipes

```js
// persist a collection in localStorage
const save = () => localStorage.setItem('tasks', JSON.stringify(tasks.find({}).toArray()));
tasks.on('change', save);
tasks.insertMany(JSON.parse(localStorage.getItem('tasks') ?? '[]'));

// send changes to a server
tasks.on('change', ({ type, ids, documents }) => fetch('/api/tasks/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type, ids, documents })
}));

// an audit trail
const history = [];
users.on('update', ({ ids, documents, previous }) =>
  ids.forEach((id, i) => history.push({ id, before: previous[i], after: documents[i], at: Date.now() })));
```

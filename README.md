# sorla-db

A document database for the browser and Node: MongoDB queries, schema validation, change events,
live queries for React / Vue / Svelte / Angular, form binding, and loading from a backend over
Server-Sent Events or WebSocket. No server, no dependencies, 54 kB.

📖 **Documentation:** [sysborg.github.io/sorla-db](https://sysborg.github.io/sorla-db/) · [English](docs/en/README.md) · [Português (Brasil)](docs/pt-BR/README.md):
getting started, every command, the test suites, console recipes and a cookbook.

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
<!-- browser, 54 kB: registers window.sorla -->
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
cursor.ids();               // their _id, without copying anything
cursor.first();             // copy of the first one, null when empty
cursor.last();              // copy of the last one, null when empty
cursor.toArray();           // plain copies
for(const doc of cursor) {} // copies, one at a time (also cursor.forEach)
while(cursor.hasNext()) cursor.next();
```

`findOne()` returns a copy of the first matching document, or `null`.

A cursor holds references to the stored documents, not copies: matching, `sort()`, `skip()`,
`limit()`, `length` and `ids()` copy nothing, and a document is copied only when you read it. Reading
one page of a million matches copies one page. Stored documents are never changed in place (updates
store new objects), so a cursor keeps showing the documents as they were when `find()` ran.

## Sorting

```
window.sorla.db.updatedTags.find({}).sort({ age: -1, name: 1 }).toArray();
```

`1` is ascending and `-1` descending, and `"a.b"` paths work. `sort()` returns the cursor. Values of
different types follow MongoDB's order: numbers, strings, objects, arrays, booleans, dates. Strings
compare by code point. Pass a collation to compare by language rules, using the `Intl.Collator` options:

```
cursor.sort({ name: 1 }, { collation: { locale: 'pt-BR', sensitivity: 'base', numeric: true } });
```

Missing and `null` values go **last**, in both directions (like a spreadsheet). Choose per sort or
per collection:

```
cursor.sort({ due: 1 }, { nulls: 'first' });                // this sort
db.createCollection('tasks', null, { nulls: 'first' });     // default of the collection
db.tasks.setOptions({ nulls: 'last' });
```

Before 1.6, missing and null values came first in ascending order (MongoDB's order); pass
`{ nulls: 'first' }` for that order in ascending sorts.

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

## Bulk writes

```
collection.bulkWrite([
  { insertOne: { document: { _id: 'p9', name: 'Ana' } } },
  { updateOne: { filter: { _id: 'p1' }, update: { $set: { qty: 3 } } } },
  { updateMany: { filter: { active: false }, update: { $set: { archived: true } } } },
  { replaceOne: { filter: { _id: 'p2' }, replacement: { name: 'Bia' }, upsert: true } },
  { deleteOne: { filter: { _id: 'p3' } } },
  { deleteMany: { filter: { qty: 0 } } }
]);
// { insertedCount, matchedCount, modifiedCount, deletedCount, upsertedCount, insertedIds, upsertedIds }
```

Filters on `_id` (`{ _id: x }`, `{ _id: { $in: [...] } }`) use the collection's index, here and in
`find`, `updateOne`, `deleteOne` and the others, so updating 50 000 documents by `_id` takes
milliseconds instead of a full scan per document. `bulkWrite` emits one change event per type at the
end, with every document of that type.

Like MongoDB, the first failing operation stops the batch (`{ ordered: false }` runs the others),
the operations before it stay applied, and a `BulkWriteError` is thrown with `writeErrors`
(`[{ index, operation, error }]`) and the partial `result`.

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

## Live queries and framework bindings

`watch()` keeps the documents of a query current as the collection changes:

```
const open = db.tasks.watch({ done: false }, { sort: { due: 1 }, limit: 50 });
const off = open.subscribe(tasks => render(tasks));   // called now and after every change
open.getSnapshot();                                   // the same array until something changes
off();
```

- The documents are frozen copies. After a change only the changed documents are copied again; the
  others keep their object, so a framework can skip the rows that did not change.
- Writes made in one go (a loop of updates, a `bulkWrite`, an SSE block) notify once, on the next
  microtask.
- The collection is watched only while there are subscribers, so nothing needs closing.
- Options: `sort`, `nulls`, `collation`, `skip`, `limit`, `projection`.

The bindings are optional entry points; install the framework yourself.

**React** (18+)
```
import { useQuery, useDocument } from 'sorla-db/react';

function Tasks() {
  const tasks = useQuery(db.tasks, { done: false }, { sort: { due: 1 } });   // inline objects are fine
  return tasks.map(task => <Task key={task._id} task={task} />);
}
const task = useDocument(db.tasks, id);   // or null
```

**Vue** (3.3+)
```
import { useQuery } from 'sorla-db/vue';

const owner = ref('ana');
const tasks = useQuery(db.tasks, () => ({ owner: owner.value }), { sort: { due: 1 } });   // a ref
```

**Svelte** (3, 4 and 5)
```
import { query } from 'sorla-db/svelte';
const tasks = query(db.tasks, { done: false });
// {#each $tasks as task (task._id)} ... {/each}
```

**Angular** (16+)
```
import { querySignal } from 'sorla-db/angular';

export class TasksComponent {
  tasks = querySignal(db.tasks, { done: false }, { sort: { due: 1 } });   // a signal
  // @for (task of tasks(); track task._id) { ... }
}
```
`querySignal` needs an injection context (a field initializer or the constructor) or `{ injector }`,
and stops when the component is destroyed. A live query is also an Observable:
`from(db.tasks.watch(query))` works with RxJS.

## Loading from a backend: Server-Sent Events and WebSocket

Both are alternatives to a plain `fetch`, not replacements: use them when there are many rows to
load, or when the server should push changes.

### Server-Sent Events: many rows in blocks

```
const loading = db.orders.stream('/api/orders/stream', {
  headers: { Authorization: `Bearer ${token}` },     // fetch transport (default)
  onProgress: ({ loaded, total }) => bar.value = loaded / (total ?? loaded)
});
const { loaded } = await loading.done;               // loading.close() stops early
```

The server answers with `text/event-stream` and sends JSON in named events:

```
event: meta
data: {"total": 1000000}

id: 1
event: rows
data: [{"_id": 1, "name": "..."}, ... 5000 rows ...]

id: 2
event: rows
data: [...]

event: end
data: {}
```

| Event | Data | Effect |
|---|---|---|
| `meta` | `{ total }` | the number of rows to expect, for progress |
| `rows` | `[docs]` or `{ rows }` | one `bulkWrite`: rows whose `_id` exists are replaced, the others inserted |
| `ops` | `[bulkWrite operations]` | any change |
| `delete` | `[ids]` or `{ ids }` | removes documents |
| `end` | `{ total? }` | done: `done` resolves and the client does not reconnect |
| `abort` | `{ message }` | the server gives up: `done` rejects |

When the connection drops, the client reconnects (after `retry` ms, 1000 by default, or what the
server sent with `retry:`) and sends the last `id:` it received as the `Last-Event-ID` header, so the
server can continue with the next block. Rows sent twice are replaced, not duplicated. A row that does
not satisfy the schema is skipped and counted in `state.errors` (`onError` receives the
`BulkWriteError`); the rest of its block is stored. HTTP 4xx answers and `abort` stop the stream;
other failures are retried up to `maxRetries` (10) times in a row.

[`example/sse_server.js`](example/sse_server.js) is a reference endpoint in plain Node (100 000 rows in
blocks of 5 000, resuming from `Last-Event-ID`, waiting for `drain` when the client reads slowly).

To store the blocks yourself, pass `apply`: `sorla.stream(url, { apply: (type, data) => ... })` works
without a collection (`type` is `'rows'`, `'ops'` or `'delete'`).

`transport: 'eventsource'` uses the browser's `EventSource` instead (GET only, no custom headers,
cookies with `withCredentials`).

### WebSocket: pages and live changes

```
const remote = db.orders.connect('wss://api.example.com/orders');
const page = await remote.load({ offset: 0, limit: 200, query: { status: 'open' }, sort: { due: 1 } });
// page = { rows, hasMore, total }; the rows are stored in db.orders too
remote.on('push', ({ message }) => console.log('server changed', message.type));
remote.close();
```

Messages are JSON objects with a `type`:

| Direction | Message |
|---|---|
| client → server | `{ type: 'load', id, offset, limit, query, sort }`, any `request(type, payload)`, `{ type: 'ping' }` |
| server → client | `{ type: 'reply', id, rows, hasMore, total }` (or any reply), `{ type: 'error', id, message }` |
| server → client (push) | `{ type: 'rows', rows }`, `{ type: 'ops', ops }`, `{ type: 'delete', ids }`: applied to the collection |

Requests made while connecting are sent when the socket opens. After a drop the client reconnects with
exponential back off (500 ms up to 30 s); requests still waiting for a reply are rejected, so retry
them. A ping is sent every 25 s (`heartbeat`), and a connection that stays silent for two heartbeats
is replaced. Replies time out after 30 s (`timeout`).

`sorla.connect(url, options)` opens a connection not tied to a collection: `load()` only returns the
rows, for example for a data grid that stores them itself.

## Databases and collections

```
sorla.listDatabases();            // ['tags', ...]
sorla.dropDb('tags');
sorla.db.listCollections();       // ['updatedTags', ...]
sorla.db.getCollection('stats');  // any collection, also when its name shadows a method
sorla.db.dropCollection('updatedTags');
sorla.db.getStats();              // { name, documents, collections: [{ name, documents }] }
```

## Schema validation

Give a collection a schema (a subset of JSON Schema) and every insert, update, replace and upsert must
satisfy it:

```
sorla.db.createCollection('users', {
  required: ['name', 'email'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
    email: { type: 'string', format: 'email' },
    age: { type: ['integer', 'null'], minimum: 0 },
    role: { enum: ['admin', 'user'], default: 'user' },
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    createdAt: { type: 'date' },
    address: {
      type: 'object',
      required: ['zip'],
      properties: { zip: { type: 'string', pattern: '^\\d{5}-\\d{3}$' } }
    }
  }
});

try {
  sorla.db.users.insertOne({ name: 'A', email: 'nope' });
} catch(error) {
  // error instanceof sorla.ValidationError
  error.errors; // [{ path: 'name', rule: 'minLength', message: 'name must have at least 2 characters' },
                //  { path: 'email', rule: 'format', message: 'email must be a valid email' }]
}

sorla.db.users.validate({ name: 'Ana' });   // { valid: false, errors: [...] } without storing (forms)
sorla.db.users.setSchema(otherSchema);      // existing documents are not revalidated; null removes it
```

| Keyword | Notes |
|---|---|
| `type` | `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`, several (`['string', 'null']`), and `date` for Date objects |
| `required`, `properties`, `additionalProperties` | `additionalProperties` can be `false` or a schema; `_id` is always allowed |
| `enum`, `const` | |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` | numbers |
| `minLength`, `maxLength`, `pattern`, `format` | strings; lengths count characters; formats: `email`, `date`, `date-time`, `uri` |
| `items`, `minItems`, `maxItems`, `uniqueItems` | arrays |
| `default` | filled on insert and upsert when the field is missing, also in nested objects |
| `title`, `description`, `examples`, `$schema`, `$id` | annotations |

Every problem is reported at once, with its field path (`address.zip`, `tags[1]`). `insertMany` and
`updateMany` stay atomic: one invalid document stores nothing. Unknown keywords, types and formats throw
when the schema is set, so a typo like `tpye` is not silently ignored.

A function also works as a schema: `doc => doc.total >= 0 || 'total must not be negative'`.

## Forms

`bindForm` connects an HTML form to a collection. Fields map to document fields by their `name`
(`address.zip` for nested ones), values are converted with the schema, errors appear next to each field,
and submitting inserts or updates the document.

```html
<form id="user">
  <input name="name">
  <input name="email" type="email">
  <input name="age" type="number">
  <input name="address.zip">
  <button>Save</button>
</form>
```
```
const form = sorla.db.users.bindForm('#user', {
  onSuccess: result => console.log(result.mode, result.id),
  onError: errors => console.log(errors)
});

// edit an existing document: only the form fields are written ($set / $unset)
sorla.db.users.bindForm('#user', { mode: 'update', id: 'u1' });

// no markup: build the fields from the schema
sorla.db.users.bindForm('#signup', { generate: true });
```

| Option | Default | |
|---|---|---|
| `mode` | `'insert'` | `'update'` loads `id` and saves the changed fields only |
| `id` | | document to edit |
| `generate` | `false` | build labeled fields from the JSON schema (types, enum selects, checkbox groups, nested fieldsets, limits, hints) |
| `validateOn` | `'blur'` | `'input'` or `'submit'`; before submit only fields the user already left are reported |
| `resetOnInsert` | `true` | clear the form after an insert |
| `nativeValidation` | `false` | keep the browser bubbles (by default the form gets `novalidate`) |
| `messages` | | `issue => 'translated text'` |
| `onSuccess` / `onError` | | callbacks; the form also dispatches `sorla:saved` and `sorla:invalid` |

Errors set `aria-invalid` and `aria-describedby` on the field and fill a `[data-error-for="field"]`
element (yours, or a `<small class="sorla-error">` created after the field). Errors that are not about a
field go to `[data-error-for=""]` at the top of the form, with `role="alert"`.

The returned controller has `values()`, `fill(doc)`, `validate()`, `submit()`, `load(id)`, `reset()`
and `destroy()`. See `example/form_example.html`.

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

Regular expressions in the list match strings, like MongoDB: `{ name: { $in: [/^ana/i, 'Bia'] } }`.

### $nin
$nin operator is opposite of $in operator, returns only documents that the values doesn't match with any of the query.
This will result in a total of 0 documents.
```
const results = window.sorla.db.updatedTags.find({
  age: { $nin: [36, 53]}
});
```
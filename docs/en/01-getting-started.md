# Getting started

sorla-db is a document database that lives in memory, in the browser or in Node. You store plain
JavaScript objects, query them with the MongoDB query language you may already know, and get
schema validation, change events, live queries for React / Vue / Svelte / Angular, form binding,
and loading from a backend over Server-Sent Events or a WebSocket. No server, no setup, no
dependencies.

```js
const sorla = require('sorla-db');

const app = new sorla();
app.useDb('shop');
app.db.createCollection('products');

app.db.products.insertMany([
  { name: 'Coffee', price: 12.5, tags: ['hot'] },
  { name: 'Tea', price: 8, tags: ['hot', 'herbal'] },
  { name: 'Juice', price: 9.9, tags: ['cold'] }
]);

app.db.products.find({ price: { $lt: 10 } }).sort({ price: 1 }).toArray();
// [{ _id: '…', name: 'Tea', price: 8, … }, { _id: '…', name: 'Juice', price: 9.9, … }]
```

## Why developers pick it

- **Familiar.** `find`, `updateOne`, `$in`, `$regex`, `$set`, `bulkWrite`… The MongoDB vocabulary,
  so there is little to learn and queries can be shared with a MongoDB backend.
- **Safe by default.** You always get copies; stored documents cannot be changed by accident. Batches
  are validated before anything is written.
- **Fast.** An `_id` index, cursors that copy only what you read, updates that copy only what
  changed. 100 000 documents are comfortable.
- **Reactive.** `watch()` keeps a query current, and the bindings turn it into a React hook, a Vue
  ref, a Svelte store or an Angular signal.
- **Connected.** Load a million rows in blocks over Server-Sent Events, or page and receive live
  changes over a WebSocket.
- **Small.** One 54 kB browser file, or a CommonJS / ES module package with TypeScript types.

## Installation

### npm

```bash
npm install sorla-db
```

```js
// CommonJS (Node, older bundlers)
const sorla = require('sorla-db');

// ES modules (Vite, webpack, esbuild, Node with "type": "module")
import sorla from 'sorla-db';
// or: import { sorla } from 'sorla-db';
```

### A script tag, no build step

```html
<script src="https://cdn.jsdelivr.net/npm/sorla-db@1/dist/sorla.min.js"></script>
<script>
  const app = new window.sorla();   // the bundle registers the class as window.sorla
  app.useDb('demo');
</script>
```

The same file is in `node_modules/sorla-db/dist/sorla.min.js` if you serve it yourself. unpkg works too:
`https://unpkg.com/sorla-db@1/dist/sorla.min.js`.

### Framework bindings

The bindings are part of the package; install the framework you use as usual.

```js
import { useQuery } from 'sorla-db/react';     // React 18+
import { useQuery } from 'sorla-db/vue';       // Vue 3.3+
import { query } from 'sorla-db/svelte';       // Svelte 3, 4, 5
import { querySignal } from 'sorla-db/angular'; // Angular 16+
```

See [Live queries and frameworks](10-live-queries.md).

### Requirements

| Environment | Version |
|---|---|
| Browsers | any current browser (ES2020) |
| Node | 18 or later (fetch, ReadableStream, structuredClone); the test suite runs on Node 24 |
| TypeScript | declarations included (`index.d.ts`) |

## Your first five minutes

```js
const app = new sorla();

// 1. a database: useDb creates it when needed and selects it
app.useDb('todo');

// 2. a collection, optionally with a schema
app.db.createCollection('tasks', {
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 1 },
    done: { type: 'boolean', default: false },
    due: { type: ['string', 'null'], format: 'date' }
  }
});
const tasks = app.db.tasks;

// 3. insert: copies are stored, ids are generated (uuid v4) unless you give _id
const id = tasks.insertOne({ title: 'Write the docs', due: '2026-11-01' });
tasks.insertMany([{ title: 'Ship it' }, { title: 'Celebrate', due: '2026-11-02' }]);

// 4. query
tasks.find({ done: false }).sort({ due: 1 }).toArray();
tasks.findOne({ _id: id });            // { _id, title: 'Write the docs', done: false, due: '2026-11-01' }
tasks.count({ due: { $exists: true } });

// 5. change and react
tasks.on('change', event => console.log(event.type, event.ids));
tasks.updateOne({ _id: id }, { $set: { done: true } });   // logs: update [id]
tasks.deleteMany({ done: true });                         // logs: delete [id]
```

Sorting puts missing and `null` values last (`due` above), in both directions. That is configurable,
see [Cursors](05-cursors.md#sorting).

## Where to go next

| I want to… | Read |
|---|---|
| organize data in databases and collections | [Databases and collections](02-databases-and-collections.md) |
| understand ids, copies and what can be stored | [Documents and inserting](03-documents-and-inserting.md) |
| write queries | [Querying](04-querying.md) |
| sort, page, project and read results | [Cursors](05-cursors.md) |
| change and remove data, in bulk too | [Updating and deleting](06-updating-and-deleting.md) |
| reject bad data | [Schema validation](07-schema-validation.md) |
| connect an HTML form | [Forms](08-forms.md) |
| react to changes | [Events](09-events.md) and [Live queries](10-live-queries.md) |
| load from a backend | [Server sync: SSE and WebSocket](11-server-sync.md) |
| poke around in the browser console | [Using the console](12-console.md) |
| type everything | [TypeScript](13-typescript.md) |
| handle a lot of data | [Performance](14-performance.md) |
| run the tests or contribute | [Testing and development](15-testing-and-development.md) |
| copy a working recipe | [Cookbook and FAQ](16-cookbook.md) |

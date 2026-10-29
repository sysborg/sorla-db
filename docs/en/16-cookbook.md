# Cookbook and FAQ

Short, complete recipes you can copy.

## A to-do list with persistence

```js
const app = new sorla();
app.useDb('todo');
app.db.createCollection('tasks', {
  required: ['title'],
  properties: { title: { type: 'string', minLength: 1 }, done: { type: 'boolean', default: false } }
});
const tasks = app.db.tasks;

// load what was saved, then save on every change
tasks.insertMany(JSON.parse(localStorage.getItem('tasks') ?? '[]'));
tasks.on('change', () => localStorage.setItem('tasks', JSON.stringify(tasks.find({}).toArray())));

// render whenever the list changes
tasks.watch({}, { sort: { done: 1, title: 1 } }).subscribe(list => {
  document.querySelector('#list').innerHTML = list
    .map(t => `<li data-id="${t._id}" class="${t.done ? 'done' : ''}">${t.title}</li>`).join('');
});

document.querySelector('#list').addEventListener('click', e => {
  const id = e.target.dataset.id;
  const task = tasks.findOne({ _id: id });
  tasks.updateOne({ _id: id }, { $set: { done: !task.done } });
});
```

## Search as you type

```js
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
input.addEventListener('input', () => {
  const pattern = { $regex: escape(input.value), $options: 'i' };
  const results = products.find({ $or: [{ name: pattern }, { tags: pattern }] }).limit(20).toArray();
  render(results);
});
```

## A pager

```js
function page(query, { page = 1, size = 20, sort = { _id: 1 } } = {}) {
  const total = products.count(query);
  const rows = products.find(query).sort(sort).skip((page - 1) * size).limit(size).toArray();
  return { rows, total, pages: Math.ceil(total / size) };
}
```

## Caching API responses

```js
async function loadProducts() {
  if (products.count()) return products.find({}).toArray();
  const rows = await (await fetch('/api/products')).json();
  products.insertMany(rows);
  return products.find({}).toArray();
}
```

## Merging server data (new and existing rows)

```js
function merge(rows) {
  const existing = new Set(products.find({ _id: { $in: rows.map(r => r._id) } }).ids());
  return products.bulkWrite(rows.map(row => existing.has(row._id)
    ? { replaceOne: { filter: { _id: row._id }, replacement: row } }
    : { insertOne: { document: row } }));
}
```

## Undo the last change

```js
const undo = [];
products.on('update', ({ ids, previous }) => undo.push({ ids, previous }));
function undoLast() {
  const last = undo.pop();
  if (!last) return;
  products.bulkWrite(last.ids.map((id, i) => ({ replaceOne: { filter: { _id: id }, replacement: last.previous[i] } })));
}
```

(Undoing also emits an `update` event; skip recording while undoing if you need a redo stack.)

## Group and sum

```js
function sumBy(collection, field, value, query = {}) {
  const totals = {};
  for (const doc of collection.find(query)) totals[doc[field]] = (totals[doc[field]] ?? 0) + doc[value];
  return totals;
}
sumBy(orders, 'city', 'total', { status: 'done' });   // { Recife: 1520, Curitiba: 830 }
```

## Export and import JSON or CSV

```js
const json = JSON.stringify(orders.find({}).toArray());

const toCsv = rows => {
  const fields = Object.keys(rows[0] ?? {});
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [fields.join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\n');
};
const csv = toCsv(orders.find({}, { _id: 0 }).toArray());
```

## A form with validation in three lines

```js
app.db.createCollection('contacts', { required: ['name', 'email'], properties: { name: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' } } });
app.db.contacts.bindForm('#contact', { generate: true, onSuccess: () => alert('Thanks!') });
```

## A shared instance across modules

```js
// db.js
import sorla from 'sorla-db';
export const app = new sorla();
app.useDb('app');
for (const name of ['users', 'orders', 'products']) app.db.createCollection(name);
export const { users, orders, products } = app.db;

// anywhere
import { orders } from './db.js';
```

## FAQ

**Is the data saved when the page reloads?**
No, sorla-db lives in memory. Save with an event listener (see the to-do recipe) or reload from your
server; for large data, stream it with [Server-Sent Events](11-server-sync.md).

**Can I use it on the server?**
Yes: it runs in Node 18+, handy for tests, scripts, caches, and for answering the same
queries your frontend sends (see the WebSocket server in [Server sync](11-server-sync.md)).

**How close is it to MongoDB?**
The query language, update operators, `bulkWrite`, projections and results follow MongoDB. Differences:
`{ field: null }` matches only `null` (not missing fields), missing and `null` sort last by default,
there are no aggregation pipelines or secondary indexes, and `_id` can be any value.

**Why do I get copies instead of the stored objects?**
So nothing outside the collection can change its data by accident. Cursors copy only what you read,
so copies cost little; `ids()` and `count()` copy nothing.

**Can I store class instances or functions?**
No: documents must be cloneable data (objects, arrays, strings, numbers, booleans, `null`, `Date`).

**How do I add an index on another field?**
Only `_id` is indexed. Queries on other fields scan the collection, which takes milliseconds for tens of
thousands of documents. If you look up by another key a lot, use it as `_id`.

**What about concurrency?**
JavaScript runs one thing at a time, so every call is atomic. `insertMany`, `updateMany` and each
`bulkWrite` operation validate before writing.

**Does it work with my framework?**
Yes: React, Vue, Svelte and Angular have bindings, and anything that understands Observables or
plain callbacks works with `watch()`. See [Live queries](10-live-queries.md).

**How big is it?**
About 54 kB minified for the browser bundle, with forms, schema validation, live queries and both
sync transports included.

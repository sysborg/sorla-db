# Databases and collections

```
sorla instance
└── databases            app.useDb('shop'), app.createDb('archive')
    └── collections      app.db.createCollection('products')
        └── documents    app.db.products.insertOne({ … })
```

One `sorla` instance holds any number of databases; one of them is selected and reachable as
`app.db`. A database holds collections, and collections hold documents. Everything lives in memory
for the lifetime of the instance.

## The sorla instance

```js
const app = new sorla();
```

| Method | Returns | Description |
|---|---|---|
| `useDb(name)` | `void` | Selects a database, creating it when it does not exist |
| `createDb(name)` | `number \| false` | Creates a database without selecting it; `false` when the name exists |
| `dbExists(name)` | `boolean` | |
| `listDatabases()` | `string[]` | Names, in creation order |
| `countDb()` | `number` | |
| `dropDb(name)` | `boolean` | Removes a database and everything in it; when it was selected, `app.db` becomes `null` |
| `db` | `Database \| null` | The selected database |

```js
app.useDb('shop');          // created and selected
app.createDb('archive');    // created, 'shop' stays selected
app.listDatabases();        // ['shop', 'archive']
app.useDb('archive');       // switch
app.dropDb('archive');      // app.db is now null
```

Separate `sorla` instances share nothing: `new sorla()` twice gives two independent sets of databases.

### Static members

| Member | Description |
|---|---|
| `sorla.ValidationError` | The error thrown when a document breaks the schema, see [Schema validation](07-schema-validation.md) |
| `sorla.connect(url, options)` | A WebSocket connection not tied to a collection, see [Server sync](11-server-sync.md#websocket) |
| `sorla.stream(url, { apply })` | A Server-Sent Events stream handled by your code, see [Server sync](11-server-sync.md#server-sent-events) |
| `sorla.readEventStream(body, onEvent)` | The `text/event-stream` parser |

## Databases

| Member | Returns | Description |
|---|---|---|
| `createCollection(name, schema?, options?)` | `void` | Throws when the name exists. `schema` is a JSON Schema subset or a function; `options` is `{ nulls: 'last' \| 'first' }` |
| `getCollection(name)` | `Collection \| undefined` | Works for any name, also names that are not valid properties |
| `listCollections()` | `string[]` | Names, in creation order |
| `countCollections()` | `number` | |
| `dropCollection(name)` | `boolean` | Removes a collection and its documents |
| `getStats()` | `{ name, documents, collections: [{ name, documents }] }` | Document counts |
| `name` | `string` | |

Collections are also properties of the database:

```js
app.db.createCollection('products');
app.db.products === app.db.getCollection('products');   // true
app.db['order-items'];                                     // names with dashes work with brackets
```

A collection named like a database method (`name`, `getStats`…) shadows the method on the property
access; `getCollection(name)` always returns the collection.

```js
app.db.getStats();
// { name: 'shop', documents: 3, collections: [{ name: 'products', documents: 3 }] }
```

## Collections

A collection is where the work happens. The full list of members, with links:

| Group | Members |
|---|---|
| Insert | [`insertOne`](03-documents-and-inserting.md#insertone), [`insertMany`](03-documents-and-inserting.md#insertmany) |
| Read | [`find`](04-querying.md), [`findOne`](04-querying.md#findone), [`count`](04-querying.md#count), `first`, `last`, `all` |
| Change | [`updateOne`, `updateMany`, `replaceOne`, `deleteOne`, `deleteMany`, `bulkWrite`](06-updating-and-deleting.md) |
| Schema | [`setSchema`, `getSchema`, `validate`, `applyDefaults`](07-schema-validation.md) |
| Options | [`setOptions`, `getOptions`](#collection-options) |
| Events | [`on`, `once`, `off`](09-events.md) |
| Reactivity | [`watch`](10-live-queries.md) |
| Forms | [`bindForm`](08-forms.md) |
| Backend | [`stream`, `connect`](11-server-sync.md) |

### first, last and all

```js
products.first;   // copy of the first document in insertion order, or null
products.last;    // copy of the last one, or null
products.all;     // the stored documents (read-only wrappers), in insertion order
```

`all` gives the internal wrappers without copying: read fields with `doc.name` or `doc['a.b']`, and do
not keep them around expecting live data (an update stores a new object). Prefer `find({})` for
anything else.

### Collection options

```js
app.db.createCollection('tasks', null, { nulls: 'first' });
app.db.tasks.setOptions({ nulls: 'last' });   // returns the collection
app.db.tasks.getOptions();                    // { nulls: 'last' }
```

| Option | Default | Description |
|---|---|---|
| `nulls` | `'last'` | Where `sort()` and `watch()` put missing and `null` values: `'last'` or `'first'`, in both directions |

An unknown value throws: `options.nulls must be "first" or "last"`.

# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

## [1.6.0] - 2026-10-29

### Added
- `collection.bulkWrite(operations, { ordered })` with `insertOne`, `updateOne`, `updateMany`, `replaceOne`, `deleteOne` and `deleteMany`: MongoDB counts and ids, one change event per type at the end, `BulkWriteError` with `writeErrors` and the partial `result`.
- An `_id` index: filters on `_id` (`{ _id: x }`, `$eq`, `$in`) find documents without scanning, in `find`, `findOne`, `count`, updates, `replaceOne`, deletes and `bulkWrite`.
- `sort(spec, { nulls: 'first' | 'last' })`, and collection options: `createCollection(name, schema, { nulls })`, `collection.setOptions()` / `getOptions()`.
- `cursor.ids()`, `cursor.forEach()` and iteration (`for...of`) over copies.
- `collection.stream(url, options)`: rows loaded in blocks from a Server-Sent Events endpoint (`meta`, `rows`, `ops`, `delete`, `end`, `abort` events), with custom headers and POST (fetch transport) or `EventSource`, reconnection with `Last-Event-ID`, upserts by `_id`, progress and error callbacks.
- `collection.connect(url, options)` and `sorla.connect(url, options)`: WebSocket request / reply (`load()` pages, `request()`), pushed `rows` / `ops` / `delete` applied to the collection, queued requests while connecting, reconnection with back off, heartbeats and timeouts.
- `sorla.readEventStream(body, onEvent)`: the text/event-stream parser.
- Regular expressions inside `$in` / `$nin`.

### Changed
- **Missing and null values sort last** in both directions by default (they came first in ascending order, as in MongoDB). Use `{ nulls: 'first' }` per sort or per collection for the previous ascending order.
- `find()` no longer copies every matching document: the cursor keeps references and copies a document only when it is read (`next`, `toArray`, `first`, `last`, iteration). Results are the same copies as before, and a cursor is a snapshot of the moment `find()` ran.

## [1.5.1] - 2026-10-29

### Fixed
- Inserts were quadratic: every inserted document re-read the ids of the whole collection, so `insertMany` of 100 000 documents took minutes. The ids are now read once per call, and a performance test guards it.

## [1.5.0] - 2026-10-29

### Added
- `collection.bindForm(form, options)`: binds an HTML form to the collection (insert or update mode, values converted with the schema, errors next to each field, validation as fields are left, `generate: true` to build the fields from the schema, `sorla:saved` / `sorla:invalid` events, a controller with `values`, `fill`, `validate`, `submit`, `load`, `reset`, `destroy`).
- `collection.applyDefaults(doc)`: copy of a document with the schema defaults.
- `example/form_example.html`.

## [1.4.0] - 2026-10-29

### Added
- Schema validation with a subset of JSON Schema: `type` (plus `date`), `required`, `properties`, `additionalProperties`, `enum`, `const`, numeric ranges, `minLength` / `maxLength` / `pattern` / `format` (email, date, date-time, uri), `items` / `minItems` / `maxItems` / `uniqueItems`, and `default`. Function schemas are supported too.
- `sorla.ValidationError` with `errors: [{ path, rule, message }]`.
- `collection.validate(doc)`, `collection.setSchema(schema)` and `collection.getSchema()`.

### Fixed
- The schema given to `createCollection(name, schema)` was never stored (the setter checked an undefined variable).

## [1.3.0] - 2026-10-29

### Added
- `updateOne` / `updateMany` with `$set`, `$unset`, `$inc`, `$push` (`$each`) and `$pull`, `"a.b"` paths and `{ upsert }`.
- `replaceOne`, `deleteOne`, `deleteMany`, and `count(query)`.
- Change events: `collection.on / once / off` for `insert`, `update`, `replace`, `delete` and `change`.
- Query operators `$regex` (with `$options`, or a RegExp value) and `$exists`.
- `cursor.skip()` and `cursor.limit()`; inclusion projection (`{ name: 1 }`).
- `sorla.listDatabases()`, `sorla.dropDb()`, `db.listCollections()`, `db.getCollection()`, `db.dropCollection()`, `db.getStats()`.
- Type declarations for all of the above.

### Changed
- `cursor.projection()` returns the cursor and throws on invalid projections.

## [1.2.0] - 2026-10-29

### Fixed
- `insertOne` no longer crashes on `null` values, and `insertOne(null)` is rejected.
- Every nested object and array item is validated for prohibited keys (validation stopped at the first object).
- A duplicated `_id` is rejected.
- `cursor.sort()` works (it always threw `documents is not a constructor` because of circular requires).
- `findOne()` returns `null` when nothing matches; `first()` / `last()` return `null` on an empty cursor.
- `toArray()` returns plain copies (it threw a DataCloneError).
- `"a.b"` paths return `undefined` when a step is missing (they returned the parent object).
- Documents work with symbol keys (`String(doc)`, template literals, spreading).
- Assigning a field of a stored document throws a clear error instead of `instanceof is not callable`.
- `insertMany` no longer prints to the console; projection no longer prints removed fields.

### Added
- `insertOne` returns the inserted `_id`, `insertMany` returns the ids, and callbacks receive them.
- `insertMany` validates the whole batch before inserting anything.
- `sort()` follows MongoDB's order across types, supports `"a.b"` paths and a `collation` option, and returns the cursor.
- `require('sorla-db')` and `import sorla from 'sorla-db'` work; TypeScript declarations (`index.d.ts`).
- Tests run on GitHub Actions (Node 18, 20, 22, 24).

### Changed
- `insertOne` stores a copy: the given object no longer receives `_id` and is no longer linked to the stored document. Use the returned id.
- `last()` returns the document data, like `first()`.
- The browser bundle no longer includes faker: 1.6 MB → 9.5 kB. The npm package ships only the library (16 files, 13 kB).
- Node 18+ is required.

## [1.1.0] - 2026-10-28

### Added
- Nested logical operators: `$and`, `$or` and `$nor` at any depth.
- Several operators per field, at the top level and inside logical operators.

### Fixed
- Nested `$and` / `$or` threw `this[operator] is not a function`.
- Only the first operator of a field was evaluated inside `$and` / `$or`.
- `$not` negates the whole condition.
- `null` values can be used in query conditions.

### Changed
- A document without the queried field matches `$ne` and `$nin`, like MongoDB.

## [1.0.0]

- First release.

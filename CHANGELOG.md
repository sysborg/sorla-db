# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

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

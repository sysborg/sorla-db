# Testing and development

## Running the tests

```bash
git clone https://github.com/sysborg/sorla-db.git
cd sorla-db
npm install
npm test
```

`npm test` runs two suites:

1. **Jest** (`jest`): 223 tests in `test/*.test.js` against the sources.
2. **Framework bindings** (`node --test test/adapters/adapters.test.mjs`): the React, Vue, Svelte and
   Angular bindings and RxJS interop, against the real libraries (installed as dev dependencies).

```bash
npx jest                                  # only Jest
npx jest test/feature_cursor.test.js      # one file
npx jest -t "bulkWrite"                   # tests whose name matches
npx jest --watch                          # re-run on save
node --test test/adapters/adapters.test.mjs
```

GitHub Actions runs `npm test` on every push to `main` and every pull request, on Node 18, 20, 22 and
24 (`.github/workflows`).

## What is tested

| File | Covers |
|---|---|
| `unit_*.test.js` | the `sorla` class, databases, documents (read-only proxies), operators, the clone fallback |
| `feature_insert.test.js` | ids, copies, key rules, duplicates, atomic `insertMany` |
| `feature_database.test.js` | databases and collections, `getCollection`, `getStats`, drops |
| `feature_collection*.test.js` | `find`, `findOne`, `count`, every query operator |
| `feature_nested_queries.test.js` | `$and` / `$or` / `$nor` / `$not` nested at any depth |
| `feature_query_equivalence.test.js` | **500 random nested queries** checked against a reference implementation |
| `feature_cursor.test.js` | reading, sort order of mixed types, `nulls`, collation, paging, projection |
| `feature_update_delete.test.js` | update operators, upserts, `replaceOne`, deletes, errors |
| `feature_bulk_write.test.js` | `bulkWrite`, `BulkWriteError`, the `_id` index, copy-on-read cursors and snapshots |
| `feature_schema.test.js` | every schema keyword, defaults, function schemas, the schema API |
| `feature_form.test.js` | `bindForm` insert, update, conversion, errors, generated fields (jsdom) |
| `feature_live_query.test.js` | `watch()`: batching, stable identity, projection, store and Observable contracts |
| `feature_sync.test.js` | SSE against a real HTTP server (drops, `Last-Event-ID`, 4xx, retries), the event-stream parser, the WebSocket client (fake socket), copy-on-write updates |
| `feature_performance.test.js` | linear inserts and updates (generous time limits) |
| `package.test.js` | the package entries, the browser bundle (size budget, `window.sorla`, newest API present) |
| `adapters/adapters.test.mjs` | React, Vue, Svelte, Angular, RxJS |

### Testing your own code that uses sorla-db

sorla-db runs in Node, so your unit tests need no browser:

```js
// tasks.test.js (Jest, Vitest or node:test)
const sorla = require('sorla-db');

let tasks;
beforeEach(() => {
  const app = new sorla();          // a fresh instance per test: nothing leaks between tests
  app.useDb('test');
  app.db.createCollection('tasks');
  tasks = app.db.tasks;
});

test('completing a task', () => {
  const id = tasks.insertOne({ title: 'Write tests', done: false });
  completeTask(tasks, id);
  expect(tasks.findOne({ _id: id }).done).toBe(true);
});
```

For forms, use jsdom (`testEnvironment: 'jsdom'` in Jest, or create a `JSDOM` and pass its form
element). For SSE and WebSocket, pass `fetch`, `EventSource` or `WebSocket` implementations in the
options (see how `test/feature_sync.test.js` does it).

## Building

```bash
npm run build     # dist/sorla.min.js
```

`index.js` bundles `src/sorla.js` with browserify and minifies it with terser into
`dist/sorla.min.js`, which registers `window.sorla`. A failed build exits with an error, so a stale
bundle never stays behind. `package.test.js` checks the bundle: no dev dependencies inside, under its
size budget (64 kB), and the newest API present.

Sources are CommonJS (`src/`), `index.mjs` is the ES module entry, `index.d.ts` the declarations, and
`adapters/` the framework bindings (ES modules). Avoid syntax newer than ES2020 in `src/` (for example
`??=`): browserify's parser does not accept it.

## Project layout

```
src/
  sorla.js                    entry: the sorla class, static connect / stream / readEventStream
  dbs/database.js             databases (collections as properties)
  collections/collection.js   collection: forms, stream, connect, watch
  query_language/
    query.js                  find, findOne, count, options
    manipulation.js           inserts, updates, deletes, bulkWrite, the _id index
    operators.js              query operators
    update.js                 update operators (copy on write)
  documents/
    document.js               read-only document wrapper
    cursor.js                 cursors, sorting
  schema/schema.js            JSON Schema subset, ValidationError
  form/form.js                bindForm
  live/live-query.js          watch()
  sync/                       sse.js, socket.js, apply.js
  events.js, clone.js, utils.js
adapters/                     react, vue, svelte, angular (.mjs + .d.ts)
test/                         Jest suites and test/adapters
example/                      form_example.html, simple_data_example.html, sse_server.js
docs/                         this documentation (en, pt-BR)
```

## Contributing

1. Fork, create a branch (`feat/…`, `fix/…`, `perf/…`).
2. Write the test first; keep `npm test` green.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(cursor): …`, `fix(update): …`.
4. Update `CHANGELOG.md` under `[Unreleased]`, `README.md` and these docs when behavior changes.
5. Run `npm run build` when `src/` changed and commit `dist/` with it.
6. Open a pull request.

## Releasing

```bash
npm version 1.8.0 --no-git-tag-version   # package.json and package-lock.json
# CHANGELOG: [Unreleased] → [1.8.0] - date
npm test && npm run build
git commit -am "chore(release): 1.8.0"
git tag -a v1.8.0 -m v1.8.0
git push origin main v1.8.0
npm publish
```

The project follows [Semantic Versioning](https://semver.org/).

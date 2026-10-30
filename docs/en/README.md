# sorla-db documentation

**English** · [Português (Brasil)](../pt-BR/README.md)

A document database for the browser and Node: MongoDB queries, schema validation, change events,
live queries for React / Vue / Svelte / Angular, form binding, and loading from a backend over
Server-Sent Events or WebSocket. No server, no dependencies, 54 kB.

```bash
npm install sorla-db
```

| | Page | What you will learn |
|---|---|---|
| 1 | [Getting started](01-getting-started.md) | install (npm, CDN), the first five minutes |
| 2 | [Databases and collections](02-databases-and-collections.md) | `useDb`, `createCollection`, stats, options |
| 3 | [Documents and inserting](03-documents-and-inserting.md) | ids, copies, rules, `insertOne`, `insertMany` |
| 4 | [Querying](04-querying.md) | `find`, `findOne`, `count` and every query operator |
| 5 | [Cursors](05-cursors.md) | reading, sorting, paging, projection, snapshots |
| 6 | [Updating and deleting](06-updating-and-deleting.md) | update operators, upsert, `replaceOne`, deletes, `bulkWrite` |
| 7 | [Schema validation](07-schema-validation.md) | JSON Schema keywords, defaults, function schemas |
| 8 | [Forms](08-forms.md) | `bindForm`: insert and edit with an HTML form |
| 9 | [Events](09-events.md) | `on`, `once`, `off` and the payloads |
| 10 | [Live queries and frameworks](10-live-queries.md) | `watch()`, React, Vue, Svelte, Angular, RxJS |
| 11 | [Server sync](11-server-sync.md) | Server-Sent Events in blocks, WebSocket pages and pushes |
| 12 | [Using the console](12-console.md) | devtools and Node REPL recipes |
| 13 | [TypeScript](13-typescript.md) | types for documents, results and bindings |
| 14 | [Performance](14-performance.md) | what is fast, why, and tips |
| 15 | [Testing and development](15-testing-and-development.md) | the test suites, testing your app, building, contributing, releasing |
| 16 | [Cookbook and FAQ](16-cookbook.md) | recipes to copy, frequent questions |

New here? Start with [Getting started](01-getting-started.md): the first five minutes take exactly that.

# Live queries and frameworks

`watch()` keeps the result of a query current as the collection changes. It is the base of the React,
Vue, Svelte and Angular bindings, and works on its own too.

```js
const open = tasks.watch({ done: false }, { sort: { due: 1 } });

const off = open.subscribe(list => render(list));   // called now, then after every change
tasks.insertOne({ title: 'New', done: false });     // render runs again (once per batch of writes)
off();
```

## watch(query, options)

| Option | Description |
|---|---|
| `sort` | like `cursor.sort()`: `{ due: 1, title: 1 }` |
| `nulls`, `collation` | like the sort options (the collection default for `nulls`) |
| `skip`, `limit` | a window of the sorted result (`limit: 0` means none) |
| `projection` | the fields of the documents handed out; sorting can still use the others |

| Member | Description |
|---|---|
| `subscribe(fn)` | `fn(documents)` now and after every change; returns `unsubscribe` (also `unsubscribe.unsubscribe()`). Accepts an observer `{ next }` too |
| `getSnapshot()` | The current array |
| `length` | Number of documents |
| `close()` | Ends every subscription |

What you get:

- **Frozen copies.** The array and every document are frozen; changing them throws in strict mode.
- **Stable identity.** `getSnapshot()` returns the same array until something changes. After a change,
  only the documents that changed are copied again; the others keep their object, so frameworks can
  skip rows that did not change (`React.memo`, keyed `{#each}`, `track`).
- **One notification per batch.** Writes made in one go (a loop of updates, a `bulkWrite`, an SSE
  block) notify once, on the next microtask.
- **Watching only while used.** The collection is observed only while there are subscribers, so there
  is nothing to close, and a live query nobody uses costs nothing. `getSnapshot()` without subscribers
  still returns current data.

```js
const top = products.watch({ available: true }, { sort: { sold: -1 }, limit: 10, projection: { name: 1, sold: 1 } });
```

## React

```jsx
import { useQuery, useDocument } from 'sorla-db/react';

function OpenTasks() {
  const tasks = useQuery(app.db.tasks, { done: false }, { sort: { due: 1 } });
  return (
    <ul>
      {tasks.map(task => <TaskItem key={task._id} task={task} />)}
    </ul>
  );
}

function TaskTitle({ id }) {
  const task = useDocument(app.db.tasks, id);   // the document or null
  return <h1>{task?.title ?? 'Not found'}</h1>;
}

const TaskItem = React.memo(({ task }) => <li>{task.title}</li>);   // re-renders only changed tasks
```

- Built on `useSyncExternalStore`, so it is safe with concurrent rendering, and renders on the server
  with the current data.
- Queries are compared **by value**: writing the query inline creates a new object on each render, but
  the subscription is kept until the query really changes.
- Unmounting unsubscribes. `StrictMode` double effects are fine.

## Vue

```vue
<script setup>
import { ref } from 'vue';
import { useQuery } from 'sorla-db/vue';

const owner = ref('ana');
const tasks = useQuery(app.db.tasks, () => ({ owner: owner.value, done: false }), { sort: { due: 1 } });
</script>

<template>
  <select v-model="owner"><option>ana</option><option>bia</option></select>
  <li v-for="task in tasks" :key="task._id">{{ task.title }}</li>
</template>
```

`useQuery` returns a read-only shallow ref. The collection, the query and the options can be refs or
getters: when their value changes the query restarts, and it stops with the component (effect scope).

## Svelte

```svelte
<script>
  import { query, documentStore } from 'sorla-db/svelte';
  const tasks = query(app.db.tasks, { done: false }, { sort: { due: 1 } });
  const first = documentStore(app.db.tasks, 't1');
</script>

{#each $tasks as task (task._id)}
  <li>{task.title}</li>
{/each}
<p>{$first?.title}</p>
```

A live query **is** a Svelte store (`subscribe` follows the store contract), so `$tasks` works in
Svelte 3, 4 and 5 without the adapter too: `const tasks = app.db.tasks.watch({ done: false })`.

## Angular

```ts
import { Component } from '@angular/core';
import { querySignal, documentSignal } from 'sorla-db/angular';

@Component({
  selector: 'app-tasks',
  template: `
    @for (task of tasks(); track task._id) { <li>{{ task.title }}</li> }
    <h2>{{ first()?.title }}</h2>
  `
})
export class TasksComponent {
  tasks = querySignal(app.db.tasks, { done: false }, { sort: { due: 1 } });
  first = documentSignal(app.db.tasks, 't1');
}
```

`querySignal` returns a read-only signal and must run in an injection context (a field initializer or
the constructor), or receive `{ injector }` as the fourth argument. It stops when the component or
service is destroyed.

## RxJS and other Observable libraries

A live query implements the Observable interop (`Symbol.observable` / `'@@observable'`):

```js
import { from, map } from 'rxjs';

from(app.db.tasks.watch({ done: false }))
  .pipe(map(list => list.length))
  .subscribe(count => badge.textContent = count);
```

## Vanilla JavaScript

```js
const list = document.querySelector('#tasks');
app.db.tasks.watch({ done: false }, { sort: { due: 1 } }).subscribe(tasks => {
  list.replaceChildren(...tasks.map(task => Object.assign(document.createElement('li'), { textContent: task.title })));
});
```

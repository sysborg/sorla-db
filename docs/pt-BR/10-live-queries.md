# Consultas vivas e frameworks

`watch()` mantém o resultado de uma consulta atualizado conforme a coleção muda. Ele é a base das
integrações com React, Vue, Svelte e Angular, e também funciona sozinho.

```js
const open = tasks.watch({ done: false }, { sort: { due: 1 } });

const off = open.subscribe(list => render(list));   // chamado agora e depois de cada mudança
tasks.insertOne({ title: 'New', done: false });     // render roda de novo (uma vez por lote de escritas)
off();
```

## watch(query, options)

| Opção | Descrição |
|---|---|
| `sort` | como em `cursor.sort()`: `{ due: 1, title: 1 }` |
| `nulls`, `collation` | como nas opções de ordenação (o padrão da coleção para `nulls`) |
| `skip`, `limit` | uma janela do resultado ordenado (`limit: 0` significa sem limite) |
| `projection` | os campos dos documentos entregues; a ordenação ainda pode usar os demais |

| Membro | Descrição |
|---|---|
| `subscribe(fn)` | `fn(documents)` agora e depois de cada mudança; retorna `unsubscribe` (também `unsubscribe.unsubscribe()`). Aceita também um observer `{ next }` |
| `getSnapshot()` | O array atual |
| `length` | Número de documentos |
| `close()` | Encerra todas as inscrições |

O que você ganha:

- **Cópias congeladas.** O array e cada documento são congelados; alterá-los lança um erro no modo
  estrito.
- **Identidade estável.** `getSnapshot()` retorna o mesmo array até que algo mude. Depois de uma
  mudança, apenas os documentos que mudaram são copiados de novo; os outros mantêm o mesmo objeto,
  então os frameworks podem pular as linhas que não mudaram (`React.memo`, `{#each}` com chave, `track`).
- **Uma notificação por lote.** Escritas feitas de uma vez (um loop de updates, um `bulkWrite`, um bloco
  SSE) notificam uma única vez, na próxima microtarefa.
- **Observação só enquanto está em uso.** A coleção só é observada enquanto houver inscritos, então não
  há nada para fechar, e uma consulta viva que ninguém usa não custa nada. `getSnapshot()` sem inscritos
  continua retornando dados atuais.

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
  const task = useDocument(app.db.tasks, id);   // o documento ou null
  return <h1>{task?.title ?? 'Not found'}</h1>;
}

const TaskItem = React.memo(({ task }) => <li>{task.title}</li>);   // renderiza de novo apenas as tarefas que mudaram
```

- Construído sobre `useSyncExternalStore`, então é seguro com renderização concorrente e renderiza no
  servidor com os dados atuais.
- As consultas são comparadas **por valor**: escrever a consulta inline cria um novo objeto a cada
  renderização, mas a inscrição é mantida até que a consulta realmente mude.
- Desmontar o componente cancela a inscrição. Os efeitos duplicados do `StrictMode` não são problema.

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

`useQuery` retorna uma shallow ref somente leitura. A coleção, a consulta e as opções podem ser refs ou
getters: quando o valor delas muda, a consulta recomeça, e ela para junto com o componente (effect
scope).

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

Uma consulta viva **é** uma store do Svelte (`subscribe` segue o contrato de store), então `$tasks`
funciona no Svelte 3, 4 e 5 mesmo sem o adaptador: `const tasks = app.db.tasks.watch({ done: false })`.

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

`querySignal` retorna um signal somente leitura e precisa rodar em um contexto de injeção (no
inicializador de um campo ou no construtor), ou receber `{ injector }` como quarto argumento. Ele para
quando o componente ou serviço é destruído.

## RxJS e outras bibliotecas de Observable

Uma consulta viva implementa a interoperabilidade de Observable (`Symbol.observable` / `'@@observable'`):

```js
import { from, map } from 'rxjs';

from(app.db.tasks.watch({ done: false }))
  .pipe(map(list => list.length))
  .subscribe(count => badge.textContent = count);
```

## JavaScript puro

```js
const list = document.querySelector('#tasks');
app.db.tasks.watch({ done: false }, { sort: { due: 1 } }).subscribe(tasks => {
  list.replaceChildren(...tasks.map(task => Object.assign(document.createElement('li'), { textContent: task.title })));
});
```

# Primeiros passos

O sorla-db é um banco de dados de documentos que vive na memória, no navegador ou no Node. Você
guarda objetos JavaScript comuns, faz consultas com a linguagem de consulta do MongoDB que talvez
você já conheça, e ainda ganha validação por schema, eventos de mudança, consultas vivas para React /
Vue / Svelte / Angular, integração com formulários e carregamento a partir de um backend via
Server-Sent Events ou WebSocket. Sem servidor, sem configuração, sem dependências.

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

## Por que os desenvolvedores escolhem o sorla-db

- **Familiar.** `find`, `updateOne`, `$in`, `$regex`, `$set`, `bulkWrite`… O vocabulário do MongoDB,
  então há pouco a aprender e as consultas podem ser compartilhadas com um backend MongoDB.
- **Seguro por padrão.** Você sempre recebe cópias; os documentos guardados não podem ser alterados
  por acidente. Os lotes são validados antes de qualquer gravação.
- **Rápido.** Um índice de `_id`, cursores que copiam só o que você lê, atualizações que copiam só o
  que mudou. 100 000 documentos rodam com folga.
- **Reativo.** `watch()` mantém uma consulta sempre atualizada, e as integrações a transformam em um
  hook do React, um ref do Vue, uma store do Svelte ou um signal do Angular.
- **Conectado.** Carregue um milhão de linhas em blocos via Server-Sent Events, ou pagine e receba
  mudanças ao vivo por um WebSocket.
- **Pequeno.** Um único arquivo de 54 kB para o navegador, ou um pacote CommonJS / ES module com
  tipos TypeScript.

## Instalação

### npm

```bash
npm install sorla-db
```

```js
// CommonJS (Node, bundlers mais antigos)
const sorla = require('sorla-db');

// ES modules (Vite, webpack, esbuild, Node com "type": "module")
import sorla from 'sorla-db';
// ou: import { sorla } from 'sorla-db';
```

### Uma tag script, sem etapa de build

```html
<script src="https://cdn.jsdelivr.net/npm/sorla-db@1/dist/sorla.min.js"></script>
<script>
  const app = new window.sorla();   // o bundle registra a classe como window.sorla
  app.useDb('demo');
</script>
```

O mesmo arquivo está em `node_modules/sorla-db/dist/sorla.min.js`, caso você mesmo queira servi-lo.
O unpkg também funciona: `https://unpkg.com/sorla-db@1/dist/sorla.min.js`.

### Integrações com frameworks

As integrações fazem parte do pacote; instale o framework que você usa normalmente.

```js
import { useQuery } from 'sorla-db/react';     // React 18+
import { useQuery } from 'sorla-db/vue';       // Vue 3.3+
import { query } from 'sorla-db/svelte';       // Svelte 3, 4, 5
import { querySignal } from 'sorla-db/angular'; // Angular 16+
```

Veja [Consultas vivas e frameworks](10-live-queries.md).

### Requisitos

| Ambiente | Versão |
|---|---|
| Navegadores | qualquer navegador atual (ES2020) |
| Node | 18 ou superior (fetch, ReadableStream, structuredClone); a suíte de testes roda no Node 24 |
| TypeScript | declarações incluídas (`index.d.ts`) |

## Seus primeiros cinco minutos

```js
const app = new sorla();

// 1. um banco: useDb cria o banco quando necessário e o seleciona
app.useDb('todo');

// 2. uma coleção, opcionalmente com um schema
app.db.createCollection('tasks', {
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 1 },
    done: { type: 'boolean', default: false },
    due: { type: ['string', 'null'], format: 'date' }
  }
});
const tasks = app.db.tasks;

// 3. inserir: são guardadas cópias, e os ids são gerados (uuid v4), a menos que você informe o _id
const id = tasks.insertOne({ title: 'Write the docs', due: '2026-11-01' });
tasks.insertMany([{ title: 'Ship it' }, { title: 'Celebrate', due: '2026-11-02' }]);

// 4. consultar
tasks.find({ done: false }).sort({ due: 1 }).toArray();
tasks.findOne({ _id: id });            // { _id, title: 'Write the docs', done: false, due: '2026-11-01' }
tasks.count({ due: { $exists: true } });

// 5. alterar e reagir
tasks.on('change', event => console.log(event.type, event.ids));
tasks.updateOne({ _id: id }, { $set: { done: true } });   // exibe: update [id]
tasks.deleteMany({ done: true });                         // exibe: delete [id]
```

A ordenação coloca os valores ausentes e `null` por último (o `due` acima), nas duas direções. Isso é
configurável, veja [Cursores](05-cursors.md#ordenação).

## Para onde ir agora

| Eu quero… | Leia |
|---|---|
| organizar os dados em bancos e coleções | [Bancos de dados e coleções](02-databases-and-collections.md) |
| entender ids, cópias e o que pode ser guardado | [Documentos e inserção](03-documents-and-inserting.md) |
| escrever consultas | [Consultas](04-querying.md) |
| ordenar, paginar, projetar e ler resultados | [Cursores](05-cursors.md) |
| alterar e remover dados, inclusive em massa | [Atualizando e excluindo](06-updating-and-deleting.md) |
| rejeitar dados inválidos | [Validação por schema](07-schema-validation.md) |
| conectar um formulário HTML | [Formulários](08-forms.md) |
| reagir a mudanças | [Eventos](09-events.md) e [Consultas vivas](10-live-queries.md) |
| carregar dados de um backend | [Sincronização com o servidor: SSE e WebSocket](11-server-sync.md) |
| explorar pelo console do navegador | [Usando o console](12-console.md) |
| tipar tudo | [TypeScript](13-typescript.md) |
| lidar com muitos dados | [Desempenho](14-performance.md) |
| rodar os testes ou contribuir | [Testes e desenvolvimento](15-testing-and-development.md) |
| copiar uma receita pronta | [Receitas e perguntas frequentes](16-cookbook.md) |

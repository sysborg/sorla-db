# Receitas e perguntas frequentes

Receitas curtas e completas para você copiar.

## Uma lista de tarefas com persistência

```js
const app = new sorla();
app.useDb('todo');
app.db.createCollection('tasks', {
  required: ['title'],
  properties: { title: { type: 'string', minLength: 1 }, done: { type: 'boolean', default: false } }
});
const tasks = app.db.tasks;

// carrega o que foi salvo e depois salva a cada mudança
tasks.insertMany(JSON.parse(localStorage.getItem('tasks') ?? '[]'));
tasks.on('change', () => localStorage.setItem('tasks', JSON.stringify(tasks.find({}).toArray())));

// renderiza sempre que a lista muda
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

## Busca enquanto você digita

```js
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
input.addEventListener('input', () => {
  const pattern = { $regex: escape(input.value), $options: 'i' };
  const results = products.find({ $or: [{ name: pattern }, { tags: pattern }] }).limit(20).toArray();
  render(results);
});
```

## Um paginador

```js
function page(query, { page = 1, size = 20, sort = { _id: 1 } } = {}) {
  const total = products.count(query);
  const rows = products.find(query).sort(sort).skip((page - 1) * size).limit(size).toArray();
  return { rows, total, pages: Math.ceil(total / size) };
}
```

## Cache de respostas da API

```js
async function loadProducts() {
  if (products.count()) return products.find({}).toArray();
  const rows = await (await fetch('/api/products')).json();
  products.insertMany(rows);
  return products.find({}).toArray();
}
```

## Mesclando dados do servidor (linhas novas e existentes)

```js
function merge(rows) {
  const existing = new Set(products.find({ _id: { $in: rows.map(r => r._id) } }).ids());
  return products.bulkWrite(rows.map(row => existing.has(row._id)
    ? { replaceOne: { filter: { _id: row._id }, replacement: row } }
    : { insertOne: { document: row } }));
}
```

## Desfazer a última mudança

```js
const undo = [];
products.on('update', ({ ids, previous }) => undo.push({ ids, previous }));
function undoLast() {
  const last = undo.pop();
  if (!last) return;
  products.bulkWrite(last.ids.map((id, i) => ({ replaceOne: { filter: { _id: id }, replacement: last.previous[i] } })));
}
```

(Desfazer também emite um evento `update`; pule o registro enquanto desfaz se você precisar de uma
pilha de refazer.)

## Agrupar e somar

```js
function sumBy(collection, field, value, query = {}) {
  const totals = {};
  for (const doc of collection.find(query)) totals[doc[field]] = (totals[doc[field]] ?? 0) + doc[value];
  return totals;
}
sumBy(orders, 'city', 'total', { status: 'done' });   // { Recife: 1520, Curitiba: 830 }
```

## Exportar e importar JSON ou CSV

```js
const json = JSON.stringify(orders.find({}).toArray());

const toCsv = rows => {
  const fields = Object.keys(rows[0] ?? {});
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [fields.join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\n');
};
const csv = toCsv(orders.find({}, { _id: 0 }).toArray());
```

## Um formulário com validação em três linhas

```js
app.db.createCollection('contacts', { required: ['name', 'email'], properties: { name: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' } } });
app.db.contacts.bindForm('#contact', { generate: true, onSuccess: () => alert('Thanks!') });
```

## Uma instância compartilhada entre módulos

```js
// db.js
import sorla from 'sorla-db';
export const app = new sorla();
app.useDb('app');
for (const name of ['users', 'orders', 'products']) app.db.createCollection(name);
export const { users, orders, products } = app.db;

// em qualquer lugar
import { orders } from './db.js';
```

## Perguntas frequentes

**Os dados são salvos quando a página recarrega?**
Não, o sorla-db vive na memória. Salve com um ouvinte de eventos (veja a receita da lista de tarefas)
ou recarregue do seu servidor; para grandes volumes de dados, envie-os em fluxo com
[Server-Sent Events](11-server-sync.md).

**Posso usar no servidor?**
Sim: ele roda no Node 18+, o que é útil para testes, scripts, caches e para responder às mesmas
consultas que o seu frontend envia (veja o servidor WebSocket em [Sincronização com o servidor](11-server-sync.md)).

**Quão parecido ele é com o MongoDB?**
A linguagem de consulta, os operadores de atualização, o `bulkWrite`, as projeções e os resultados
seguem o MongoDB. Diferenças: `{ field: null }` corresponde só a `null` (não a campos ausentes),
campos ausentes e `null` ficam por último na ordenação por padrão, não há pipelines de agregação nem
índices secundários, e `_id` pode ser qualquer valor.

**Por que recebo cópias em vez dos objetos armazenados?**
Para que nada fora da coleção altere os dados dela por acidente. Os cursores copiam só o que você lê,
então as cópias custam pouco; `ids()` e `count()` não copiam nada.

**Posso armazenar instâncias de classes ou funções?**
Não: os documentos precisam ser dados clonáveis (objetos, arrays, strings, números, booleanos, `null`, `Date`).

**Como adiciono um índice em outro campo?**
Só o `_id` é indexado. Consultas em outros campos percorrem a coleção, o que leva milissegundos para
dezenas de milhares de documentos. Se você busca muito por outra chave, use-a como `_id`.

**E a concorrência?**
O JavaScript executa uma coisa de cada vez, então toda chamada é atômica. `insertMany`, `updateMany` e
cada operação do `bulkWrite` validam antes de escrever.

**Funciona com o meu framework?**
Sim: React, Vue, Svelte e Angular têm integrações, e qualquer coisa que entenda Observables ou
callbacks simples funciona com `watch()`. Veja [Consultas vivas](10-live-queries.md).

**Qual é o tamanho?**
Cerca de 54 kB minificado para o bundle do navegador, com formulários, validação de schema, consultas
vivas e os dois transportes de sincronização incluídos.

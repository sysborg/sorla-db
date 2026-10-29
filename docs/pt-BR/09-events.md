# Eventos

As coleções avisam sobre cada mudança. Use eventos para salvar no `localStorage`, sincronizar com um
servidor, registrar logs ou atualizar uma interface manualmente (para interfaces, as
[consultas vivas](10-live-queries.md) costumam ser mais simples).

```js
const off = products.on('change', event => {
  console.log(event.type, event.ids);   // 'update' ['tea']
});
products.updateOne({ _id: 'tea' }, { $set: { price: 9 } });
off();   // para de ouvir
```

## Tipos de evento

| Evento | Emitido por | Conteúdo |
|---|---|---|
| `insert` | `insertOne`, `insertMany`, upserts, inserções do `bulkWrite` | `{ type, ids, documents }` |
| `update` | `updateOne`, `updateMany`, atualizações do `bulkWrite` | `{ type, ids, documents, previous }` |
| `replace` | `replaceOne` | `{ type, ids, documents, previous }` |
| `delete` | `deleteOne`, `deleteMany` | `{ type, ids, documents }` |
| `change` | todos os anteriores | o mesmo conteúdo; `type` diz qual foi |

`documents` são cópias das novas versões e `previous` são cópias das versões anteriores a um update ou
replace, na ordem de `ids`. Para `delete`, `documents` são os próprios documentos removidos (eles não
estão mais na coleção).

## Um evento por operação

`insertMany`, `updateMany` e `deleteMany` emitem **um** evento para a operação inteira, e o
`bulkWrite` emite um por tipo, no final. Uma escrita que não muda nada (atualizar um campo com o valor
que ele já tem, remover com um filtro que não corresponde a nada) não emite nada.

## API

```js
const off = products.on('update', listener);     // retorna uma função para cancelar a inscrição
products.once('insert', listener);                // apenas o próximo
products.off('update', listener);                 // remove um ouvinte
products.off('update');                           // remove todos os ouvintes desse tipo
```

## Ouvintes não quebram escritas

Um ouvinte que lança um erro não desfaz nem interrompe a escrita, e os outros ouvintes continuam
rodando; o erro é relançado de forma assíncrona para aparecer no console.

## Cópias só quando alguém está ouvindo

As cópias em `documents` e `previous` só são feitas quando existe um ouvinte para aquele tipo ou para
`change`. Sem ouvintes, uma escrita não paga nada pelos eventos.

## Receitas

```js
// persistir uma coleção no localStorage
const save = () => localStorage.setItem('tasks', JSON.stringify(tasks.find({}).toArray()));
tasks.on('change', save);
tasks.insertMany(JSON.parse(localStorage.getItem('tasks') ?? '[]'));

// enviar as mudanças para um servidor
tasks.on('change', ({ type, ids, documents }) => fetch('/api/tasks/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type, ids, documents })
}));

// um histórico de auditoria
const history = [];
users.on('update', ({ ids, documents, previous }) =>
  ids.forEach((id, i) => history.push({ id, before: previous[i], after: documents[i], at: Date.now() })));
```

# Atualizando e removendo

```js
products.updateOne({ _id: 'tea' }, { $set: { price: 9 }, $inc: { sold: 1 } });
products.updateMany({ stock: 0 }, { $set: { available: false } });
products.replaceOne({ _id: 'tea' }, { name: 'Green tea', price: 10 });
products.deleteOne({ _id: 'juice' });
products.deleteMany({ available: false });
products.bulkWrite([ /* várias das operações acima em uma única chamada */ ]);
```

Os filtros são [consultas](04-querying.md). Filtros por `_id` usam o índice, então `{ _id: x }` é o jeito
mais rápido de chegar a um documento.

## updateOne e updateMany

```js
collection.updateOne(filter, update, { upsert })    // o primeiro que corresponder
collection.updateMany(filter, update, { upsert })   // todos que corresponderem
// → { matchedCount, modifiedCount, upsertedId }
```

`modifiedCount` conta os documentos que realmente mudaram: definir um campo com o valor que ele já
tem conta como correspondência, mas não como modificação (e não emite evento).

### Operadores de atualização

| Operador | Efeito | Exemplo |
|---|---|---|
| `$set` | Define campos, criando os objetos que faltarem ao longo de caminhos `"a.b"` | `{ $set: { price: 9, 'supplier.city': 'Franca' } }` |
| `$unset` | Remove campos (o valor é ignorado) | `{ $unset: { discount: '' } }` |
| `$inc` | Soma um número; um campo ausente começa em 0 | `{ $inc: { stock: -1, sold: 1 } }` |
| `$push` | Adiciona ao final de um array (criado se não existir); `$each` adiciona vários | `{ $push: { tags: 'new' } }`, `{ $push: { tags: { $each: ['a', 'b'] } } }` |
| `$pull` | Remove itens do array iguais a um valor, que atendam a uma condição ou que correspondam a um subdocumento | `{ $pull: { tags: 'old' } }`, `{ $pull: { scores: { $lt: 5 } } }`, `{ $pull: { items: { ok: false } } }` |

Você pode combinar vários operadores em uma mesma atualização. Uma atualização deve conter apenas
operadores; um objeto simples (`{ price: 9 }`) lança um erro e indica o `replaceOne`.

### Atualizações seguras

- **Atômicas por chamada.** Cada nova versão é calculada e validada antes de qualquer documento ser
  substituído: se o `$inc` encontrar um campo de texto no 500º documento de um `updateMany`, nada muda.
- **O `_id` não pode mudar** (`The _id field cannot be updated`).
- **Schema verificado.** Com um schema, a nova versão precisa satisfazê-lo (`ValidationError`).
- **Erros claros.** `Cannot $inc "name": it is not a number`, `Cannot $push to "tags": it is not an array`,
  `Unknown update operator $rename`.

### Upsert

```js
users.updateOne(
  { email: 'ana@example.com' },
  { $set: { name: 'Ana' }, $inc: { visits: 1 } },
  { upsert: true }
);
// nada correspondeu: insere { email: 'ana@example.com', name: 'Ana', visits: 1 }
// → { matchedCount: 0, modifiedCount: 0, upsertedId: '…' }
```

O novo documento parte das condições de igualdade do filtro (`field: value` e
`field: { $eq: value }` no nível mais externo) e, em seguida, a atualização é aplicada. Os valores
padrão do schema são preenchidos.

## replaceOne

```js
products.replaceOne({ _id: 'tea' }, { name: 'Green tea', price: 10 });
products.replaceOne({ name: 'Mate' }, { name: 'Mate', price: 7 }, { upsert: true });
```

Substitui o documento inteiro do primeiro que corresponder e mantém o seu `_id` (um `_id` diferente
no documento substituto lança um erro). O documento substituto não pode conter operadores de
atualização.

## deleteOne e deleteMany

```js
products.deleteOne({ _id: 'tea' });       // { deletedCount: 1 }
products.deleteMany({ price: { $gt: 100 } });
products.deleteMany({});                  // esvazia a coleção
```

Um filtro é sempre obrigatório: `deleteMany()` sem filtro lança um erro
(`The filter must be a query object, use {} to match every document`), então esvaziar uma coleção é
sempre um `{}` intencional.

## bulkWrite

Várias escritas em uma única chamada, com as operações do MongoDB:

```js
const result = products.bulkWrite([
  { insertOne: { document: { _id: 'mate', name: 'Mate', price: 7 } } },
  { updateOne: { filter: { _id: 'tea' }, update: { $inc: { stock: 10 } } } },
  { updateMany: { filter: { stock: 0 }, update: { $set: { available: false } } } },
  { replaceOne: { filter: { _id: 'juice' }, replacement: { name: 'Orange juice', price: 11 }, upsert: true } },
  { deleteOne: { filter: { _id: 'old' } } },
  { deleteMany: { filter: { discontinued: true } } }
]);
// { insertedCount, matchedCount, modifiedCount, deletedCount, upsertedCount, insertedIds: { 0: 'mate' }, upsertedIds: {} }
```

- As operações rodam em ordem. Filtros por `_id` usam o índice: 50 000 `updateOne` por `_id` levam uma
  fração de segundo.
- **Um evento por tipo, no final**: um evento `update` listando todos os documentos atualizados, um
  `insert`… em vez de um por operação. Consultas vivas e ouvintes são atualizados uma única vez.
- **Erros, como no MongoDB.** Com `ordered: true` (o padrão), a primeira operação que falhar
  interrompe o lote; com `{ ordered: false }`, as demais continuam rodando. Em ambos os casos, as
  operações anteriores ao erro permanecem aplicadas, e um `BulkWriteError` informa o que aconteceu:

```js
try {
  products.bulkWrite(operations, { ordered: false });
} catch (error) {
  error.name;          // 'BulkWriteError'
  error.writeErrors;   // [{ index: 3, operation: {…}, error: ValidationError }]
  error.result;        // as contagens do que foi aplicado
}
```

Use `bulkWrite` para aplicar mudanças vindas de um servidor, para importar dados que misturam linhas
novas e existentes, ou para atualizar muitos documentos por id com valores diferentes.

## Eventos

Toda escrita que muda alguma coisa emite um evento (`insert`, `update`, `replace`, `delete`, e
`change` para todos eles); veja [Eventos](09-events.md). Escritas que não mudam nada não emitem nada.

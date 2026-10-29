# Documentos e inserção

Um documento é um objeto comum: strings, números, booleanos, `null`, arrays, objetos aninhados e
objetos `Date`. Todo documento tem um `_id`.

```js
{
  _id: '6f1c…',            // gerado, ou o seu
  name: 'Coffee',
  price: 12.5,
  tags: ['hot'],
  supplier: { name: 'Fazenda Boa', city: 'Patrocínio' },
  createdAt: new Date()
}
```

## Regras para documentos

| Regra | O que acontece se não for cumprida |
|---|---|
| O documento é um objeto (não um array, nem `null`) | `Error: Invalid document type` |
| Nenhuma chave contém `$` ou `.`, em qualquer nível | `Error: Invalid document keys` (`$` inicia operadores, `.` separa caminhos) |
| Os valores podem ser clonados: nada de funções, nós do DOM ou instâncias de classe com estado privado | `Error: Documents can only contain cloneable values (no functions or DOM nodes)` |
| O `_id` é único na coleção | `Error: Duplicate _id "…"` |
| O schema, quando a coleção tem um, é respeitado | `ValidationError` com todos os problemas, veja [Validação por schema](07-schema-validation.md) |

O `_id` pode ser qualquer valor que você quiser (número, string…). Sem ele, o sorla-db gera uma
string uuid v4.

## Cópias em todo lugar

O sorla-db guarda uma **cópia** do que você insere e entrega **cópias** quando você lê:

```js
const product = { name: 'Coffee', tags: ['hot'] };
const id = products.insertOne(product);

product.tags.push('changed');               // o seu objeto: a coleção não vê a mudança
const copy = products.findOne({ _id: id });
copy.tags.push('also changed');             // uma cópia: a coleção também não vê
products.findOne({ _id: id }).tags;         // ['hot']
```

Os objetos que você passa nunca são modificados (o sorla-db não adiciona `_id` a eles). Os
documentos guardados também nunca são alterados no lugar: uma atualização guarda uma nova versão. É
isso que faz dos cursores snapshots consistentes e permite que as atualizações compartilhem as
partes inalteradas entre versões (veja [Desempenho](14-performance.md)).

## insertOne

```js
const id = products.insertOne({ name: 'Coffee', price: 12.5 });
products.insertOne({ _id: 'tea', name: 'Tea' }, id => console.log('stored', id));   // callback opcional
```

Retorna o `_id`. Os valores padrão do schema são preenchidos antes da validação (veja
[Validação por schema](07-schema-validation.md#valores-padrão)). Emite um evento `insert`.

## insertMany

```js
const ids = products.insertMany([
  { name: 'Tea', price: 8 },
  { name: 'Juice', price: 9.9 }
]);
// ['…', '…']
```

**Tudo ou nada:** o array inteiro é verificado primeiro (tipos, chaves, ids duplicados dentro do lote
e em relação à coleção, schema), então um único documento inválido faz com que nada seja guardado:

```js
try {
  products.insertMany([{ _id: 1, name: 'A' }, { _id: 1, name: 'B' }]);
} catch (error) {
  error.message;      // 'Duplicate _id "1"'
  products.count();   // inalterado
}
```

Emite um único evento `insert` para o lote inteiro. O segundo argumento, opcional, é um callback
que recebe os ids. A inserção é linear: 100 000 documentos levam bem menos de um segundo.

Precisa de inserções, atualizações e exclusões numa só chamada? Use
[`bulkWrite`](06-updating-and-deleting.md#bulkwrite).

## Datas

Objetos `Date` são guardados como datas (copiadas), comparados pelo tempo nas consultas e ordenados
depois dos outros tipos. Muitas aplicações guardam strings ISO no lugar (`'2026-11-01'`): elas são
ordenadas e comparadas corretamente como texto, e sobrevivem ao `JSON.stringify` quando você envia
os dados para um servidor.

```js
events.insertOne({ title: 'Launch', at: new Date('2026-11-01T10:00:00Z') });
events.find({ at: { $gte: new Date('2026-11-01') } });
```

## Objetos aninhados e arrays

Valores aninhados são acessados com caminhos com ponto nas consultas, na ordenação e nas
atualizações:

```js
products.insertOne({ name: 'Coffee', supplier: { city: 'Patrocínio' }, tags: ['hot', 'strong'] });
products.find({ 'supplier.city': 'Patrocínio' });
products.find({ tags: { $in: ['strong'] } });
products.updateOne({ name: 'Coffee' }, { $set: { 'supplier.city': 'Franca' } });
```

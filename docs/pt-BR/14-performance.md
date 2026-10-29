# Desempenho

O sorla-db foi feito para continuar rápido com 100 000 documentos e utilizável bem além disso. Esta
página explica o que o deixa rápido e como mantê-lo assim.

## O que é rápido

| Operação | Custo | Observações |
|---|---|---|
| `insertMany` | linear | 50 000 documentos em bem menos de um segundo |
| qualquer filtro em `_id` (`{ _id }`, `$eq`, `$in`) | constante por id | usa o índice em leituras, atualizações, exclusões e `bulkWrite` |
| `find(query)` | uma passada pelos documentos | sem cópias: o cursor guarda referências |
| `cursor.ids()`, `length`, `count(query)` | | nenhuma cópia |
| `toArray()` / iteração | proporcional ao que você lê | `skip` e `limit` antes da leitura copiam só uma página |
| `updateOne` por `_id` | constante | copia só o caminho alterado do documento |
| `bulkWrite` de 100 000 `$set` por `_id` | cerca de 180 ms | um evento por tipo, no final |
| `watch()` após uma mudança | proporcional aos documentos alterados | mais uma reordenação do resultado |

## Por quê

- **Um índice em `_id`.** Toda coleção mantém um mapa de `_id` para a posição. Filtros em `_id` vão
  direto aos documentos; as demais condições da mesma consulta continuam sendo verificadas.
- **Cópia na leitura, não na busca.** Um cursor guarda referências aos documentos armazenados e só
  copia um documento quando você o lê. Filtrar 100 000 documentos para contá-los, ou para obter os
  ids deles, não copia nenhum.
- **Documentos armazenados imutáveis.** O sorla-db nunca altera um documento armazenado no lugar: uma
  atualização armazena uma nova versão. Isso transforma os cursores em snapshots consistentes sem custo
  extra e permite que uma atualização copie só os objetos ao longo do caminho alterado; o resto é
  compartilhado com a versão anterior.
- **Os eventos só copiam quando há alguém ouvindo.** Sem ouvintes, as escritas não copiam nada para os
  eventos.
- **Lotes.** `insertMany`, `updateMany` e `bulkWrite` emitem um evento por tipo de operação, então
  ouvintes e consultas vivas fazem o trabalho uma vez só.

## Dicas

```js
// ✔ conte sem ler
orders.count({ status: 'open' });
// ✘ orders.find({ status: 'open' }).toArray().length

// ✔ ids, quando é só disso que você precisa
const ids = orders.find({ status: 'open' }).ids();

// ✔ pagine antes de ler
orders.find({}).sort({ due: 1 }).skip(200).limit(50).toArray();

// ✔ acesse os documentos por _id
orders.updateOne({ _id: id }, { $set: { status: 'done' } });

// ✔ muitas atualizações com valores diferentes: um único bulkWrite
orders.bulkWrite(changes.map(c => ({ updateOne: { filter: { _id: c.id }, update: { $set: c.fields } } })));
// ✘ um laço de chamadas a updateOne com um ouvinte ou uma consulta viva: uma notificação por chamada

// ✔ pare a iteração cedo: o resto nunca é copiado
for (const order of orders.find({ total: { $gt: 1000 } })) { if (found(order)) break; }

// ✔ use projeção em documentos grandes quando precisar só de alguns campos
orders.find({}, { _id: 1, total: 1 }).toArray();
```

## Memória

Cada documento é armazenado uma única vez. As cópias só existem enquanto você mantém os resultados que
leu. Um cursor com 100 000 resultados custa um array de 100 000 referências (menos de 1 MB). No
navegador, algumas centenas de milhares de documentos com uma dúzia de campos cabem com folga; para
milhões, carregue-os em blocos com [Server-Sent Events](11-server-sync.md) e mantenha só o que a tela
precisa, ou pagine a partir do servidor.

## Medindo

```js
console.time('query');
orders.find({ city: { $in: ['Recife', 'Natal'] }, total: { $gte: 100 } }).sort({ total: -1 }).limit(20).toArray();
console.timeEnd('query');
```

A suíte de testes tem testes de desempenho com limites folgados que pegam comportamentos quadráticos
acidentais (`test/feature_performance.test.js`, `test/feature_bulk_write.test.js`, `test/feature_live_query.test.js`).

# Bancos de dados e coleções

```
sorla instance
└── databases            app.useDb('shop'), app.createDb('archive')
    └── collections      app.db.createCollection('products')
        └── documents    app.db.products.insertOne({ … })
```

Uma instância de `sorla` comporta quantos bancos você quiser; um deles fica selecionado e acessível
como `app.db`. Um banco contém coleções, e as coleções contêm documentos. Tudo vive na memória
enquanto a instância existir.

## A instância sorla

```js
const app = new sorla();
```

| Método | Retorna | Descrição |
|---|---|---|
| `useDb(name)` | `void` | Seleciona um banco, criando-o quando ele não existe |
| `createDb(name)` | `number \| false` | Cria um banco sem selecioná-lo; `false` quando o nome já existe |
| `dbExists(name)` | `boolean` | |
| `listDatabases()` | `string[]` | Nomes, na ordem de criação |
| `countDb()` | `number` | |
| `dropDb(name)` | `boolean` | Remove um banco e tudo o que há nele; se ele estava selecionado, `app.db` passa a ser `null` |
| `db` | `Database \| null` | O banco selecionado |

```js
app.useDb('shop');          // criado e selecionado
app.createDb('archive');    // criado, 'shop' continua selecionado
app.listDatabases();        // ['shop', 'archive']
app.useDb('archive');       // troca de banco
app.dropDb('archive');      // app.db agora é null
```

Instâncias de `sorla` separadas não compartilham nada: chamar `new sorla()` duas vezes gera dois
conjuntos de bancos independentes.

### Membros estáticos

| Membro | Descrição |
|---|---|
| `sorla.ValidationError` | O erro lançado quando um documento viola o schema, veja [Validação por schema](07-schema-validation.md) |
| `sorla.connect(url, options)` | Uma conexão WebSocket não vinculada a uma coleção, veja [Sincronização com o servidor](11-server-sync.md#websocket) |
| `sorla.stream(url, { apply })` | Um stream de Server-Sent Events tratado pelo seu código, veja [Sincronização com o servidor](11-server-sync.md#server-sent-events) |
| `sorla.readEventStream(body, onEvent)` | O parser de `text/event-stream` |

## Bancos de dados

| Membro | Retorna | Descrição |
|---|---|---|
| `createCollection(name, schema?, options?)` | `void` | Lança um erro quando o nome já existe. `schema` é um subconjunto de JSON Schema ou uma função; `options` é `{ nulls: 'last' \| 'first' }` |
| `getCollection(name)` | `Collection \| undefined` | Funciona com qualquer nome, inclusive nomes que não são propriedades válidas |
| `listCollections()` | `string[]` | Nomes, na ordem de criação |
| `countCollections()` | `number` | |
| `dropCollection(name)` | `boolean` | Remove uma coleção e seus documentos |
| `getStats()` | `{ name, documents, collections: [{ name, documents }] }` | Contagem de documentos |
| `name` | `string` | |

As coleções também são propriedades do banco:

```js
app.db.createCollection('products');
app.db.products === app.db.getCollection('products');   // true
app.db['order-items'];                                     // nomes com hífen funcionam com colchetes
```

Uma coleção com o mesmo nome de um método do banco (`name`, `getStats`…) esconde o método no acesso
por propriedade; `getCollection(name)` sempre retorna a coleção.

```js
app.db.getStats();
// { name: 'shop', documents: 3, collections: [{ name: 'products', documents: 3 }] }
```

## Coleções

A coleção é onde o trabalho acontece. A lista completa de membros, com links:

| Grupo | Membros |
|---|---|
| Inserção | [`insertOne`](03-documents-and-inserting.md#insertone), [`insertMany`](03-documents-and-inserting.md#insertmany) |
| Leitura | [`find`](04-querying.md), [`findOne`](04-querying.md#findone), [`count`](04-querying.md#count), `first`, `last`, `all` |
| Alteração | [`updateOne`, `updateMany`, `replaceOne`, `deleteOne`, `deleteMany`, `bulkWrite`](06-updating-and-deleting.md) |
| Schema | [`setSchema`, `getSchema`, `validate`, `applyDefaults`](07-schema-validation.md) |
| Opções | [`setOptions`, `getOptions`](#opções-da-coleção) |
| Eventos | [`on`, `once`, `off`](09-events.md) |
| Reatividade | [`watch`](10-live-queries.md) |
| Formulários | [`bindForm`](08-forms.md) |
| Backend | [`stream`, `connect`](11-server-sync.md) |

### first, last e all

```js
products.first;   // cópia do primeiro documento na ordem de inserção, ou null
products.last;    // cópia do último, ou null
products.all;     // os documentos guardados (wrappers somente leitura), na ordem de inserção
```

`all` entrega os wrappers internos sem copiar: leia os campos com `doc.name` ou `doc['a.b']`, e não
guarde essas referências esperando dados atualizados (uma atualização guarda um novo objeto). Para
qualquer outra coisa, prefira `find({})`.

### Opções da coleção

```js
app.db.createCollection('tasks', null, { nulls: 'first' });
app.db.tasks.setOptions({ nulls: 'last' });   // retorna a coleção
app.db.tasks.getOptions();                    // { nulls: 'last' }
```

| Opção | Valor padrão | Descrição |
|---|---|---|
| `nulls` | `'last'` | Onde `sort()` e `watch()` colocam os valores ausentes e `null`: `'last'` ou `'first'`, nas duas direções |

Um valor desconhecido lança o erro: `options.nulls must be "first" or "last"`.

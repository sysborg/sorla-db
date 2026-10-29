# Usando o console

O sorla-db é ótimo de explorar de forma interativa: abra as devtools do navegador (F12) ou um REPL do Node e
experimente consultas com dados reais antes de escrever código.

## No navegador

Em qualquer página que carregue o bundle (ou cole-o no console de uma aba vazia):

```js
// carrega na hora a partir de uma CDN
await new Promise((resolve, reject) => {
  const script = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/sorla-db@1/dist/sorla.min.js', onload: resolve, onerror: reject });
  document.head.append(script);
});

const app = new sorla();          // window.sorla é a classe
app.useDb('play');
app.db.createCollection('people');
app.db.people.insertMany([
  { name: 'Ana', age: 31, city: 'Recife' },
  { name: 'Bruno', age: 17, city: 'Curitiba' },
  { name: 'Carla', age: 45, city: 'Recife' }
]);
```

### Veja os resultados em forma de tabela

```js
console.table(app.db.people.find({ city: 'Recife' }).toArray());
console.table(app.db.people.find({}, { name: 1, age: 1, _id: 0 }).sort({ age: -1 }).toArray());
```

### Inspecione o que existe

```js
app.listDatabases();              // ['play']
app.db.listCollections();         // ['people']
app.db.getStats();                // { name, documents, collections: [{ name, documents }] }
app.db.people.count({ age: { $gte: 18 } });
app.db.people.getSchema();
app.db.people.getOptions();       // { nulls: 'last' }
```

### Acompanhe as mudanças em tempo real

```js
const off = app.db.people.on('change', e => console.log(e.type, e.ids, e.documents));
app.db.people.updateOne({ name: 'Ana' }, { $inc: { age: 1 } });   // exibe: update [...] [...]
off();

// uma consulta viva no console
const adults = app.db.people.watch({ age: { $gte: 18 } }, { sort: { name: 1 } });
adults.subscribe(list => console.log('adults:', list.map(p => p.name).join(', ')));
```

### Meça o tempo de uma consulta

```js
console.time('find');
app.db.people.find({ city: { $regex: 'rec', $options: 'i' } }).sort({ age: 1 }).toArray();
console.timeEnd('find');
```

### Preencha uma coleção com dados de teste

```js
const cities = ['Recife', 'Curitiba', 'São Paulo', 'Manaus'];
app.db.people.insertMany(Array.from({ length: 100000 }, (_, i) => ({
  _id: i + 1, name: `Person ${i + 1}`, age: i % 90, city: cities[i % cities.length]
})));
console.time('count'); app.db.people.count({ city: 'Recife', age: { $gte: 30 } }); console.timeEnd('count');
```

### Inspecione os dados da sua aplicação

Quando a sua aplicação guarda a instância em algum lugar acessível, você pode consultar os dados dela
ao vivo pelo console. Um padrão comum é expô-la em desenvolvimento:

```js
if (import.meta.env?.DEV) window.app = app;   // Vite; com webpack, use process.env.NODE_ENV
```

Depois, `app.db.orders.find({ status: 'open' }).toArray()` no console mostra exatamente o que a interface usa.

### Salve e carregue um snapshot

```js
copy(JSON.stringify(app.db.people.find({}).toArray()));   // devtools do Chrome: para a área de transferência
localStorage.setItem('people', JSON.stringify(app.db.people.find({}).toArray()));
app.db.people.insertMany(JSON.parse(localStorage.getItem('people')));
```

## No Node

```bash
npm install sorla-db
node
```

```js
> const sorla = require('sorla-db')
> const app = new sorla(); app.useDb('repl'); app.db.createCollection('c')
> app.db.c.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }])
[ '…', '…', '…' ]
> app.db.c.find({ n: { $gt: 1 } }).toArray()
[ { n: 2, _id: '…' }, { n: 3, _id: '…' } ]
> console.table(app.db.c.find({}).toArray())
```

Comandos de uma linha para uma verificação rápida:

```bash
node -e "const s=require('sorla-db');const a=new s();a.useDb('x');a.db.createCollection('c');a.db.c.insertMany([{n:1},{n:5}]);console.log(a.db.c.count({n:{\$gt:2}}))"
```

Carregue um arquivo JSON e faça consultas nele:

```js
const fs = require('node:fs');
app.db.createCollection('orders');
app.db.orders.insertMany(JSON.parse(fs.readFileSync('orders.json', 'utf8')));
console.table(app.db.orders.find({ total: { $gt: 1000 } }).sort({ total: -1 }).limit(10).toArray());
```

## Os erros são fáceis de ler no console

As mensagens dizem o que está errado e como corrigir:

```
Error: The update can only contain operators, use replaceOne() to replace a document (found "price")
Error: The filter must be a query object, use {} to match every document
ValidationError: Invalid document: email must be a valid email (and 1 more)
Error: schema.properties.a: unknown keyword "tpye"
Error: Sort direction of "age" must be 1 or -1
```

Objetos `ValidationError` têm `errors` com todos os problemas; expanda-os no console ou use
`console.table(error.errors)`.

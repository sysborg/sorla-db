# Using the console

sorla-db is pleasant to explore interactively: open the browser devtools (F12) or a Node REPL and try
queries against real data before writing code.

## In the browser

On any page that loads the bundle (or paste it into the console of an empty tab):

```js
// load it on the fly from a CDN
await new Promise((resolve, reject) => {
  const script = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/sorla-db@1/dist/sorla.min.js', onload: resolve, onerror: reject });
  document.head.append(script);
});

const app = new sorla();          // window.sorla is the class
app.useDb('play');
app.db.createCollection('people');
app.db.people.insertMany([
  { name: 'Ana', age: 31, city: 'Recife' },
  { name: 'Bruno', age: 17, city: 'Curitiba' },
  { name: 'Carla', age: 45, city: 'Recife' }
]);
```

### See results as a table

```js
console.table(app.db.people.find({ city: 'Recife' }).toArray());
console.table(app.db.people.find({}, { name: 1, age: 1, _id: 0 }).sort({ age: -1 }).toArray());
```

### Inspect what is there

```js
app.listDatabases();              // ['play']
app.db.listCollections();         // ['people']
app.db.getStats();                // { name, documents, collections: [{ name, documents }] }
app.db.people.count({ age: { $gte: 18 } });
app.db.people.getSchema();
app.db.people.getOptions();       // { nulls: 'last' }
```

### Watch changes as they happen

```js
const off = app.db.people.on('change', e => console.log(e.type, e.ids, e.documents));
app.db.people.updateOne({ name: 'Ana' }, { $inc: { age: 1 } });   // logs: update [...] [...]
off();

// a live query in the console
const adults = app.db.people.watch({ age: { $gte: 18 } }, { sort: { name: 1 } });
adults.subscribe(list => console.log('adults:', list.map(p => p.name).join(', ')));
```

### Time a query

```js
console.time('find');
app.db.people.find({ city: { $regex: 'rec', $options: 'i' } }).sort({ age: 1 }).toArray();
console.timeEnd('find');
```

### Fill a collection with test data

```js
const cities = ['Recife', 'Curitiba', 'São Paulo', 'Manaus'];
app.db.people.insertMany(Array.from({ length: 100000 }, (_, i) => ({
  _id: i + 1, name: `Person ${i + 1}`, age: i % 90, city: cities[i % cities.length]
})));
console.time('count'); app.db.people.count({ city: 'Recife', age: { $gte: 30 } }); console.timeEnd('count');
```

### Inspect your application's data

When your app keeps the instance somewhere reachable, you can query its live data from the console.
A common pattern is to expose it in development:

```js
if (import.meta.env?.DEV) window.app = app;   // Vite; use process.env.NODE_ENV with webpack
```

Then `app.db.orders.find({ status: 'open' }).toArray()` in the console shows exactly what the UI uses.

### Save and load a snapshot

```js
copy(JSON.stringify(app.db.people.find({}).toArray()));   // Chrome devtools: to the clipboard
localStorage.setItem('people', JSON.stringify(app.db.people.find({}).toArray()));
app.db.people.insertMany(JSON.parse(localStorage.getItem('people')));
```

## In Node

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

One-liners for a quick check:

```bash
node -e "const s=require('sorla-db');const a=new s();a.useDb('x');a.db.createCollection('c');a.db.c.insertMany([{n:1},{n:5}]);console.log(a.db.c.count({n:{\$gt:2}}))"
```

Load a JSON file and query it:

```js
const fs = require('node:fs');
app.db.createCollection('orders');
app.db.orders.insertMany(JSON.parse(fs.readFileSync('orders.json', 'utf8')));
console.table(app.db.orders.find({ total: { $gt: 1000 } }).sort({ total: -1 }).limit(10).toArray());
```

## Errors read well in the console

Messages say what is wrong and how to fix it:

```
Error: The update can only contain operators, use replaceOne() to replace a document (found "price")
Error: The filter must be a query object, use {} to match every document
ValidationError: Invalid document: email must be a valid email (and 1 more)
Error: schema.properties.a: unknown keyword "tpye"
Error: Sort direction of "age" must be 1 or -1
```

`ValidationError` objects have `errors` with every issue; expand them in the console or
`console.table(error.errors)`.

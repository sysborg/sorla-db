# Consultas

As consultas são objetos na linguagem de consulta do MongoDB. `find(query)` retorna um
[cursor](05-cursors.md), `findOne(query)` retorna o primeiro resultado e `count(query)` retorna a
quantidade de resultados.

```js
people.find({ city: 'Recife', age: { $gte: 18 } });
people.findOne({ email: 'ana@example.com' });
people.count({ active: true });
people.find({});                       // tudo
```

Os exemplos desta página usam esta coleção:

```js
const app = new sorla();
app.useDb('docs');
app.db.createCollection('people');
const people = app.db.people;
people.insertMany([
  { _id: 1, name: 'Ana',   age: 31, city: 'Recife',   tags: ['dev', 'ops'], address: { zip: '50000-000' } },
  { _id: 2, name: 'Bruno', age: 17, city: 'Curitiba', tags: ['design'] },
  { _id: 3, name: 'Carla', age: 45, city: 'Recife',   tags: [], manager: null },
  { _id: 4, name: 'Davi',  age: 28, city: 'São Paulo' }
]);
```

## find

```js
people.find(query, projection?)   // → Cursor
```

O cursor guarda os resultados; leia-os com `toArray()`, percorra-os com `for…of`, ordene, pagine e
muito mais, veja [Cursores](05-cursors.md). `projection` escolhe os campos:
`people.find({}, { name: 1 })`.

## findOne

```js
people.findOne({ city: 'Recife' });          // cópia da Ana, o primeiro resultado na ordem de inserção
people.findOne({ name: 'Nobody' });          // null
people.findOne({ _id: 3 }, { name: 1 });     // { _id: 3, name: 'Carla' }
```

## count

```js
people.count();                        // 4, todos os documentos
people.count({ city: 'Recife' });      // 2, sem copiar nada
```

## Condições de campo

Um valor simples significa igualdade; um objeto de operadores significa condições que precisam ser
todas verdadeiras:

```js
people.find({ city: 'Recife' });                       // igualdade
people.find({ age: { $gte: 18, $lt: 40 } });           // 18 ≤ age < 40: Ana, Davi
people.find({ city: 'Recife', age: { $gt: 40 } });     // vários campos: todos precisam bater (AND)
```

### Operadores de comparação

| Operador | Corresponde quando o campo… | Exemplo |
|---|---|---|
| `$eq` | é igual ao valor | `{ age: { $eq: 31 } }` (o mesmo que `{ age: 31 }`) |
| `$ne` | é diferente dele (inclusive quando o campo não existe) | `{ city: { $ne: 'Recife' } }` |
| `$gt`, `$gte` | é maior (ou igual) | `{ age: { $gt: 30 } }` |
| `$lt`, `$lte` | é menor (ou igual) | `{ age: { $lte: 17 } }` |
| `$in` | é igual a um dos valores (ou, num campo array, contém um deles) | `{ city: { $in: ['Recife', 'Curitiba'] } }` |
| `$nin` | não é igual a nenhum deles (inclusive quando não existe) | `{ tags: { $nin: ['dev'] } }` |
| `$exists` | existe (`true`) ou não (`false`) | `{ manager: { $exists: true } }` → Carla |
| `$regex` | é uma string que bate com um padrão | `{ name: { $regex: '^c', $options: 'i' } }` |
| `$not` | **não** satisfaz a condição interna | `{ age: { $not: { $gte: 18, $lte: 40 } } }` → Bruno, Carla |

As comparações funcionam com números, strings (por code point: `'B' < 'a'`) e objetos `Date` (pelo
tempo).

### $in e $nin

```js
people.find({ city: { $in: ['Recife', 'São Paulo'] } });   // Ana, Carla, Davi
people.find({ tags: { $in: ['ops', 'design'] } });         // Ana, Bruno: campos array contêm um deles
people.find({ name: { $in: [/^a/i, 'Davi'] } });           // expressões regulares batem com strings
people.find({ city: { $nin: ['Recife'] } });               // Bruno, Davi
```

`$in` e `$nin` exigem um array: `The $in operator must be an array`.

### $regex

```js
people.find({ name: { $regex: 'an' } });                     // diferencia maiúsculas: nenhum
people.find({ name: { $regex: 'an', $options: 'i' } });      // Ana
people.find({ name: /^b/i });                                // um valor RegExp funciona diretamente
people.find({ tags: { $regex: '^de' } });                    // arrays batem quando uma das strings bate
```

`$options` aceita `i` (ignora maiúsculas/minúsculas), `m` (multilinha) e `s` (o ponto também casa
com quebras de linha). Valores que não são string nunca batem. Para buscar um texto digitado pelo
usuário, escape-o:

```js
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
people.find({ name: { $regex: escape(input), $options: 'i' } });
```

### $exists, campos ausentes e null

| Consulta | Ana (sem `manager`) | Carla (`manager: null`) |
|---|---|---|
| `{ manager: null }` | | ✔ |
| `{ manager: { $exists: true } }` | | ✔ |
| `{ manager: { $exists: false } }` | ✔ | |
| `{ manager: { $eq: 'x' } }`, `$gt`, `$in`… | | |
| `{ manager: { $ne: 'x' } }`, `$nin` | ✔ | ✔ |

Um campo ausente bate com `$ne` e `$nin`, como no MongoDB. Diferente do MongoDB, `{ field: null }`
só encontra documentos em que o campo **é** `null`; para encontrar documentos sem o campo, use
`{ field: { $exists: false } }`, e para os dois casos,
`{ $or: [{ field: null }, { field: { $exists: false } }] }`.

## Operadores lógicos

```js
// OR: qualquer pessoa de Curitiba, ou com mais de 40 anos
people.find({ $or: [{ city: 'Curitiba' }, { age: { $gt: 40 } }] });         // Bruno, Carla

// AND escrito explicitamente (útil para repetir um campo)
people.find({ $and: [{ age: { $gte: 18 } }, { age: { $ne: 31 } }] });      // Carla, Davi

// NOR: nenhuma das condições
people.find({ $nor: [{ city: 'Recife' }, { age: { $lt: 18 } }] });         // Davi

// aninhe em qualquer nível e misture com campos
people.find({
  age: { $gte: 18 },
  $or: [
    { city: 'Recife', tags: { $in: ['dev'] } },
    { $and: [{ city: 'São Paulo' }, { name: { $regex: '^d', $options: 'i' } }] }
  ]
});                                                                             // Ana, Davi
```

| Operador | Valor | Corresponde quando |
|---|---|---|
| `$and` | array de consultas | todas batem |
| `$or` | array de consultas | pelo menos uma bate |
| `$nor` | array de consultas | nenhuma bate |
| `$not` | uma condição, dentro de um campo | a condição não é verdadeira |

Operadores lógicos precisam receber um array; operadores desconhecidos lançam um erro. A avaliação
para cedo: `$and` no primeiro falso, `$or` no primeiro verdadeiro.

## Campos aninhados

Caminhos com ponto acessam o interior dos objetos:

```js
people.find({ 'address.zip': '50000-000' });            // Ana
people.find({ 'address.zip': { $regex: '^5' } });
```

## Arrays

```js
people.find({ tags: { $in: ['dev'] } });     // contém 'dev'
people.find({ tags: { $exists: true } });    // tem o campo (o array vazio da Carla conta)
people.find({ tags: [] });                   // igualdade em arrays não é suportada: use $in / $exists
```

A igualdade é estrita: `{ tags: 'dev' }` **não** bate com `tags: ['dev', 'ops']`. Use `$in`.

## Consultas por _id usam o índice

`{ _id: x }`, `{ _id: { $eq: x } }` e `{ _id: { $in: [...] } }` vão direto aos documentos pelo
índice da coleção, em vez de percorrer tudo, em `find`, `findOne`, `count`, em toda atualização e
exclusão, e em `bulkWrite`. As outras condições da mesma consulta continuam sendo verificadas:

```js
people.find({ _id: { $in: [3, 1, 99] } }).ids();   // [1, 3], na ordem da coleção
people.find({ _id: 1, age: { $gt: 40 } }).length;   // 0
```

## Compartilhando consultas com um servidor

As consultas são JSON puro (exceto valores RegExp: use `{ $regex, $options }` no lugar), então você
pode enviar o mesmo objeto para um backend MongoDB, guardá-lo ou montá-lo com uma interface de
construção de consultas:

```js
const query = { $and: [{ age: { $gte: 30 } }, { $or: [{ name: 'Ana' }, { city: { $in: ['A', 'B'] } }] }] };
fetch('/api/people?where=' + encodeURIComponent(JSON.stringify(query)));
people.find(query);   // o mesmo resultado localmente
```

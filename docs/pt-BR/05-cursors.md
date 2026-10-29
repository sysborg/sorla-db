# Cursores

`find()` retorna um cursor: os documentos encontrados, prontos para serem ordenados, paginados,
projetados e lidos.

```js
const page = people.find({ city: 'Recife' })
  .sort({ age: -1, name: 1 })
  .skip(20)
  .limit(10)
  .toArray();
```

## Como um cursor funciona

Um cursor guarda **referências** aos documentos armazenados, não cópias. A busca, `sort()`, `skip()`,
`limit()`, `length` e `ids()` não copiam nada; um documento só é copiado quando você o **lê** com
`next()`, `toArray()`, `first()`, `last()`, `forEach()` ou `for…of`. Ler uma página de um milhão de
resultados copia uma página.

Os documentos armazenados nunca são alterados no lugar (uma atualização guarda uma nova versão),
então um cursor é um **snapshot**, um retrato consistente: ele continua mostrando os documentos como
eram quando o `find()` rodou, mesmo que sejam atualizados ou excluídos depois.

```js
const cursor = people.find({ city: 'Recife' });
people.updateOne({ _id: 1 }, { $set: { age: 99 } });
cursor.toArray()[0].age;          // 31: o snapshot
people.find({ _id: 1 }).first().age;   // 99: um novo find enxerga a mudança
```

## Leitura

| Membro | Retorna | Descrição |
|---|---|---|
| `toArray()` | `object[]` | Cópias de todos os documentos, como objetos comuns |
| `for (const doc of cursor)` | `object` a cada vez | Copia um de cada vez (pare antes com `break` e o restante nunca é copiado) |
| `forEach(fn)` | `void` | `fn(copy, index)` para cada documento |
| `first()` / `last()` | `object \| null` | Cópia do primeiro / último documento |
| `ids()` | `unknown[]` | O `_id` de cada documento, **sem cópia nenhuma** |
| `length` | `number` | Quantidade de documentos |
| `hasNext()` / `next()` / `reset()` | | Percorre os documentos um a um; `next()` lança `No more item to the cursor` no final |

```js
for (const person of people.find({ age: { $gte: 18 } })) {
  if (person.name === 'Davi') break;   // os documentos depois do Davi nunca são copiados
}

const ids = people.find({ tags: { $in: ['dev'] } }).ids();   // [1]

const cursor = people.find({});
while (cursor.hasNext()) {
  const doc = cursor.next();   // uma cópia envolvida como documento: doc.name, doc._data
}
cursor.reset();                 // começa de novo
```

`next()` retorna um wrapper de documento (os campos são lidos como propriedades, e os dados ficam em
`doc._data`); os outros métodos de leitura retornam objetos comuns. Em ambos os casos, são cópias.

## Ordenação

```js
people.find({}).sort({ age: 1 });               // crescente
people.find({}).sort({ city: 1, age: -1 });     // por cidade, depois por idade decrescente
people.find({}).sort({ 'address.zip': 1 });     // caminhos aninhados
```

`1` é crescente, `-1` é decrescente; qualquer outro valor lança um erro
(`Sort direction of "age" must be 1 or -1`). `sort()` ordena no lugar e retorna o cursor. A ordenação
é estável: documentos considerados iguais mantêm a ordem de inserção.

### Valores ausentes e null

Valores ausentes e `null` ficam **por último** nas duas direções, como numa planilha:

```js
tasks.find({}).sort({ due: 1 });                          // tarefas com data primeiro, depois as sem data
tasks.find({}).sort({ due: -1 });                         // mais recentes primeiro, as sem data continuam no fim
tasks.find({}).sort({ due: 1 }, { nulls: 'first' });      // sem data primeiro
```

Defina o valor padrão de uma coleção com `createCollection(name, schema, { nulls: 'first' })` ou
`collection.setOptions({ nulls })`; a opção do sort tem prioridade sobre ele. Antes da 1.6, eles
vinham primeiro na ordem crescente (a ordem do MongoDB); `{ nulls: 'first' }` devolve essa ordem.

### Tipos misturados

Valores de tipos diferentes são ordenados como no MongoDB: números, strings, objetos, arrays,
booleanos, datas (e depois ausentes / null, ou no início com `nulls: 'first'`).

### Texto de acordo com o idioma

Por padrão, as strings são comparadas por code point (`'B' < 'a'`, `'é' > 'z'`). Passe uma collation,
com as opções do `Intl.Collator`, para ordenar segundo as regras do idioma:

```js
people.find({}).sort({ name: 1 }, { collation: { locale: 'pt-BR', sensitivity: 'base' } });
files.find({}).sort({ name: 1 }, { collation: { locale: 'en', numeric: true } });   // 'item 2' antes de 'item 10'
```

## Paginação

```js
const pageSize = 20;
const page = n => people.find({}).sort({ name: 1 }).skip(n * pageSize).limit(pageSize).toArray();
```

| Membro | Descrição |
|---|---|
| `skip(count)` | Descarta os primeiros `count` documentos (aplique depois do `sort`, como no MongoDB) |
| `limit(count)` | Mantém no máximo `count`; `0` significa sem limite |

Os dois exigem um inteiro não negativo. O total para um paginador é `people.count(query)` ou o
`length` do cursor antes do `skip`.

## Projeção

Escolha os campos das cópias que você recebe:

```js
people.find({}, { name: 1, age: 1 });   // só name, age e _id
people.find({}, { name: 1, _id: 0 });   // só name
people.find({}, { tags: 0 });           // tudo, menos tags
people.find({}).projection({ name: 1 }); // o mesmo que o segundo argumento
```

Inclusão (`1`) e exclusão (`0`) não podem ser misturadas, exceto para o `_id`; a projeção funciona
com campos de primeiro nível (`Projection supports top level fields only`). Ela se aplica às cópias:
os documentos armazenados mantêm todos os campos, e a ordenação pode usar campos que a projeção
esconde.

## Resumo rápido

```js
const c = people.find(query, projection);
c.sort({ field: 1 }, { nulls: 'last', collation: { locale: 'pt-BR' } });
c.skip(40).limit(20);
c.length;  c.ids();                        // sem cópias
c.toArray();  c.first();  c.last();        // cópias
for (const doc of c) {}  c.forEach(fn);     // cópias, uma de cada vez
c.hasNext();  c.next();  c.reset();
```

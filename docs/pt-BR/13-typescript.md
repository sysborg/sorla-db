# TypeScript

As declarações vêm junto com o pacote (`index.d.ts`, e uma para cada integração), então não há nada
para instalar.

```ts
import sorla from 'sorla-db';
import type { Collection, Document, Query, LiveQuery, BulkWriteOperation, ValidationIssue } from 'sorla-db';

const app = new sorla();
app.useDb('shop');
app.db.createCollection('products');
const products: Collection = app.db.products;
```

## Tipando os seus documentos

As coleções guardam documentos de qualquer formato; descreva os seus com uma interface e use-a onde
você faz a leitura:

```ts
interface Product extends Document {
  _id: string;
  name: string;
  price: number;
  tags?: string[];
}

const cheap = products.find({ price: { $lt: 10 } }).toArray() as Product[];
const tea = products.findOne({ _id: 'tea' }) as Product | null;

const live = products.watch<Product>({ available: true });
live.subscribe(list => list.forEach(product => product.price));   // readonly Readonly<Product>[]
```

As integrações com frameworks também são genéricas:

```ts
const products = useQuery<Product>(app.db.products, { available: true });    // React
const products = useQuery<Product>(app.db.products, { available: true });    // Vue: Ref<readonly Product[]>
const products = querySignal<Product>(app.db.products, { available: true }); // Angular: Signal<readonly Product[]>
```

## Principais tipos

| Tipo | O que é |
|---|---|
| `Document` | `Record<string, unknown> & { _id?: unknown }` |
| `Query` | uma consulta de busca: campos com valores ou `ComparisonOperators`, e `$and` / `$or` / `$nor` |
| `UpdateFilter` | `{ $set?, $unset?, $inc?, $push?, $pull? }` |
| `Projection` | `Record<string, 0 \| 1>` |
| `SortSpec`, `SortOptions` | `{ field: 1 \| -1 }`, `{ nulls?, collation? }` |
| `CollectionOptions` | `{ nulls?: 'first' \| 'last' }` |
| `UpdateResult`, `DeleteResult` | `{ matchedCount, modifiedCount, upsertedId }`, `{ deletedCount }` |
| `BulkWriteOperation`, `BulkWriteResult`, `BulkWriteError` | veja [bulkWrite](06-updating-and-deleting.md#bulkwrite) |
| `ChangeEvent`, `ChangeType` | conteúdo dos eventos, `'insert' \| 'update' \| 'replace' \| 'delete'` |
| `JSONSchema`, `SchemaFunction`, `ValidationIssue`, `ValidationError` | veja [Validação de schema](07-schema-validation.md) |
| `BindFormOptions`, `FormController`, `FormResult` | veja [Formulários](08-forms.md) |
| `LiveQuery<T>`, `LiveQueryOptions` | veja [Consultas vivas](10-live-queries.md) |
| `StreamOptions`, `StreamController`, `StreamState` | veja [Server-Sent Events](11-server-sync.md#server-sent-events) |
| `ConnectOptions`, `Remote`, `LoadParams`, `LoadResult` | veja [WebSocket](11-server-sync.md#websocket) |
| `Cursor`, `Collection`, `Database` | as classes |

## Capturando erros de validação

```ts
try {
  products.insertOne({ name: '' });
} catch (error) {
  if (error instanceof sorla.ValidationError) {
    const issues: ValidationIssue[] = error.errors;
  }
}
```

## Um helper tipado

Se você prefere tipos mais rígidos no ponto de chamada, um pequeno wrapper resolve:

```ts
function typed<T extends Document>(collection: Collection) {
  return {
    find: (query: Query = {}) => collection.find(query).toArray() as T[],
    findOne: (query: Query) => collection.findOne(query) as T | null,
    insert: (doc: Omit<T, '_id'> & { _id?: T['_id'] }) => collection.insertOne(doc as Document) as T['_id'],
    watch: (query: Query = {}) => collection.watch<T>(query)
  };
}

const productsDb = typed<Product>(app.db.products);
productsDb.insert({ name: 'Coffee', price: 12.5 });
```

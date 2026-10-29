# TypeScript

Declarations ship with the package (`index.d.ts`, and one per binding), so there is nothing to
install.

```ts
import sorla from 'sorla-db';
import type { Collection, Document, Query, LiveQuery, BulkWriteOperation, ValidationIssue } from 'sorla-db';

const app = new sorla();
app.useDb('shop');
app.db.createCollection('products');
const products: Collection = app.db.products;
```

## Typing your documents

Collections hold documents of any shape; describe yours with an interface and use it where you read:

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

The framework bindings are generic too:

```ts
const products = useQuery<Product>(app.db.products, { available: true });    // React
const products = useQuery<Product>(app.db.products, { available: true });    // Vue: Ref<readonly Product[]>
const products = querySignal<Product>(app.db.products, { available: true }); // Angular: Signal<readonly Product[]>
```

## Main types

| Type | What it is |
|---|---|
| `Document` | `Record<string, unknown> & { _id?: unknown }` |
| `Query` | a find query: fields with values or `ComparisonOperators`, and `$and` / `$or` / `$nor` |
| `UpdateFilter` | `{ $set?, $unset?, $inc?, $push?, $pull? }` |
| `Projection` | `Record<string, 0 \| 1>` |
| `SortSpec`, `SortOptions` | `{ field: 1 \| -1 }`, `{ nulls?, collation? }` |
| `CollectionOptions` | `{ nulls?: 'first' \| 'last' }` |
| `UpdateResult`, `DeleteResult` | `{ matchedCount, modifiedCount, upsertedId }`, `{ deletedCount }` |
| `BulkWriteOperation`, `BulkWriteResult`, `BulkWriteError` | see [bulkWrite](06-updating-and-deleting.md#bulkwrite) |
| `ChangeEvent`, `ChangeType` | event payloads, `'insert' \| 'update' \| 'replace' \| 'delete'` |
| `JSONSchema`, `SchemaFunction`, `ValidationIssue`, `ValidationError` | see [Schema validation](07-schema-validation.md) |
| `BindFormOptions`, `FormController`, `FormResult` | see [Forms](08-forms.md) |
| `LiveQuery<T>`, `LiveQueryOptions` | see [Live queries](10-live-queries.md) |
| `StreamOptions`, `StreamController`, `StreamState` | see [Server-Sent Events](11-server-sync.md#server-sent-events) |
| `ConnectOptions`, `Remote`, `LoadParams`, `LoadResult` | see [WebSocket](11-server-sync.md#websocket) |
| `Cursor`, `Collection`, `Database` | the classes |

## Catching validation errors

```ts
try {
  products.insertOne({ name: '' });
} catch (error) {
  if (error instanceof sorla.ValidationError) {
    const issues: ValidationIssue[] = error.errors;
  }
}
```

## A typed helper

If you like stricter types at the call site, a small wrapper does it:

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

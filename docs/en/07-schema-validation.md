# Schema validation

Give a collection a schema and every insert, update, replace and upsert must satisfy it. Bad data
never gets in, and you learn about every problem at once.

```js
app.db.createCollection('users', {
  required: ['name', 'email'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 80 },
    email: { type: 'string', format: 'email' },
    age: { type: ['integer', 'null'], minimum: 0, maximum: 150 },
    role: { enum: ['admin', 'user'], default: 'user' },
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 10 },
    createdAt: { type: 'date' },
    address: {
      type: 'object',
      required: ['zip'],
      properties: {
        zip: { type: 'string', pattern: '^\\d{5}-\\d{3}$' },
        city: { type: 'string', default: 'Recife' }
      }
    }
  }
});

app.db.users.insertOne({ name: 'Ana', email: 'ana@example.com', address: { zip: '50000-000' } });
// stored as { name, email, address: { zip, city: 'Recife' }, role: 'user', _id }
```

## When it fails

```js
try {
  app.db.users.insertOne({ name: 'A', email: 'not an email', extra: true });
} catch (error) {
  error instanceof sorla.ValidationError;   // true
  error.name;      // 'ValidationError'
  error.message;   // 'Invalid document: name must have at least 2 characters (and 2 more)'
  error.errors;
  // [
  //   { path: 'name',    rule: 'minLength', message: 'name must have at least 2 characters' },
  //   { path: 'email',   rule: 'format',    message: 'email must be a valid email' },
  //   { path: 'extra',   rule: 'additionalProperties', message: 'extra is not allowed' }
  // ]
}
```

Each issue has the field `path` (`address.zip`, `tags[1]`), the `rule` that failed and a readable
`message`. `insertMany`, `updateMany` and `bulkWrite` operations stay atomic: one invalid document
stores nothing in that call.

## Keywords

| Keyword | Applies to | Notes |
|---|---|---|
| `type` | any | `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`, `date` (a `Date` object), or several: `['string', 'null']` |
| `required` | objects | field names that must be present |
| `properties` | objects | a schema per field, nested at any depth |
| `additionalProperties` | objects | `false` rejects unknown fields; a schema validates them. `_id` is always allowed |
| `enum` | any | the value must be one of the list |
| `const` | any | the value must be exactly this |
| `minimum`, `maximum` | numbers | inclusive limits |
| `exclusiveMinimum`, `exclusiveMaximum` | numbers | exclusive limits |
| `minLength`, `maxLength` | strings | in characters (emoji count as one) |
| `pattern` | strings | a regular expression (string) the value must match |
| `format` | strings | `email`, `date` (`YYYY-MM-DD`), `date-time` (ISO 8601), `uri` |
| `items` | arrays | the schema of every item |
| `minItems`, `maxItems` | arrays | |
| `uniqueItems` | arrays | no repeated items |
| `default` | any | filled in on insert and upsert when the field is missing, also inside nested objects |
| `title`, `description`, `examples`, `$schema`, `$id` | any | annotations, ignored by validation (forms use `title` and `description`) |

Unknown keywords, types and formats **throw when the schema is set**, so a typo such as `tpye` or
`format: 'e-mail'` is caught right away instead of silently validating nothing.

## Defaults

```js
app.db.createCollection('tasks', {
  properties: {
    done: { type: 'boolean', default: false },
    tags: { type: 'array', default: [] },
    meta: { type: 'object', properties: { priority: { type: 'integer', default: 3 } } }
  }
});
app.db.tasks.insertOne({ title: 'x', meta: {} });
// { title: 'x', meta: { priority: 3 }, done: false, tags: [], _id }
```

Defaults are copied (each document gets its own array or object) and are applied before validation,
so a default counts for `required`. Updates do not fill defaults; upserts do.

## A function as schema

When rules depend on several fields, use a function. It returns `true` (or nothing) when the document
is valid, otherwise `false`, a message, or a list of messages or `{ path, message }` objects:

```js
app.db.createCollection('orders', order => {
  const problems = [];
  if (order.total < 0) problems.push({ path: 'total', message: 'total must not be negative' });
  if (order.status === 'shipped' && !order.trackingCode) problems.push('shipped orders need a tracking code');
  return problems.length ? problems : true;
});
```

The issues have `rule: 'custom'`. Function schemas have no defaults.

## Checking without storing

```js
app.db.users.validate({ name: 'Ana' });
// { valid: false, errors: [{ path: 'email', rule: 'required', message: 'email is required' }] }

app.db.users.applyDefaults({ name: 'Ana' });
// a copy with the defaults: { name: 'Ana', role: 'user' }
```

`validate` is what [forms](08-forms.md) use to show errors as the user types. `applyDefaults` shows
what `insertOne` would store.

## Changing the schema

```js
app.db.users.setSchema(newSchema);   // returns the collection; affects the next writes
app.db.users.setSchema(null);        // no schema
app.db.users.getSchema();            // the schema you gave, or null
```

Existing documents are not revalidated when the schema changes.

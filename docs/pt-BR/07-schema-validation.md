# Validação com schema

Dê um schema a uma coleção e todo insert, update, replace e upsert vai precisar satisfazê-lo. Dados
ruins nunca entram, e você fica sabendo de todos os problemas de uma vez.

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
// armazenado como { name, email, address: { zip, city: 'Recife' }, role: 'user', _id }
```

## Quando a validação falha

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

Cada problema traz o `path` do campo (`address.zip`, `tags[1]`), a `rule` que falhou e uma `message`
legível. As operações `insertMany`, `updateMany` e `bulkWrite` continuam atômicas: um único documento
inválido faz com que nada seja armazenado naquela chamada.

## Palavras-chave

| Palavra-chave | Aplica-se a | Observações |
|---|---|---|
| `type` | qualquer | `string`, `number`, `integer`, `boolean`, `object`, `array`, `null`, `date` (um objeto `Date`), ou vários: `['string', 'null']` |
| `required` | objetos | nomes dos campos que precisam estar presentes |
| `properties` | objetos | um schema por campo, aninhado em qualquer profundidade |
| `additionalProperties` | objetos | `false` rejeita campos desconhecidos; um schema os valida. `_id` é sempre permitido |
| `enum` | qualquer | o valor precisa ser um dos itens da lista |
| `const` | qualquer | o valor precisa ser exatamente este |
| `minimum`, `maximum` | números | limites inclusivos |
| `exclusiveMinimum`, `exclusiveMaximum` | números | limites exclusivos |
| `minLength`, `maxLength` | strings | em caracteres (um emoji conta como um) |
| `pattern` | strings | uma expressão regular (em string) à qual o valor precisa corresponder |
| `format` | strings | `email`, `date` (`YYYY-MM-DD`), `date-time` (ISO 8601), `uri` |
| `items` | arrays | o schema de cada item |
| `minItems`, `maxItems` | arrays | |
| `uniqueItems` | arrays | sem itens repetidos |
| `default` | qualquer | preenchido no insert e no upsert quando o campo está ausente, inclusive dentro de objetos aninhados |
| `title`, `description`, `examples`, `$schema`, `$id` | qualquer | anotações, ignoradas pela validação (os formulários usam `title` e `description`) |

Palavras-chave, tipos e formatos desconhecidos **lançam um erro no momento em que o schema é
definido**, então um erro de digitação como `tpye` ou `format: 'e-mail'` é detectado na hora, em vez
de silenciosamente não validar nada.

## Valores padrão

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

Os valores padrão são copiados (cada documento recebe o seu próprio array ou objeto) e aplicados antes
da validação, então um valor padrão conta para o `required`. Updates não preenchem valores padrão;
upserts preenchem.

## Uma função como schema

Quando as regras dependem de vários campos, use uma função. Ela retorna `true` (ou nada) quando o
documento é válido; caso contrário, `false`, uma mensagem, ou uma lista de mensagens ou de objetos
`{ path, message }`:

```js
app.db.createCollection('orders', order => {
  const problems = [];
  if (order.total < 0) problems.push({ path: 'total', message: 'total must not be negative' });
  if (order.status === 'shipped' && !order.trackingCode) problems.push('shipped orders need a tracking code');
  return problems.length ? problems : true;
});
```

Os problemas vêm com `rule: 'custom'`. Schemas em forma de função não têm valores padrão.

## Verificando sem armazenar

```js
app.db.users.validate({ name: 'Ana' });
// { valid: false, errors: [{ path: 'email', rule: 'required', message: 'email is required' }] }

app.db.users.applyDefaults({ name: 'Ana' });
// uma cópia com os valores padrão: { name: 'Ana', role: 'user' }
```

`validate` é o que os [formulários](08-forms.md) usam para mostrar erros enquanto o usuário digita.
`applyDefaults` mostra o que o `insertOne` armazenaria.

## Alterando o schema

```js
app.db.users.setSchema(newSchema);   // retorna a coleção; vale para as próximas escritas
app.db.users.setSchema(null);        // sem schema
app.db.users.getSchema();            // o schema que você definiu, ou null
```

Os documentos existentes não são validados de novo quando o schema muda.

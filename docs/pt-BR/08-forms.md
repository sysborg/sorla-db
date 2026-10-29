# Formulários

`bindForm` conecta um formulário HTML a uma coleção: os campos do formulário são mapeados para os
campos do documento pelo `name`, os valores são convertidos de acordo com o [schema](07-schema-validation.md),
os erros aparecem ao lado de cada campo e o envio insere ou atualiza o documento. Nenhuma biblioteca de
formulários é necessária.

```html
<form id="user">
  <label>Name <input name="name"></label>
  <label>Email <input name="email" type="email"></label>
  <label>Age <input name="age" type="number"></label>
  <label>ZIP <input name="address.zip"></label>
  <label><input type="checkbox" name="tags" value="dev"> Dev</label>
  <label><input type="checkbox" name="tags" value="ops"> Ops</label>
  <button>Save</button>
</form>
```

```js
const form = app.db.users.bindForm('#user', {
  onSuccess: result => console.log(result.mode, result.id),   // 'insert', '…'
  onError: errors => console.log(errors)                      // [{ path, rule, message }]
});
```

Uma página completa está em [`example/form_example.html`](../../example/form_example.html).

## Modos

```js
app.db.users.bindForm('#user');                                   // insert (padrão)
app.db.users.bindForm('#user', { mode: 'update', id: 'u1' });     // edita um documento
const form = app.db.users.bindForm('#user');
form.load('u1');                                                  // passa a editar u1
```

- **insert**: `submit` insere os valores; depois disso o formulário é limpo (`resetOnInsert`).
- **update**: o documento é carregado no formulário; `submit` grava apenas os campos do formulário
  (`$set` para os valores, `$unset` para os campos que foram esvaziados), então os campos que não
  estão no formulário ficam como estão.

## Gerando os campos a partir do schema

```html
<form id="signup"></form>
```
```js
app.db.users.bindForm('#signup', { generate: true });
```

Cria um campo com rótulo para cada propriedade:

- inputs conforme o tipo: texto, `email` / `url` para esses formatos, `number` (com `min`, `max` e `step`),
  `date`, e um checkbox para booleanos; um `<textarea>` para strings com `maxLength` acima de 120;
- um `<select>` para `enum`, um grupo de checkboxes para arrays de `enum`, um input de texto separado
  por vírgulas para os demais arrays, e um `<fieldset>` com legenda para objetos aninhados;
- `minlength`, `maxlength` e `pattern` vindos do schema;
- rótulos a partir do `title` (ou do nome do campo em forma legível: `firstName` → "First name"), um ` *` e
  `aria-required` nos campos obrigatórios, e a `description` como dica vinculada com `aria-describedby`.

Os campos vão para uma `<div data-sorla-fields>` colocada antes do seu botão de envio (ou no final do
formulário); você também pode colocar essa `div` onde quiser que eles apareçam. `destroy()` remove o que
foi gerado.

## Conversão de valores

O formulário lê texto; o schema decide o que é armazenado:

| Schema / input | Armazenado |
|---|---|
| `number`, `integer` (ou `type="number"` sem schema) | um número; um texto que não é número continua texto, para que a validação o aponte |
| `boolean`, ou um único checkbox | `true` / `false` |
| `date` | um `Date` (`<input type="date">` é lido como meia-noite UTC) |
| `enum` | o valor do enum cujo texto corresponde (assim, `enum: [1, 2]` armazena números) |
| `array`, vários checkboxes com o mesmo nome, `<select multiple>` | um array, com os itens convertidos conforme `items` |
| um input de texto com `data-sorla-list` ou com schema `array` | o texto dividido nas vírgulas: `"a, b"` → `['a', 'b']` |
| um campo vazio | não definido (`[]` para arrays) |

## Validação e erros

| Opção | Padrão | |
|---|---|---|
| `validateOn` | `'blur'` | `'blur'`: quando o usuário sai de um campo; `'input'`: durante a digitação; `'submit'`: apenas no envio |
| `nativeValidation` | `false` | mantém os balões do próprio navegador; por padrão o formulário recebe `novalidate`, para que os erros tenham a mesma aparência em todo lugar |
| `messages` | | `issue => 'text'` para traduzir ou reescrever as mensagens |

Antes de um envio, só são apontados os campos dos quais o usuário já saiu, para que um formulário novo
não apareça todo em vermelho. No envio, todos os problemas são exibidos.

Os erros definem `aria-invalid="true"` e `aria-describedby` no campo e preenchem o elemento
`[data-error-for="field"]`: o seu, ou um `<small class="sorla-error">` criado logo após o campo. Erros
que não se referem a um campo específico (um schema em forma de função, um `_id` duplicado) vão para
`[data-error-for=""]` no topo do formulário, com `role="alert"`.

```html
<input name="email" type="email">
<span data-error-for="email" class="hint"></span>
```

```js
// mensagens em português
app.db.users.bindForm('#user', {
  messages: issue => ({
    required: `${issue.path} é obrigatório`,
    format: `${issue.path} inválido`
  })[issue.rule] ?? issue.message
});
```

## Eventos e resultados

```js
form.form.addEventListener('sorla:saved', event => event.detail);      // { ok, mode, id, document, modified? }
form.form.addEventListener('sorla:invalid', event => event.detail);    // { errors }
```

`onSuccess(result)` e `onError(errors)` recebem os mesmos dados. `modified` (modo update) indica se
alguma coisa mudou.

## O controlador

| Membro | Descrição |
|---|---|
| `values()` | O documento que o formulário salvaria (já convertido) |
| `fill(document)` | Coloca valores nos campos |
| `validate()` | Mostra todos os erros e os retorna |
| `submit()` | Salva; retorna `{ ok: true, mode, id, document, modified? }` ou `{ ok: false, errors }` |
| `load(id)` | Carrega um documento e passa para o modo update (lança um erro quando o id não existe) |
| `reset()` | Restaura o formulário (para o documento carregado no modo update; caso contrário, para os valores padrão do schema) |
| `destroy()` | Remove os ouvintes, os elementos de erro e os campos gerados, e restaura o `novalidate` |
| `form`, `mode`, `id` | O elemento do formulário, o modo atual e o id em edição |

`bindForm` usa apenas APIs do DOM acessíveis a partir do formulário (`form.ownerDocument`), então funciona
dentro de iframes e com o jsdom nos testes.

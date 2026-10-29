# Forms

`bindForm` connects an HTML form to a collection: fields map to document fields by their `name`,
values are converted with the [schema](07-schema-validation.md), errors appear next to each field, and
submitting inserts or updates the document. No form library needed.

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

A complete page is in [`example/form_example.html`](../../example/form_example.html).

## Modes

```js
app.db.users.bindForm('#user');                                   // insert (default)
app.db.users.bindForm('#user', { mode: 'update', id: 'u1' });     // edit a document
const form = app.db.users.bindForm('#user');
form.load('u1');                                                  // switch to editing u1
```

- **insert**: `submit` inserts the values; the form is cleared afterwards (`resetOnInsert`).
- **update**: the document is loaded into the form; `submit` writes only the fields of the form
  (`$set` for values, `$unset` for fields cleared), so fields that are not in the form stay as they
  are.

## Generating the fields from the schema

```html
<form id="signup"></form>
```
```js
app.db.users.bindForm('#signup', { generate: true });
```

Builds a labeled field for every property:

- inputs by type: text, `email` / `url` for those formats, `number` (with `min`, `max` and `step`),
  `date`, and a checkbox for booleans; a `<textarea>` for strings with `maxLength` over 120;
- a `<select>` for `enum`, a group of checkboxes for arrays of `enum`, a comma separated text input
  for other arrays, and a `<fieldset>` with a legend for nested objects;
- `minlength`, `maxlength` and `pattern` from the schema;
- labels from `title` (or the field name made readable: `firstName` → "First name"), a ` *` and
  `aria-required` on required fields, and `description` as a hint linked with `aria-describedby`.

The fields go in a `<div data-sorla-fields>` placed before your submit button (or at the end of the
form); you can also put that `div` where you want them. `destroy()` removes what was generated.

## Value conversion

The form reads text; the schema decides what is stored:

| Schema / input | Stored |
|---|---|
| `number`, `integer` (or `type="number"` without a schema) | a number; text that is not a number stays text so validation reports it |
| `boolean`, or a single checkbox | `true` / `false` |
| `date` | a `Date` (`<input type="date">` is read as UTC midnight) |
| `enum` | the enum value whose text matches (so `enum: [1, 2]` stores numbers) |
| `array`, several checkboxes with the same name, `<select multiple>` | an array, items converted with `items` |
| a text input with `data-sorla-list` or an `array` schema | the text split on commas: `"a, b"` → `['a', 'b']` |
| an empty field | not set (`[]` for arrays) |

## Validation and errors

| Option | Default | |
|---|---|---|
| `validateOn` | `'blur'` | `'blur'`: when the user leaves a field; `'input'`: while typing; `'submit'`: only on submit |
| `nativeValidation` | `false` | keep the browser's own bubbles; by default the form gets `novalidate` so errors look the same everywhere |
| `messages` | | `issue => 'text'` to translate or rewrite messages |

Before a submit, only the fields the user already left are reported, so a new form is not covered in
red. On submit, every problem is shown.

Errors set `aria-invalid="true"` and `aria-describedby` on the field and fill the element
`[data-error-for="field"]`: yours, or a `<small class="sorla-error">` created after the field. Errors
that are not about one field (a function schema, a duplicate `_id`) go to `[data-error-for=""]` at the
top of the form, with `role="alert"`.

```html
<input name="email" type="email">
<span data-error-for="email" class="hint"></span>
```

```js
// Portuguese messages
app.db.users.bindForm('#user', {
  messages: issue => ({
    required: `${issue.path} é obrigatório`,
    format: `${issue.path} inválido`
  })[issue.rule] ?? issue.message
});
```

## Events and results

```js
form.form.addEventListener('sorla:saved', event => event.detail);      // { ok, mode, id, document, modified? }
form.form.addEventListener('sorla:invalid', event => event.detail);    // { errors }
```

`onSuccess(result)` and `onError(errors)` receive the same data. `modified` (update mode) tells whether
anything changed.

## The controller

| Member | Description |
|---|---|
| `values()` | The document the form would save (converted) |
| `fill(document)` | Puts values into the fields |
| `validate()` | Shows every error and returns them |
| `submit()` | Saves; returns `{ ok: true, mode, id, document, modified? }` or `{ ok: false, errors }` |
| `load(id)` | Loads a document and switches to update mode (throws when the id does not exist) |
| `reset()` | Resets the form (to the loaded document in update mode, to the schema defaults otherwise) |
| `destroy()` | Removes the listeners, the error elements and generated fields, restores `novalidate` |
| `form`, `mode`, `id` | The form element, the current mode and the edited id |

`bindForm` only uses DOM APIs reachable from the form (`form.ownerDocument`), so it works inside
iframes and with jsdom in tests.

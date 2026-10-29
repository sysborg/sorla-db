# Testes e desenvolvimento

## Rodando os testes

```bash
git clone https://github.com/sysborg/sorla-db.git
cd sorla-db
npm install
npm test
```

`npm test` executa duas suítes:

1. **Jest** (`jest`): 223 testes em `test/*.test.js` sobre o código-fonte.
2. **Integrações com frameworks** (`node --test test/adapters/adapters.test.mjs`): as integrações com
   React, Vue, Svelte e Angular e a interoperabilidade com RxJS, usando as bibliotecas reais
   (instaladas como dependências de desenvolvimento).

```bash
npx jest                                  # só o Jest
npx jest test/feature_cursor.test.js      # um arquivo
npx jest -t "bulkWrite"                   # testes cujo nome corresponde
npx jest --watch                          # roda de novo ao salvar
node --test test/adapters/adapters.test.mjs
```

O GitHub Actions roda `npm test` a cada push em `main` e a cada pull request, no Node 18, 20, 22 e
24 (`.github/workflows`).

## O que é testado

| Arquivo | Cobre |
|---|---|
| `unit_*.test.js` | a classe `sorla`, bancos, documentos (proxies somente leitura), operadores, o fallback de clonagem |
| `feature_insert.test.js` | ids, cópias, regras de chaves, duplicados, `insertMany` atômico |
| `feature_database.test.js` | bancos e coleções, `getCollection`, `getStats`, remoções |
| `feature_collection*.test.js` | `find`, `findOne`, `count`, todos os operadores de consulta |
| `feature_nested_queries.test.js` | `$and` / `$or` / `$nor` / `$not` aninhados em qualquer profundidade |
| `feature_query_equivalence.test.js` | **500 consultas aninhadas aleatórias** conferidas contra uma implementação de referência |
| `feature_cursor.test.js` | leitura, ordenação de tipos mistos, `nulls`, collation, paginação, projeção |
| `feature_update_delete.test.js` | operadores de atualização, upserts, `replaceOne`, exclusões, erros |
| `feature_bulk_write.test.js` | `bulkWrite`, `BulkWriteError`, o índice de `_id`, cursores com cópia na leitura e snapshots |
| `feature_schema.test.js` | todas as palavras-chave de schema, valores padrão, schemas em função, a API de schema |
| `feature_form.test.js` | `bindForm` com inserção, atualização, conversão, erros, campos gerados (jsdom) |
| `feature_live_query.test.js` | `watch()`: agrupamento em lotes, identidade estável, projeção, contratos de store e Observable |
| `feature_sync.test.js` | SSE contra um servidor HTTP real (quedas, `Last-Event-ID`, 4xx, novas tentativas), o parser de event-stream, o cliente WebSocket (socket falso), atualizações com cópia na escrita |
| `feature_performance.test.js` | inserções e atualizações lineares (limites de tempo folgados) |
| `package.test.js` | as entradas do pacote, o bundle do navegador (orçamento de tamanho, `window.sorla`, API mais recente presente) |
| `adapters/adapters.test.mjs` | React, Vue, Svelte, Angular, RxJS |

### Testando o seu próprio código que usa o sorla-db

O sorla-db roda no Node, então os seus testes unitários não precisam de navegador:

```js
// tasks.test.js (Jest, Vitest ou node:test)
const sorla = require('sorla-db');

let tasks;
beforeEach(() => {
  const app = new sorla();          // uma instância nova por teste: nada vaza entre os testes
  app.useDb('test');
  app.db.createCollection('tasks');
  tasks = app.db.tasks;
});

test('completing a task', () => {
  const id = tasks.insertOne({ title: 'Write tests', done: false });
  completeTask(tasks, id);
  expect(tasks.findOne({ _id: id }).done).toBe(true);
});
```

Para formulários, use o jsdom (`testEnvironment: 'jsdom'` no Jest, ou crie um `JSDOM` e passe o
elemento de formulário dele). Para SSE e WebSocket, passe implementações de `fetch`, `EventSource` ou
`WebSocket` nas opções (veja como o `test/feature_sync.test.js` faz).

## Build

```bash
npm run build     # dist/sorla.min.js
```

O `index.js` empacota `src/sorla.js` com o browserify e o minifica com o terser em
`dist/sorla.min.js`, que registra `window.sorla`. Um build que falha termina com erro, então um bundle
desatualizado nunca fica para trás. O `package.test.js` verifica o bundle: nenhuma dependência de
desenvolvimento dentro dele, dentro do orçamento de tamanho (64 kB) e com a API mais recente presente.

O código-fonte é CommonJS (`src/`), `index.mjs` é a entrada como módulo ES, `index.d.ts` são as
declarações e `adapters/` são as integrações com frameworks (módulos ES). Evite em `src/` sintaxe mais
nova que o ES2020 (por exemplo, `??=`): o parser do browserify não a aceita.

## Estrutura do projeto

```
src/
  sorla.js                    entrada: a classe sorla, estáticos connect / stream / readEventStream
  dbs/database.js             bancos (coleções como propriedades)
  collections/collection.js   coleção: formulários, stream, connect, watch
  query_language/
    query.js                  find, findOne, count, options
    manipulation.js           inserções, atualizações, exclusões, bulkWrite, o índice de _id
    operators.js              operadores de consulta
    update.js                 operadores de atualização (cópia na escrita)
  documents/
    document.js               wrapper somente leitura do documento
    cursor.js                 cursores, ordenação
  schema/schema.js            subconjunto do JSON Schema, ValidationError
  form/form.js                bindForm
  live/live-query.js          watch()
  sync/                       sse.js, socket.js, apply.js
  events.js, clone.js, utils.js
adapters/                     react, vue, svelte, angular (.mjs + .d.ts)
test/                         suítes do Jest e test/adapters
example/                      form_example.html, simple_data_example.html, sse_server.js
docs/                         esta documentação (en, pt-BR)
```

## Contribuindo

1. Faça um fork e crie uma branch (`feat/…`, `fix/…`, `perf/…`).
2. Escreva o teste primeiro; mantenha o `npm test` passando.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(cursor): …`, `fix(update): …`.
4. Atualize o `CHANGELOG.md` em `[Unreleased]`, o `README.md` e esta documentação quando o comportamento mudar.
5. Rode `npm run build` quando `src/` mudar e faça o commit de `dist/` junto.
6. Abra um pull request.

## Publicando uma versão

```bash
npm version 1.8.0 --no-git-tag-version   # package.json e package-lock.json
# CHANGELOG: [Unreleased] → [1.8.0] - data
npm test && npm run build
git commit -am "chore(release): 1.8.0"
git tag -a v1.8.0 -m v1.8.0
git push origin main v1.8.0
npm publish
```

O projeto segue o [Versionamento Semântico](https://semver.org/).

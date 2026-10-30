# Documentação do sorla-db

[English](../en/README.md) · **Português (Brasil)**

Um banco de documentos para o navegador e o Node: consultas do MongoDB, validação por schema, eventos
de mudança, consultas vivas para React / Vue / Svelte / Angular, formulários ligados à coleção, e
carga a partir de um backend por Server-Sent Events ou WebSocket. Sem servidor, sem dependências, 54 kB.

```bash
npm install sorla-db
```

| | Página | O que você vai aprender |
|---|---|---|
| 1 | [Primeiros passos](01-getting-started.md) | instalação (npm, CDN), os primeiros cinco minutos |
| 2 | [Bancos e coleções](02-databases-and-collections.md) | `useDb`, `createCollection`, estatísticas, opções |
| 3 | [Documentos e inserção](03-documents-and-inserting.md) | ids, cópias, regras, `insertOne`, `insertMany` |
| 4 | [Consultas](04-querying.md) | `find`, `findOne`, `count` e todos os operadores de consulta |
| 5 | [Cursores](05-cursors.md) | leitura, ordenação, paginação, projeção, snapshots |
| 6 | [Atualizar e excluir](06-updating-and-deleting.md) | operadores de atualização, upsert, `replaceOne`, exclusões, `bulkWrite` |
| 7 | [Validação por schema](07-schema-validation.md) | palavras-chave do JSON Schema, valores padrão, schema em função |
| 8 | [Formulários](08-forms.md) | `bindForm`: inserir e editar com um formulário HTML |
| 9 | [Eventos](09-events.md) | `on`, `once`, `off` e o conteúdo dos eventos |
| 10 | [Consultas vivas e frameworks](10-live-queries.md) | `watch()`, React, Vue, Svelte, Angular, RxJS |
| 11 | [Sincronização com o servidor](11-server-sync.md) | Server-Sent Events em blocos, páginas e envios por WebSocket |
| 12 | [Usando o console](12-console.md) | receitas para o devtools e o REPL do Node |
| 13 | [TypeScript](13-typescript.md) | tipos para documentos, resultados e integrações |
| 14 | [Desempenho](14-performance.md) | o que é rápido, por quê, e dicas |
| 15 | [Testes e desenvolvimento](15-testing-and-development.md) | as suítes de teste, testar a sua aplicação, build, contribuir, publicar |
| 16 | [Receitas e perguntas frequentes](16-cookbook.md) | receitas para copiar, dúvidas comuns |

Primeira vez por aqui? Comece pelos [Primeiros passos](01-getting-started.md): os primeiros cinco minutos levam exatamente isso.

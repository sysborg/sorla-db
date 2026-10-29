# Sincronização com o servidor: Server-Sent Events e WebSocket

Um simples `fetch` + `insertMany` muitas vezes é tudo de que você precisa. Quando há muitas linhas, ou
quando o servidor deve enviar as mudanças por conta própria, o sorla-db já fala dois protocolos de
fábrica. Os dois são **alternativas** ao `fetch`, não substitutos.

| Você precisa de | Use |
|---|---|
| uma página de dados de vez em quando | `fetch` + `insertMany` / `bulkWrite` |
| muitas linhas (100 000+) com progresso, retomando depois de uma queda de conexão | [Server-Sent Events](#server-sent-events): `collection.stream(url)` |
| páginas sob demanda (rolagem infinita) e mudanças ao vivo feitas por outros usuários | [WebSocket](#websocket): `collection.connect(url)` |

## Server-Sent Events

O servidor envia as linhas em blocos por uma única resposta HTTP longa; a coleção armazena cada bloco
com um `bulkWrite`.

```js
const loading = app.db.orders.stream('/api/orders/stream', {
  headers: { Authorization: `Bearer ${token}` },
  onProgress: ({ loaded, total }) => (progress.value = total ? loaded / total : 0),
  onError: error => console.warn(error.message)   // conexões que caíram, linhas rejeitadas
});

const state = await loading.done;   // { loaded, total, blocks, errors, lastEventId, finished }
loading.close();                    // para antes do fim: done resolve com o que já foi carregado
```

### O protocolo

A resposta é `Content-Type: text/event-stream`. Cada evento carrega JSON:

```
retry: 2000
event: meta
data: {"total": 100000}

id: 1
event: rows
data: [{"_id": 1, "name": "…"}, … 5000 rows …]

id: 2
event: rows
data: [...]

event: end
data: {"total": 100000}
```

| Evento | Dados | Efeito |
|---|---|---|
| `meta` | `{ total }` | o número de linhas esperado, para o progresso |
| `rows` | `[docs]` ou `{ rows }` | um `bulkWrite`: linhas cujo `_id` já existe são substituídas, as demais são inseridas |
| `ops` | `[bulkWrite operations]` | qualquer mudança |
| `delete` | `[ids]` ou `{ ids }` | remove documentos |
| `end` | `{ total? }` | fim: `done` resolve e o cliente não reconecta |
| `abort` | `{ message }` | o servidor desiste: `done` rejeita com essa mensagem |

Outros nomes de evento vão para `onMessage(event)`. Linhas de comentário (`: keep-alive`) são ignoradas.

### Retomada

Dê um `id:` a cada bloco. Quando a conexão cai, o cliente espera (`retry`: 1000 ms, ou o que o
servidor enviou com `retry:`), reconecta e envia o último id no cabeçalho `Last-Event-ID`. O servidor
continua a partir do próximo bloco. Linhas enviadas duas vezes são substituídas pelo `_id`, nunca
duplicadas.

| Situação | O que acontece |
|---|---|
| erro de rede, reinício do servidor, stream encerrado sem `end` | reconecta, até `maxRetries` (10) falhas seguidas |
| HTTP 4xx (exceto 408 e 429) | `done` rejeita com `error.status`; sem nova tentativa |
| HTTP 5xx, 408, 429 | tenta de novo |
| uma linha que viola o schema | é ignorada e contada em `state.errors`; `onError` recebe o `BulkWriteError`; o resto do bloco é armazenado |
| JSON inválido em um evento | contado em `state.errors` e informado ao `onError` |

### Opções

| Opção | Padrão | |
|---|---|---|
| `transport` | `'fetch'` | `'fetch'`: cabeçalhos personalizados (Authorization), qualquer método e corpo, funciona no Node 18+. `'eventsource'`: o `EventSource` do navegador (só GET, cookies, reconecta sozinho) |
| `headers`, `method`, `body`, `credentials` | | transporte fetch |
| `withCredentials` | `false` | transporte EventSource, cookies entre origens |
| `mode` | `'upsert'` | `'insert'` faz com que ids duplicados sejam erros |
| `retry` | `1000` | ms antes de reconectar |
| `maxRetries` | `10` | falhas seguidas antes de `done` rejeitar |
| `lastEventId` | | retoma um stream de uma sessão anterior |
| `onProgress(state)`, `onError(error)`, `onMessage(event)` | | callbacks |
| `apply(type, data)` | | trata `rows` / `ops` / `delete` você mesmo, em vez de gravar na coleção |
| `fetch`, `EventSource` | globais | as suas próprias implementações (testes, polyfills) |

Sem uma coleção, `sorla.stream(url, { apply })` entrega cada bloco ao seu código (uma grade de dados
que armazena as linhas por conta própria, por exemplo).

### Um servidor em Node

Um endpoint completo está em [`example/sse_server.js`](../../example/sse_server.js):

```js
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  let block = Number(req.headers['last-event-id'] ?? 0);   // continua depois do último bloco recebido
  res.write(`event: meta\ndata: ${JSON.stringify({ total: TOTAL })}\n\n`);
  const next = () => {
    const rows = rowsOfBlock(block);
    if (!rows.length) return res.end('event: end\ndata: {}\n\n');
    block++;
    const ok = res.write(`id: ${block}\nevent: rows\ndata: ${JSON.stringify(rows)}\n\n`);
    ok ? setImmediate(next) : res.once('drain', next);   // respeita um cliente lento
  };
  next();
}).listen(5390);
```

100 000 linhas em 20 blocos carregam em cerca de 400 ms num notebook, de ponta a ponta. Atrás de um
nginx, desative o buffering para o endpoint (cabeçalho `X-Accel-Buffering: no` ou `proxy_buffering off`).

## WebSocket

Uma única conexão transporta requisições e respostas (páginas para uma rolagem infinita, ou qualquer
coisa que você definir) e as mudanças que o servidor envia.

```js
const remote = app.db.orders.connect('wss://api.example.com/orders');

const page = await remote.load({ offset: 0, limit: 200, query: { status: 'open' }, sort: { due: 1 } });
// { rows, hasMore, total }; as linhas também são armazenadas em app.db.orders

remote.on('push', ({ message }) => console.log('server changed', message.type));
remote.on('open', () => status.textContent = 'online');
remote.on('close', () => status.textContent = 'reconnecting…');

const stats = await remote.request('stats', { year: 2026 });   // qualquer tipo de requisição
remote.send('typing', { user: 'ana' });                       // envia sem esperar resposta
remote.close();
```

### O protocolo

As mensagens são objetos JSON com um `type`:

| Direção | Mensagem |
|---|---|
| cliente → servidor | `{ type: 'load', id, offset, limit, query, sort, … }`, qualquer `request(type, payload)` como `{ type, id, …payload }`, `send(type, payload)` como `{ type, …payload }`, `{ type: 'ping' }` |
| servidor → cliente, respostas | `{ type: 'reply', id, …result }` (para `load`: `rows`, `hasMore`, `total`), `{ type: 'error', id, message }` |
| servidor → cliente, envios do servidor | `{ type: 'rows', rows }`, `{ type: 'ops', ops }`, `{ type: 'delete', ids }`: aplicados à coleção; qualquer outra coisa vira um evento `message` |
| servidor → cliente | `{ type: 'pong' }` (opcional) |

### Comportamento

- Requisições feitas durante a conexão ficam numa fila e são enviadas quando o socket abre.
- Depois de uma queda, o cliente reconecta com espera crescente exponencial: 500 ms, 1 s, 2 s… até 30 s.
  Requisições que ainda aguardavam resposta são rejeitadas (`The connection closed before the reply`),
  então tente-as de novo; as que estão na fila são enviadas depois da reconexão.
- Um `{ type: 'ping' }` é enviado a cada 25 s, e uma conexão que fica em silêncio por dois heartbeats
  (pings periódicos) é substituída, o que pega proxies que derrubam conexões ociosas sem avisar ninguém.
- As respostas expiram depois de 30 s (`No reply to "load" after 30000 ms`).

| Opção | Padrão | |
|---|---|---|
| `apply` | `true` para `collection.connect`, `false` para `sorla.connect` | armazena na coleção as linhas carregadas e as enviadas pelo servidor |
| `mode` | `'upsert'` | `'insert'` faz com que ids duplicados sejam erros |
| `reconnect` | `true` | |
| `retry`, `maxRetry`, `maxRetries` | `500`, `30000`, `Infinity` | início da espera crescente, atraso máximo, tentativas |
| `heartbeat` | `25000` | ms entre pings; `0` desativa |
| `timeout` | `30000` | ms de espera por uma resposta; `0` desativa |
| `protocols` | | subprotocolos do WebSocket |
| `WebSocket` | global | a sua própria implementação (Node: o pacote `ws`) |

Eventos: `open`, `close` (`{ code, reason }`), `error` (`{ error }`), `push` (`{ message }`) e
`message` (`{ message }` para os outros tipos). `remote.state` é `'connecting'`, `'open'` ou `'closed'`.

### Sem uma coleção

`sorla.connect(url, options)` retorna a mesma conexão com `apply: false`: `load()` retorna as linhas
sem armazená-las, que é o que uma grade de dados no modo de rolagem infinita precisa.

### Um servidor em Node

```js
import { WebSocketServer } from 'ws';

const server = new WebSocketServer({ port: 5391 });
server.on('connection', socket => {
  socket.on('message', raw => {
    const message = JSON.parse(raw);
    if (message.type === 'ping') return socket.send(JSON.stringify({ type: 'pong' }));
    if (message.type === 'load') {
      const cursor = orders.find(message.query ?? {}).sort(message.sort ?? { _id: 1 });
      const total = cursor.length;
      const rows = cursor.skip(message.offset).limit(message.limit).toArray();
      socket.send(JSON.stringify({ type: 'reply', id: message.id, rows, total, hasMore: message.offset + rows.length < total }));
    }
  });
});

// outro usuário mudou algo: envia para todo mundo
function broadcast(rows) {
  for (const client of server.clients) client.send(JSON.stringify({ type: 'rows', rows }));
}
```

O servidor pode usar o próprio sorla-db, como acima: a `query` e o `sort` do cliente rodam sem
alterações.

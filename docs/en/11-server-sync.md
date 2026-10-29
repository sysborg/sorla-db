# Server sync: Server-Sent Events and WebSocket

Plain `fetch` + `insertMany` is often all you need. When there are many rows, or the server should
push changes, sorla-db speaks two protocols out of the box. Both are **alternatives** to `fetch`,
not replacements.

| You need | Use |
|---|---|
| a page of data now and then | `fetch` + `insertMany` / `bulkWrite` |
| many rows (100 000+) with progress, resuming after a dropped connection | [Server-Sent Events](#server-sent-events): `collection.stream(url)` |
| pages on demand (infinite scroll) and live changes from other users | [WebSocket](#websocket): `collection.connect(url)` |

## Server-Sent Events

The server sends the rows in blocks over one long HTTP response; the collection stores each block with
one `bulkWrite`.

```js
const loading = app.db.orders.stream('/api/orders/stream', {
  headers: { Authorization: `Bearer ${token}` },
  onProgress: ({ loaded, total }) => (progress.value = total ? loaded / total : 0),
  onError: error => console.warn(error.message)   // dropped connections, rejected rows
});

const state = await loading.done;   // { loaded, total, blocks, errors, lastEventId, finished }
loading.close();                    // stop early: done resolves with what was loaded
```

### The protocol

The response is `Content-Type: text/event-stream`. Every event carries JSON:

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

| Event | Data | Effect |
|---|---|---|
| `meta` | `{ total }` | the number of rows to expect, for progress |
| `rows` | `[docs]` or `{ rows }` | one `bulkWrite`: rows whose `_id` exists are replaced, the others inserted |
| `ops` | `[bulkWrite operations]` | any change |
| `delete` | `[ids]` or `{ ids }` | removes documents |
| `end` | `{ total? }` | done: `done` resolves and the client does not reconnect |
| `abort` | `{ message }` | the server gives up: `done` rejects with that message |

Other event names go to `onMessage(event)`. Comment lines (`: keep-alive`) are ignored.

### Resuming

Give every block an `id:`. When the connection drops, the client waits (`retry`: 1000 ms, or what
the server sent with `retry:`), reconnects, and sends the last id in the `Last-Event-ID` header. The
server continues with the next block. Rows sent twice are replaced by `_id`, never duplicated.

| Situation | What happens |
|---|---|
| network error, server restart, stream ended without `end` | reconnect, up to `maxRetries` (10) failures in a row |
| HTTP 4xx (except 408 and 429) | `done` rejects with `error.status`; no retry |
| HTTP 5xx, 408, 429 | retried |
| a row that breaks the schema | skipped and counted in `state.errors`; `onError` receives the `BulkWriteError`; the rest of the block is stored |
| invalid JSON in an event | counted in `state.errors`, reported to `onError` |

### Options

| Option | Default | |
|---|---|---|
| `transport` | `'fetch'` | `'fetch'`: custom headers (Authorization), any method and body, works in Node 18+. `'eventsource'`: the browser's `EventSource` (GET only, cookies, reconnects by itself) |
| `headers`, `method`, `body`, `credentials` | | fetch transport |
| `withCredentials` | `false` | EventSource transport, cookies across origins |
| `mode` | `'upsert'` | `'insert'` makes duplicated ids errors |
| `retry` | `1000` | ms before reconnecting |
| `maxRetries` | `10` | failures in a row before `done` rejects |
| `lastEventId` | | resume a stream from a previous session |
| `onProgress(state)`, `onError(error)`, `onMessage(event)` | | callbacks |
| `apply(type, data)` | | handle `rows` / `ops` / `delete` yourself instead of writing to the collection |
| `fetch`, `EventSource` | globals | your own implementations (tests, polyfills) |

Without a collection, `sorla.stream(url, { apply })` hands every block to your code (a data grid that
stores rows itself, for example).

### A server in Node

A complete endpoint is in [`example/sse_server.js`](../../example/sse_server.js):

```js
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  let block = Number(req.headers['last-event-id'] ?? 0);   // continue after the last block received
  res.write(`event: meta\ndata: ${JSON.stringify({ total: TOTAL })}\n\n`);
  const next = () => {
    const rows = rowsOfBlock(block);
    if (!rows.length) return res.end('event: end\ndata: {}\n\n');
    block++;
    const ok = res.write(`id: ${block}\nevent: rows\ndata: ${JSON.stringify(rows)}\n\n`);
    ok ? setImmediate(next) : res.once('drain', next);   // respect a slow client
  };
  next();
}).listen(5390);
```

100 000 rows in 20 blocks load in about 400 ms on a laptop, end to end. Behind nginx, turn off
buffering for the endpoint (`X-Accel-Buffering: no` header or `proxy_buffering off`).

## WebSocket

One connection carries requests and replies (pages for an infinite scroll, or anything you define)
and changes the server pushes.

```js
const remote = app.db.orders.connect('wss://api.example.com/orders');

const page = await remote.load({ offset: 0, limit: 200, query: { status: 'open' }, sort: { due: 1 } });
// { rows, hasMore, total }; the rows are stored in app.db.orders too

remote.on('push', ({ message }) => console.log('server changed', message.type));
remote.on('open', () => status.textContent = 'online');
remote.on('close', () => status.textContent = 'reconnecting…');

const stats = await remote.request('stats', { year: 2026 });   // any request type
remote.send('typing', { user: 'ana' });                       // fire and forget
remote.close();
```

### The protocol

Messages are JSON objects with a `type`:

| Direction | Message |
|---|---|
| client → server | `{ type: 'load', id, offset, limit, query, sort, … }`, any `request(type, payload)` as `{ type, id, …payload }`, `send(type, payload)` as `{ type, …payload }`, `{ type: 'ping' }` |
| server → client, replies | `{ type: 'reply', id, …result }` (for `load`: `rows`, `hasMore`, `total`), `{ type: 'error', id, message }` |
| server → client, pushes | `{ type: 'rows', rows }`, `{ type: 'ops', ops }`, `{ type: 'delete', ids }`: applied to the collection; anything else is a `message` event |
| server → client | `{ type: 'pong' }` (optional) |

### Behavior

- Requests made while connecting are queued and sent when the socket opens.
- After a drop the client reconnects with exponential back off: 500 ms, 1 s, 2 s… up to 30 s.
  Requests still waiting for a reply are rejected (`The connection closed before the reply`), so
  retry them; queued ones are sent after the reconnection.
- A `{ type: 'ping' }` is sent every 25 s, and a connection that stays silent for two heartbeats is
  replaced, which catches proxies that drop idle connections without telling anyone.
- Replies time out after 30 s (`No reply to "load" after 30000 ms`).

| Option | Default | |
|---|---|---|
| `apply` | `true` for `collection.connect`, `false` for `sorla.connect` | store loaded and pushed rows in the collection |
| `mode` | `'upsert'` | `'insert'` makes duplicated ids errors |
| `reconnect` | `true` | |
| `retry`, `maxRetry`, `maxRetries` | `500`, `30000`, `Infinity` | back off start, maximum delay, attempts |
| `heartbeat` | `25000` | ms between pings, `0` disables |
| `timeout` | `30000` | ms to wait for a reply, `0` disables |
| `protocols` | | WebSocket sub-protocols |
| `WebSocket` | global | your own implementation (Node: the `ws` package) |

Events: `open`, `close` (`{ code, reason }`), `error` (`{ error }`), `push` (`{ message }`) and
`message` (`{ message }` for other types). `remote.state` is `'connecting'`, `'open'` or `'closed'`.

### Without a collection

`sorla.connect(url, options)` returns the same connection with `apply: false`: `load()` returns the
rows without storing them, which is what a data grid in infinite scroll mode needs.

### A server in Node

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

// another user changed something: push it to everyone
function broadcast(rows) {
  for (const client of server.clients) client.send(JSON.stringify({ type: 'rows', rows }));
}
```

The server can use sorla-db itself, as above: the client's `query` and `sort` run unchanged.

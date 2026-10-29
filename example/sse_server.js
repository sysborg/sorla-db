/**
 * Reference Server-Sent Events endpoint for collection.stream(): sends 100 000 rows in blocks of
 * 5 000, and continues from the next block when the client reconnects with Last-Event-ID.
 *   node example/sse_server.js        then, in the browser:
 *   db.orders.stream('http://localhost:5390/orders', { onProgress: s => console.log(s.loaded) })
 */
const http = require('http');

const TOTAL = 100000;
const BLOCK = 5000;
const row = i => ({ _id: i + 1, name: `Order ${i + 1}`, qty: i % 50, total: Math.round(i * 13.7) / 10 });

http.createServer((req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Last-Event-ID'
    });
    if(req.method === 'OPTIONS') return res.end();

    // the id of each block is its number: start after the last one the client received
    let block = Number(req.headers['last-event-id'] ?? 0);
    res.write(`retry: 2000\nevent: meta\ndata: ${JSON.stringify({ total: TOTAL })}\n\n`);

    const next = () => {
        if(res.destroyed) return;
        const start = block * BLOCK;
        if(start >= TOTAL)
        {
            res.end(`event: end\ndata: ${JSON.stringify({ total: TOTAL })}\n\n`);
            return;
        }
        const rows = Array.from({ length: Math.min(BLOCK, TOTAL - start) }, (_, i) => row(start + i));
        block++;
        // write() returns false when the client reads slower than we send: wait for "drain"
        if(res.write(`id: ${block}\nevent: rows\ndata: ${JSON.stringify(rows)}\n\n`)) setImmediate(next);
        else res.once('drain', next);
    };
    next();
}).listen(5390, () => console.log('SSE on http://localhost:5390/orders'));

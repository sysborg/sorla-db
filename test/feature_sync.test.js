const chai = require('chai')
const expect = chai.expect
const http = require('http')
const sorla = require('../src/sorla.js')

const collection = () => {
    const srla = new sorla();
    srla.useDb(`sync${Math.random()}`);
    srla.db.createCollection('c', { type: 'object', properties: { n: { type: 'number' } } });
    return srla.db.c;
};

const block = (from, count) => Array.from({ length: count }, (_, i) => ({ _id: `r${from + i}`, n: from + i }));

describe('SORLA Server-Sent Events stream', () => {
    let server;
    let url;
    let requests;
    let handler;

    beforeAll(done => {
        server = http.createServer((req, res) => {
            requests.push({ lastEventId: req.headers['last-event-id'] ?? null, auth: req.headers.authorization ?? null, method: req.method });
            handler(req, res, requests.length);
        }).listen(0, '127.0.0.1', () => {
            url = `http://127.0.0.1:${server.address().port}/rows`;
            done();
        });
    });
    afterAll(done => {
        server.close(done);
    });
    beforeEach(() => { requests = []; });

    const open = res => res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const send = (res, event, data, id) => res.write(`${id !== undefined ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    it('loads blocks, reconnects with Last-Event-ID after a dropped connection, and finishes on "end"', async () => {
        handler = (req, res, attempt) => {
            open(res);
            if(attempt === 1)
            {
                res.write(': comment lines are ignored\nretry: 10\n\n');
                send(res, 'meta', { total: 300 });
                send(res, 'rows', block(0, 100), 1);
                send(res, 'rows', { rows: block(100, 100) }, 2);
                // the connection drops (after the blocks were sent) before the last block
                setTimeout(() => res.destroy(), 50);
                return;
            }
            const from = Number(req.headers['last-event-id']) * 100;
            send(res, 'rows', block(from, 300 - from), 3);
            send(res, 'end', { total: 300 });
            res.end();
        };
        const c = collection();
        const progress = [];
        const errors = [];
        const controller = c.stream(url, { headers: { Authorization: 'Bearer t' }, onProgress: s => progress.push(s.loaded), onError: e => errors.push(e.message) });
        const state = await controller.done;
        expect(state).to.include({ loaded: 300, total: 300, blocks: 3, errors: 0, lastEventId: '3', finished: true });
        expect(c.count()).to.equal(300);
        expect(requests.map(r => r.lastEventId)).to.deep.equal([null, '2']);
        expect(requests[0].auth).to.equal('Bearer t');
        expect(progress).to.deep.equal([0, 100, 200, 300]);
        expect(errors.length).to.equal(1, 'the dropped connection is reported');
    });

    it('a block sent again after reconnecting is upserted, not duplicated; invalid rows are counted', async () => {
        handler = (req, res) => {
            open(res);
            send(res, 'rows', block(0, 3), 1);
            send(res, 'rows', [{ _id: 'r1', n: 10 }, { _id: 'bad', n: 'x' }], 2);
            send(res, 'ops', [{ updateOne: { filter: { _id: 'r2' }, update: { $set: { n: 20 } } } }]);
            send(res, 'delete', ['r0']);
            send(res, 'end', {});
            res.end();
        };
        const c = collection();
        const errors = [];
        const state = await c.stream(url, { onError: e => errors.push(e.name) }).done;
        expect(state.errors).to.equal(1);
        expect(errors).to.deep.equal(['BulkWriteError']);
        expect(c.find({}).toArray().map(d => `${d._id}:${d.n}`)).to.deep.equal(['r1:10', 'r2:20']);
    });

    it('fails without retrying on 401', async () => {
        handler = (req, res) => res.writeHead(401).end();
        let error;
        try { await collection().stream(url).done; } catch(e) { error = e; }
        expect(error.status).to.equal(401);
        expect(requests.length).to.equal(1);
    });

    it('abort events reject; POST bodies are sent', async () => {
        handler = (req, res) => {
            open(res);
            send(res, 'abort', { message: 'export cancelled' });
        };
        let message;
        try {
            await collection().stream(url, { method: 'POST', body: '{"q":1}' }).done;
        } catch(error) {
            message = error.message;
        }
        expect(message).to.equal('export cancelled');
        expect(requests[0].method).to.equal('POST');

        handler = (req, res) => {
            open(res);
            send(res, 'rows', block(0, 2), 1);
        };
        const c = collection();
        const controller = c.stream(url, { onProgress: () => controller.close() });
        const state = await controller.done;
        expect(state.loaded).to.equal(2);
        expect(state.finished).to.equal(true);
    });

    it('gives up after maxRetries', async () => {
        handler = (req, res) => res.writeHead(503).end();
        let message;
        try {
            await collection().stream(url, { retry: 5, maxRetries: 2 }).done;
        } catch(error) {
            message = error.message;
        }
        expect(message).to.include('failed 3 times');
        expect(requests.length).to.equal(3);
    });

    it('works with the EventSource transport', async () => {
        class FakeEventSource {
            constructor(target) {
                this.url = target;
                this.readyState = 1;
                this.listeners = {};
                FakeEventSource.last = this;
            }
            addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
            emit(type, data, id = '') { (this.listeners[type] || []).forEach(fn => fn({ data: JSON.stringify(data), lastEventId: id })); }
            close() { this.readyState = 2; this.closed = true; }
        }
        const c = collection();
        const controller = c.stream('/rows', { transport: 'eventsource', EventSource: FakeEventSource });
        const source = FakeEventSource.last;
        source.emit('rows', block(0, 5), '1');
        source.emit('end', { total: 5 });
        const state = await controller.done;
        expect(state).to.include({ loaded: 5, total: 5, lastEventId: '1' });
        expect(source.closed).to.equal(true);
        expect(c.count()).to.equal(5);
    });
});

describe('SORLA event-stream parser', () => {
    const parse = async chunks => {
        const encoder = new TextEncoder();
        const body = new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk))); controller.close(); } });
        const events = [];
        await sorla.readEventStream(body, event => events.push(event));
        return events;
    };

    it('handles CRLF split across chunks, multi-line data, missing event names and a last line without newline', async () => {
        expect(await parse(['id: 7\r', '\nevent: rows\r\ndata: a\r\ndata: b\r\n\r\n', 'data:no space\n\n', 'data: tail'])).to.deep.equal([
            { type: 'rows', data: 'a\nb', id: '7' },
            { type: 'message', data: 'no space', id: '7' }
        ]);
    });
});

class FakeSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        FakeSocket.instances.push(this);
        setTimeout(() => this.accept(), 0);
    }
    accept() {
        if(this.readyState !== 0) return;
        this.readyState = 1;
        this.onopen?.();
    }
    send(text) {
        this.sent.push(JSON.parse(text));
        FakeSocket.server?.(this, JSON.parse(text));
    }
    reply(message) { this.onmessage?.({ data: JSON.stringify(message) }); }
    close(code = 1000) {
        this.readyState = 3;
        this.onclose?.({ code });
    }
}
FakeSocket.instances = [];

describe('SORLA WebSocket connection', () => {
    beforeEach(() => {
        FakeSocket.instances = [];
        FakeSocket.server = (socket, message) => {
            if(message.type === 'load')
                setTimeout(() => socket.reply({ type: 'reply', id: message.id, rows: block(message.offset, message.limit), hasMore: message.offset + message.limit < 10, total: 10 }), 0);
        };
    });
    const options = { WebSocket: FakeSocket, heartbeat: 0, retry: 5 };

    it('load() pages are stored in the collection; requests made before the socket opens are queued', async () => {
        const c = collection();
        const remote = c.connect('ws://x', options);
        const page = await remote.load({ offset: 0, limit: 4, sort: { n: 1 } });
        expect(page.hasMore).to.equal(true);
        expect(page.total).to.equal(10);
        expect(page.rows.length).to.equal(4);
        expect(c.count()).to.equal(4);
        expect(FakeSocket.instances[0].sent[0]).to.deep.equal({ offset: 0, limit: 4, sort: { n: 1 }, type: 'load', id: 1 });
        await remote.load({ offset: 2, limit: 4 });
        expect(c.count()).to.equal(6, 'rows already loaded are upserted');
        remote.close();
        expect(remote.state).to.equal('closed');
    });

    it('applies pushed rows, operations and deletes, and emits push events', async () => {
        const c = collection();
        const remote = c.connect('ws://x', options);
        const pushes = [];
        remote.on('push', e => pushes.push(e.message.type));
        await new Promise(resolve => remote.once('open', resolve));
        const socket = FakeSocket.instances[0];
        socket.reply({ type: 'rows', rows: block(0, 3) });
        socket.reply({ type: 'ops', ops: [{ updateOne: { filter: { _id: 'r1' }, update: { $set: { n: 100 } } } }] });
        socket.reply({ type: 'delete', ids: ['r0'] });
        socket.reply({ type: 'custom', hello: 1 });
        expect(c.find({}).toArray().map(d => d.n)).to.deep.equal([100, 2]);
        expect(pushes).to.deep.equal(['rows', 'ops', 'delete']);
        remote.close();
    });

    it('reconnects after a drop; pending requests are rejected; errors and timeouts reject', async () => {
        FakeSocket.server = (socket, message) => {
            if(message.type === 'slow') return;
            if(message.type === 'bad') setTimeout(() => socket.reply({ type: 'error', id: message.id, message: 'not allowed' }), 0);
        };
        const remote = sorla.connect('ws://x', { ...options, timeout: 30 });
        await new Promise(resolve => remote.once('open', resolve));
        const pending = remote.request('slow');
        FakeSocket.instances[0].close(1006);
        let message;
        try { await pending; } catch(error) { message = error.message; }
        expect(message).to.include('closed before the reply');
        await new Promise(resolve => remote.once('open', resolve));
        expect(FakeSocket.instances.length).to.equal(2, 'a new socket was opened');

        try { await remote.request('bad'); } catch(error) { message = error.message; }
        expect(message).to.equal('not allowed');
        try { await remote.request('slow'); } catch(error) { message = error.message; }
        expect(message).to.include('No reply to "slow"');
        remote.close();
        try { await remote.request('x'); } catch(error) { message = error.message; }
        expect(message).to.equal('The connection is closed');
    });

    it('without a collection nothing is stored, the rows are returned (for a grid in append mode)', async () => {
        const remote = sorla.connect('ws://x', options);
        const page = await remote.load({ offset: 0, limit: 2 });
        expect(page.rows.map(r => r._id)).to.deep.equal(['r0', 'r1']);
        remote.close();
    });

    it('sends heartbeats and drops a silent connection', async () => {
        FakeSocket.server = null;
        const remote = sorla.connect('ws://x', { ...options, heartbeat: 10, reconnect: false });
        await new Promise(resolve => remote.once('open', resolve));
        await new Promise(resolve => setTimeout(resolve, 45));
        const socket = FakeSocket.instances[0];
        expect(socket.sent.some(m => m.type === 'ping')).to.equal(true);
        expect(remote.state).to.equal('closed', 'no message for two heartbeats');
    });
});

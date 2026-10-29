/**
 * Server-Sent Events into a collection: the server sends the rows in blocks, the collection stores
 * each block with one bulkWrite. An alternative to loading everything with one fetch.
 *
 * Events the server sends (data is JSON):
 *   meta    {total}                 optional, the number of rows to expect (for progress)
 *   rows    [docs] or {rows}        a block of rows: upserted by _id, inserted without one
 *   ops     [bulkWrite operations]  any change
 *   delete  [ids] or {ids}          removed documents
 *   end     {total?}                the stream is complete (the client closes, no reconnection)
 *   abort   {message}               the server gives up (the stream fails)
 * Give each block an "id:": after a dropped connection the client reconnects with Last-Event-ID
 * and the server can continue from the next block.
 *
 * Two transports: 'fetch' (default; custom headers such as Authorization, POST bodies, works in
 * Node 18+) and 'eventsource' (the browser's EventSource: GET only, cookies, reconnects by itself).
 *
 * options.apply(type, data) replaces the default handling of rows / ops / delete, for code that
 * stores the data itself (sorla.stream(url, {apply}) works without a collection).
 */
const { applyChange, rowCount } = require('./apply.js');

const DATA_EVENTS = ['meta', 'rows', 'ops', 'delete', 'end', 'abort'];

/**
 * Reads a text/event-stream body and calls onEvent({type, data, id}) for each event
 * @param ReadableStream body
 * @param function onEvent
 * @param function onRetry receives the reconnection delay sent with "retry:"
 * @return Promise resolved when the body ends
 */
async function readEventStream(body, onEvent, onRetry = () => {})
{
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let type = '';
    let data = [];
    let id = null;

    const line = text => {
        if(text === '')
        {
            if(data.length)
                onEvent({ type: type || 'message', data: data.join('\n'), id });

            type = '';
            data = [];
            return;
        }

        if(text[0] === ':')
            return;

        const colon = text.indexOf(':');
        const field = colon === -1 ? text : text.slice(0, colon);
        let value = colon === -1 ? '' : text.slice(colon + 1);
        if(value[0] === ' ') value = value.slice(1);

        if(field === 'event') type = value;
        else if(field === 'data') data.push(value);
        else if(field === 'id' && !value.includes('\0')) id = value;
        else if(field === 'retry' && /^\d+$/.test(value)) onRetry(Number(value));
    };

    for(;;)
    {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let start = 0;
        for(let i = 0; i < buffer.length; i++)
        {
            const char = buffer[i];
            if(char !== '\n' && char !== '\r')
                continue;

            // a "\r" at the end of a chunk may be the first half of "\r\n"
            if(char === '\r' && i === buffer.length - 1 && !done)
                break;

            line(buffer.slice(start, i));
            if(char === '\r' && buffer[i + 1] === '\n') i++;
            start = i + 1;
        }
        buffer = buffer.slice(start);
        if(done) break;
    }
    if(buffer) line(buffer);
}

/**
 * @param collection collection
 * @param string url
 * @param object options {transport, headers, method, body, credentials, withCredentials, mode,
 *   retry, maxRetries, lastEventId, onProgress, onError, onMessage, fetch, EventSource}
 * @return object controller {done: Promise<state>, close(), state}
 */
function stream(collection, url, options = {})
{
    const {
        transport = 'fetch',
        mode = 'upsert',
        maxRetries = 10,
        onProgress = () => {},
        onError = () => {},
        onMessage = () => {}
    } = options;
    if(transport !== 'fetch' && transport !== 'eventsource')
        throw new Error('options.transport must be "fetch" or "eventsource"');

    const apply = options.apply ?? ((type, data) => applyChange(collection, type, data, mode));
    if(typeof apply !== 'function')
        throw new Error('options.apply must be a function');
    if(!collection && !options.apply)
        throw new Error('A stream without a collection needs options.apply(type, data)');

    let retry = options.retry ?? 1000;
    const state = { loaded: 0, total: null, blocks: 0, errors: 0, lastEventId: options.lastEventId ?? null, finished: false };
    let resolveDone;
    let rejectDone;
    const done = new Promise((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
    });
    let closed = false;
    let stop = () => {};

    const snapshot = () => ({ ...state });
    const finish = () => {
        if(state.finished) return;
        state.finished = true;
        stop();
        resolveDone(snapshot());
    };
    const fail = error => {
        if(state.finished) return;
        state.finished = true;
        stop();
        rejectDone(error);
    };

    /** @return boolean whether the event was understood */
    const handle = event => {
        let data = null;
        if(DATA_EVENTS.includes(event.type))
        {
            try {
                data = event.data === '' ? {} : JSON.parse(event.data);
            } catch(error) {
                state.errors++;
                onError(new Error(`Invalid JSON in the "${event.type}" event: ${error.message}`));
                return;
            }
        }

        switch(event.type) {
            case 'meta':
                if(typeof data.total === 'number') state.total = data.total;
                onProgress(snapshot());
                break;
            case 'rows':
            case 'ops':
            case 'delete':
                try {
                    apply(event.type, data);
                } catch(error) {
                    // a BulkWriteError: the valid rows of the block are stored
                    state.errors += error.writeErrors ? error.writeErrors.length : 1;
                    onError(error);
                }
                state.loaded += rowCount(event.type, data);
                if(event.type === 'rows') state.blocks++;
                onProgress(snapshot());
                break;
            case 'end':
                if(data && typeof data.total === 'number') state.total = data.total;
                finish();
                break;
            case 'abort':
                fail(new Error(data && data.message ? data.message : 'The server aborted the stream'));
                break;
            default:
                onMessage(event);
        }
    };

    if(transport === 'eventsource')
    {
        const EventSourceImpl = options.EventSource ?? globalThis.EventSource;
        if(typeof EventSourceImpl !== 'function')
            throw new Error('EventSource is not available, use transport: "fetch"');

        const source = new EventSourceImpl(url, { withCredentials: !!options.withCredentials });
        stop = () => source.close();
        for(const type of DATA_EVENTS)
        {
            source.addEventListener(type, event => {
                if(event.lastEventId) state.lastEventId = event.lastEventId;
                handle({ type, data: event.data, id: event.lastEventId || null });
            });
        }
        source.addEventListener('message', event => handle({ type: 'message', data: event.data, id: event.lastEventId || null }));
        source.addEventListener('error', () => {
            // CLOSED (2): the browser will not reconnect (HTTP error, wrong content type)
            if(source.readyState === 2) fail(new Error('The event stream was closed by the browser'));
            else onError(new Error('Connection lost, the browser reconnects'));
        });
    }
    else
    {
        const fetchImpl = options.fetch ?? globalThis.fetch;
        if(typeof fetchImpl !== 'function')
            throw new Error('fetch is not available, pass options.fetch');

        const aborter = new AbortController();
        stop = () => aborter.abort();
        const wait = ms => new Promise(resolve => {
            const timer = setTimeout(resolve, ms);
            aborter.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });

        (async () => {
            let attempts = 0;
            while(!state.finished)
            {
                try {
                    const headers = { Accept: 'text/event-stream', ...(options.headers ?? {}) };
                    if(state.lastEventId !== null) headers['Last-Event-ID'] = state.lastEventId;
                    const response = await fetchImpl(url, {
                        method: options.method ?? 'GET',
                        headers,
                        body: options.body,
                        credentials: options.credentials,
                        signal: aborter.signal
                    });
                    if(!response.ok)
                    {
                        const error = new Error(`The event stream answered HTTP ${response.status}`);
                        error.status = response.status;
                        // 4xx (except 408 / 429) will not get better by retrying
                        if(response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429)
                            return fail(error);
                        throw error;
                    }

                    await readEventStream(response.body, event => {
                        if(event.id !== null) state.lastEventId = event.id;
                        if(event.type === 'rows') attempts = 0;
                        handle(event);
                    }, ms => { retry = ms; });
                    if(state.finished) return;
                    onError(new Error('The event stream ended before "end", reconnecting'));
                } catch(error) {
                    if(state.finished || closed) return;
                    onError(error);
                }

                if(++attempts > maxRetries)
                    return fail(new Error(`The event stream failed ${attempts} times in a row`));

                await wait(retry);
            }
        })();
    }

    return {
        done,
        get state() {
            return snapshot();
        },
        /** Stops the stream; done resolves with what was loaded so far */
        close() {
            closed = true;
            finish();
        }
    };
}

module.exports = { stream, readEventStream };

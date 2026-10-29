/**
 * WebSocket connection to a backend: request / reply (pages for an infinite scroll, any query you
 * define) plus changes the server pushes. An alternative to fetch when the backend can keep one
 * connection per user open, for lower latency and live updates.
 *
 * Messages are JSON objects with a "type":
 *   client → server  {type: 'load', id, offset, limit, query, sort, ...}  (or any type, see request())
 *                    {type: 'ping'}                                     heartbeat
 *   server → client  {type: 'reply', id, ...result}                     answer to a request
 *                    {type: 'error', id, message}                       failed request
 *                    {type: 'rows', rows} / {type: 'ops', ops} / {type: 'delete', ids}   pushed changes
 *                    {type: 'pong'}                                     optional
 * The reply to 'load' is {rows, hasMore, total}.
 */
const emitter = require('../events.js');
const { applyChange, applyRows } = require('./apply.js');

const OPEN = 1;

class remote extends emitter
{
    /**
     * @param collection|null collection where pushed and loaded rows are stored (null: none)
     * @param string url
     * @param object options {WebSocket, protocols, apply, mode, reconnect, retry, maxRetry, maxRetries, heartbeat, timeout}
     */
    constructor(collection, url, options = {})
    {
        super();
        this.collection = collection;
        this.url = url;
        this.options = {
            protocols: undefined,
            apply: collection !== null,
            mode: 'upsert',
            reconnect: true,
            retry: 500,
            maxRetry: 30000,
            maxRetries: Infinity,
            heartbeat: 25000,
            timeout: 30000,
            ...options
        };
        this._WebSocket = this.options.WebSocket ?? globalThis.WebSocket;
        if(typeof this._WebSocket !== 'function')
            throw new Error('WebSocket is not available, pass options.WebSocket');

        this._pending = new Map();
        this._queue = [];
        this._sequence = 0;
        this._attempts = 0;
        this._closed = false;
        this.state = 'connecting';
        this._open();
    }

    _open()
    {
        const socket = new this._WebSocket(this.url, this.options.protocols);
        this._socket = socket;
        this.state = 'connecting';

        socket.onopen = () => {
            this._attempts = 0;
            this.state = 'open';
            this._lastMessage = Date.now();
            this._startHeartbeat();
            for(const message of this._queue.splice(0)) socket.send(message);
            this._emitChange('open', {});
        };
        socket.onmessage = event => this._receive(event.data);
        socket.onerror = () => this._emitChange('error', { error: new Error('WebSocket error') });
        socket.onclose = event => this._lost(event);
    }

    _lost(event)
    {
        this._stopHeartbeat();
        // requests already sent cannot be answered by the next connection
        for(const [id, request] of this._pending)
        {
            clearTimeout(request.timer);
            request.reject(new Error('The connection closed before the reply'));
            this._pending.delete(id);
        }

        this._emitChange('close', { code: event && event.code, reason: event && event.reason });
        if(this._closed || !this.options.reconnect || this._attempts >= this.options.maxRetries)
        {
            this.state = 'closed';
            for(const message of this._queue.splice(0))
                this._rejectQueued(message);
            return;
        }

        // exponential back off: 0.5 s, 1 s, 2 s... up to maxRetry
        const delay = Math.min(this.options.retry * 2 ** this._attempts++, this.options.maxRetry);
        this.state = 'connecting';
        this._reconnectTimer = setTimeout(() => this._open(), delay);
    }

    _rejectQueued(message)
    {
        const id = JSON.parse(message).id;
        const request = this._pending.get(id);
        if(request)
        {
            clearTimeout(request.timer);
            request.reject(new Error('The connection is closed'));
            this._pending.delete(id);
        }
    }

    _startHeartbeat()
    {
        const every = this.options.heartbeat;
        if(!every) return;
        this._heartbeat = setInterval(() => {
            // no message for two heartbeats: the connection is dead even if the socket did not notice
            if(Date.now() - this._lastMessage > every * 2)
            {
                this._socket.close();
                return;
            }
            this._write({ type: 'ping' });
        }, every);
    }

    _stopHeartbeat()
    {
        clearInterval(this._heartbeat);
        this._heartbeat = null;
    }

    _write(message)
    {
        const text = JSON.stringify(message);
        if(this._socket.readyState === OPEN) this._socket.send(text);
        else this._queue.push(text);
    }

    _receive(text)
    {
        this._lastMessage = Date.now();
        let message;
        try {
            message = JSON.parse(text);
        } catch(error) {
            this._emitChange('error', { error: new Error(`Invalid JSON from the server: ${error.message}`) });
            return;
        }
        if(message === null || typeof message !== 'object') return;

        const request = message.id !== undefined ? this._pending.get(message.id) : undefined;
        if(request && (message.type === 'reply' || message.type === 'error'))
        {
            clearTimeout(request.timer);
            this._pending.delete(message.id);
            if(message.type === 'error') request.reject(new Error(message.message || 'The request failed'));
            else request.resolve(message);
            return;
        }

        if(message.type === 'pong') return;
        if(['rows', 'ops', 'delete'].includes(message.type))
        {
            if(this.options.apply && this.collection)
            {
                try {
                    applyChange(this.collection, message.type, message, this.options.mode);
                } catch(error) {
                    this._emitChange('error', { error });
                }
            }
            this._emitChange('push', { message });
            return;
        }

        this._emitChange('message', { message });
    }

    /**
     * Sends a request and waits for its reply
     * @param string type
     * @param object payload
     * @return Promise<object> the reply ({type: 'reply', id, ...})
     */
    request(type, payload = {})
    {
        if(this._closed) return Promise.reject(new Error('The connection is closed'));
        const id = ++this._sequence;
        return new Promise((resolve, reject) => {
            const timer = this.options.timeout
                ? setTimeout(() => {
                    this._pending.delete(id);
                    reject(new Error(`No reply to "${type}" after ${this.options.timeout} ms`));
                }, this.options.timeout)
                : null;
            this._pending.set(id, { resolve, reject, timer });
            this._write({ ...payload, type, id });
        });
    }

    /**
     * Sends a message without waiting for a reply
     * @param string type
     * @param object payload
     * @return void
     */
    send(type, payload = {})
    {
        this._write({ ...payload, type });
    }

    /**
     * Loads a page: {offset, limit, query, sort, ...}. With apply (the default when the connection
     * belongs to a collection) the rows are stored in the collection too.
     * @param object params
     * @return Promise<object> {rows, hasMore, total}
     */
    async load(params = {})
    {
        const reply = await this.request('load', params);
        const rows = Array.isArray(reply.rows) ? reply.rows : [];
        if(this.options.apply && this.collection && rows.length)
            applyRows(this.collection, rows, this.options.mode);

        return { rows, hasMore: reply.hasMore, total: reply.total };
    }

    /** Closes the connection for good */
    close()
    {
        this._closed = true;
        clearTimeout(this._reconnectTimer);
        this._stopHeartbeat();
        this.state = 'closed';
        if(this._socket.readyState <= OPEN) this._socket.close();
        else this._lost();
    }
}

/**
 * @param collection|null collection
 * @param string url
 * @param object options
 * @return remote
 */
function connect(collection, url, options = {})
{
    return new remote(collection, url, options);
}

module.exports = { connect, remote };

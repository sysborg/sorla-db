const query = require('../query_language/query.js');
const { bindForm } = require('../form/form.js');
const { clone } = require('../clone.js');
const { stream } = require('../sync/sse.js');
const { connect } = require('../sync/socket.js');
const liveQuery = require('../live/live-query.js');

class collection extends query
{
    /**
     * Constructs class Collection to manage documents
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param object validationSchema - in construction
     * @return void
    **/
    constructor(validationSchema, options = {})
    {
        super(validationSchema, options);
        this._documents = [];
        this._indexes = [];
    }

    /**
     * Returns the first document of the collection
     * @return object
     */
    get first()
    {
        return this._documents.length ? clone(this._documents[0]._data) : null;
    }

    /**
     * Returns the last document of the collection
     * @return object
     */
    get last()
    {
        return this._documents.length ? clone(this._documents[this._documents.length - 1]._data) : null;
    }

    /**
     * Return all the documents of the collection
     * @return array
     */
    get all()
    {
        return this._documents;
    }

    /**
     * Binds an HTML form to the collection: fields by name ("address.zip"), values converted with the
     * schema, errors next to each field, insert or update on submit
     * @param string|HTMLFormElement form
     * @param object options {mode: 'insert'|'update', id, generate, validateOn, resetOnInsert, messages, onSuccess, onError}
     * @return object controller {values, fill, validate, submit, load, reset, destroy}
     */
    bindForm(form, options = {})
    {
        return bindForm(this, form, options);
    }

    /**
     * Loads rows sent in blocks by a Server-Sent Events endpoint (see src/sync/sse.js for the events)
     * @param string url
     * @param object options {transport: 'fetch'|'eventsource', headers, method, body, mode, retry, maxRetries, onProgress, onError}
     * @return object controller {done, state, close()}
     */
    stream(url, options = {})
    {
        return stream(this, url, options);
    }

    /**
     * Opens a WebSocket to a backend: load() pages and request() replies, pushed changes applied
     * to the collection (see src/sync/socket.js for the messages)
     * @param string url
     * @param object options {apply, mode, reconnect, retry, heartbeat, timeout, WebSocket}
     * @return remote
     */
    connect(url, options = {})
    {
        return connect(this, url, options);
    }

    /**
     * Live query: the matching documents, kept current as the collection changes.
     * subscribe(fn) / getSnapshot(), the base of the React, Vue, Svelte and Angular bindings.
     * @param object query
     * @param object options {sort, nulls, collation, skip, limit, projection}
     * @return liveQuery
     */
    watch(query = {}, options = {})
    {
        return new liveQuery(this, query, options);
    }
}

module.exports =  collection;
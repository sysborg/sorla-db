/**
 * Live query: the documents matching a query, kept current as the collection changes. It is the
 * base of the framework bindings (React, Vue, Svelte, Angular) and works without any of them.
 *
 *   const open = db.tasks.watch({ done: false }, { sort: { due: 1 } });
 *   const off = open.subscribe(tasks => render(tasks));   // called now and after every change
 *
 * - getSnapshot() returns the same frozen array until something changes (useSyncExternalStore).
 * - subscribe(fn) calls fn at once and returns an unsubscribe function (the Svelte store contract);
 *   it also accepts an observer {next} and the query is an Observable for RxJS / Angular (from()).
 * - Only the documents named in a change event are copied again; the others keep their (frozen)
 *   object, so frameworks can skip rows that did not change.
 * - The collection is watched only while someone is subscribed: no close() is needed.
 * - Notifications of one synchronous batch of writes are merged into one (microtask).
 */
const { clone } = require('../clone.js');
const cursor = require('../documents/cursor.js');

const getPath = (data, path) => {
    let value = data;
    for(const part of path.split('.'))
    {
        if(value === null || typeof value !== 'object') return undefined;
        value = value[part];
    }
    return value;
};

function deepFreeze(value)
{
    if(value !== null && typeof value === 'object' && !Object.isFrozen(value))
    {
        Object.freeze(value);
        for(const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
}

class liveQuery
{
    /**
     * @param collection collection
     * @param object query
     * @param object options {sort, nulls, collation, skip, limit, projection}
     */
    constructor(collection, query = {}, options = {})
    {
        if(query === null || typeof query !== 'object' || Array.isArray(query))
            throw new Error('The query must be an object, use {} to watch every document');

        this._collection = collection;
        this._query = query;
        this._options = options;
        // a cursor without documents reads (copies and projects) documents the same way find() does
        this._reader = new cursor([], options.projection ?? null);
        // entries are compared on the stored data, so a projection cannot hide the sort fields
        this._compare = options.sort
            ? cursor.sortComparator(options.sort, { nulls: collection.getOptions().nulls, ...pick(options, ['nulls', 'collation']) }, (entry, key) => getPath(entry.data, key))
            : null;
        this._listeners = new Set();
        this._entries = null;
        this._snapshot = null;
        this._version = -1;
        this._off = null;
        this._scheduled = false;
    }

    /**
     * The matching documents (frozen copies), the same array until something changes
     * @return array
     */
    getSnapshot()
    {
        if(!this._off)
        {
            // not watching: rebuild when the collection changed since the last read
            if(this._snapshot === null || this._version !== this._collection._version)
                this._rebuild();
        }
        else if(this._snapshot === null)
        {
            this._refresh();
        }
        return this._snapshot;
    }

    /**
     * Calls the listener with the documents now and after every change
     * @param function|object listener a function or an observer {next}
     * @return function unsubscribe (also has .unsubscribe(), like an RxJS subscription)
     */
    subscribe(listener)
    {
        const fn = typeof listener === 'function'
            ? listener
            : (listener && typeof listener.next === 'function' ? value => listener.next(value) : null);
        if(!fn)
            throw new Error('subscribe() needs a function or an observer with next()');

        const entry = { fn };
        this._listeners.add(entry);
        if(this._listeners.size === 1) this._attach();
        entry.last = this.getSnapshot();
        fn(entry.last);

        const unsubscribe = () => {
            if(!this._listeners.delete(entry)) return;
            if(!this._listeners.size) this._detach();
        };
        unsubscribe.unsubscribe = unsubscribe;
        return unsubscribe;
    }

    /** Number of matching documents (after skip / limit) */
    get length()
    {
        return this.getSnapshot().length;
    }

    /** Stops every subscription */
    close()
    {
        this._listeners.clear();
        this._detach();
    }

    _attach()
    {
        this._rebuild();
        this._off = this._collection.on('change', event => this._change(event));
    }

    _detach()
    {
        if(this._off) this._off();
        this._off = null;
    }

    /** What the query keeps of a document: the frozen copy handed out and the stored data to sort on */
    _entry(doc)
    {
        return { id: doc._data._id, data: doc._data, copy: deepFreeze(this._reader._read(doc)) };
    }

    _rebuild()
    {
        this._entries = new Map();
        this._collection._eachMatch(this._query, doc => {
            this._entries.set(doc._data._id, this._entry(doc));
        });
        this._refresh();
    }

    _change(event)
    {
        const positions = this._collection._ids();
        for(const id of event.ids ?? [])
        {
            const position = event.type === 'delete' ? undefined : positions.get(id);
            const doc = position === undefined ? null : this._collection._documents[position];
            if(doc && this._collection._operators.matches(doc, this._query))
                this._entries.set(id, this._entry(doc));
            else
                this._entries.delete(id);
        }
        this._snapshot = null;
        this._schedule();
    }

    _schedule()
    {
        if(this._scheduled) return;
        this._scheduled = true;
        queueMicrotask(() => {
            this._scheduled = false;
            const snapshot = this.getSnapshot();
            for(const entry of [...this._listeners])
            {
                if(entry.last === snapshot) continue;
                entry.last = snapshot;
                try {
                    entry.fn(snapshot);
                } catch(error) {
                    setTimeout(() => { throw error; });
                }
            }
        });
    }

    _refresh()
    {
        let entries = [...this._entries.values()];
        if(this._compare)
        {
            entries.sort(this._compare);
        }
        else
        {
            // collection order (a document that matches again after an update keeps its place)
            const positions = this._collection._ids();
            entries.sort((a, b) => positions.get(a.id) - positions.get(b.id));
        }

        const skip = this._options.skip ?? 0;
        const limit = this._options.limit ?? 0;
        if(skip || limit) entries = entries.slice(skip, limit ? skip + limit : undefined);
        this._snapshot = Object.freeze(entries.map(entry => entry.copy));
        this._version = this._collection._version;
    }
}

function pick(object, keys)
{
    const picked = {};
    for(const key of keys)
    {
        if(object[key] !== undefined) picked[key] = object[key];
    }
    return picked;
}

// interop with RxJS and other Observable libraries: from(collection.watch(...))
liveQuery.prototype['@@observable'] = function() { return this; };
if(typeof Symbol === 'function' && typeof Symbol.observable === 'symbol')
    liveQuery.prototype[Symbol.observable] = liveQuery.prototype['@@observable'];

module.exports = liveQuery;

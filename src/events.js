/**
 * Minimal event emitter for collections: insert, update, replace, delete and change (all of them).
 * A failing listener never breaks the write that triggered it; its error is rethrown asynchronously.
 */
class emitter
{
    constructor()
    {
        this._listeners = new Map();
    }

    /**
     * @param string event
     * @param function listener receives the event payload
     * @return function unsubscribe
     */
    on(event, listener)
    {
        if(typeof listener !== 'function')
            throw new Error('The listener must be a function');

        if(!this._listeners.has(event))
            this._listeners.set(event, new Set());

        this._listeners.get(event).add(listener);
        return () => this.off(event, listener);
    }

    once(event, listener)
    {
        const off = this.on(event, payload => {
            off();
            listener(payload);
        });
        return off;
    }

    off(event, listener)
    {
        if(typeof listener === 'undefined')
            this._listeners.delete(event);
        else
            this._listeners.get(event)?.delete(listener);
    }

    /**
     * Emits the event and a generic "change" event with the same payload plus its type
     * @param string type
     * @param object payload
     * @return void
     */
    _emitChange(type, payload)
    {
        const event = { type, ...payload };
        for(const name of [type, 'change'])
        {
            for(const listener of [...(this._listeners.get(name) ?? [])])
            {
                try {
                    listener(event);
                } catch(error) {
                    setTimeout(() => { throw error; });
                }
            }
        }
    }
}

module.exports = emitter;

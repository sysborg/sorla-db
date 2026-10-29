const manipulation = require('./manipulation.js');
const operators = require('./operators.js');
const cursor = require('../documents/cursor.js');

class query extends manipulation
{
    constructor(validationSchema, options = {})
    {
        super(validationSchema);
        this._operators = new operators();
        this.setOptions(options);
    }

    /**
     * Collection options
     * @param object options {nulls: 'last' (default) | 'first'}: where sort() puts missing and null values
     * @return this
     */
    setOptions(options = {})
    {
        if(options === null || typeof options !== 'object')
            throw new Error('Collection options must be an object');

        if(typeof options.nulls !== 'undefined' && options.nulls !== 'first' && options.nulls !== 'last')
            throw new Error('options.nulls must be "first" or "last"');

        this._options = { nulls: 'last', ...(this._options ?? {}), ...options };
        return this;
    }

    getOptions()
    {
        return { ...this._options };
    }

    /**
     * Count documents
     * @return int
     */
    count(query)
    {
        if(typeof query === 'undefined')
            return this._documents.length;

        // counts without copying the documents
        let total = 0;
        this._eachMatch(query, () => { total++; });
        return total;
    }

    /**
     * Deeps find in object
     * @param object query
     * @param object projection
     * @param bool firstOne
     * @return array
     */
    _deepFind(query, projection, single=false)
    {
        // the cursor keeps references to the stored documents: copies are made only for the
        // documents that are read (stored data is never changed in place, so this is a snapshot)
        const finded = [];
        this._eachMatch(query, doc => {
            finded.push(doc);
            return !single;
        });

        return new cursor(finded, projection, this._options);
    }

    /**
     * Find one document
     * @param query
     * @param projection
     * @return object
     */
    findOne(query, projection = null)
    {
        const finded = this._deepFind(query, projection, true);
        return finded.first();
    }

    /**
     * Find documents
     * @param query
     * @param projection
     * @return array
     */
    find(query, projection = null)
    {
        const finded = this._deepFind(query, projection);
        return finded;
    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
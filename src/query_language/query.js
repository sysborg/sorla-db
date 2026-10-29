const manipulation = require('./manipulation.js');
const operators = require('./operators.js');
const cursor = require('../documents/cursor.js');

class query extends manipulation
{
    constructor(validationSchema)
    {
        super(validationSchema);
        this._operators = new operators();
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
        return this._documents.reduce((total, doc) => total + (this._operators.matches(doc, query) ? 1 : 0), 0);
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
        const finded = [];
        for(const doc of this._documents)
        {
            if(!this._operators.matches(doc, query))
                continue;

            finded.push(doc.clone());
            if(single) break;
        }

        return new cursor(finded, projection);
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
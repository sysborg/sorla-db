const query = require('../query_language/query.js');

class collection extends query
{
    /**
     * Constructs class Collection to manage documents
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param object validationSchema - in construction
     * @return void
    **/
    constructor(validationSchema)
    {
        super(validationSchema);
        this._documents = [];
        this._indexes = [];
    }

    /**
     * Returns the first document of the collection
     * @return object
     */
    get first()
    {
        return structuredClone(this._documents[0]._data);
    }

    /**
     * Returns the last document of the collection
     * @return object
     */
    get last()
    {
        return structuredClone(this._documents[this._documents.length - 1]._data);
    }

    /**
     * Return all the documents of the collection
     * @return array
     */
    get all()
    {
        return this._documents.map(doc => structuredClone(doc._data));
    }
}

module.exports =  collection;
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
}

module.exports =  collection;
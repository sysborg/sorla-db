const manipulation = require('./manipulation.js');

class query extends manipulation
{
    constructor(validationSchema)
    {
        super(validationSchema);
    }

    /**
     * Count documents
     * @return int
     */
    count()
    {
        return this._documents.length;
    }

    /**
     * Find one document
     * @param object
     * @return object
     */
    findOne(object)
    {
        if(Object.keys(object).length === 0)
            return this._documents[0];
    }

    /**
     * Find documents
     * @param object
     * @return array
     */
    findMany(object)
    {

    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
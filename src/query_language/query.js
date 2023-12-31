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

    //find
    //find one
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
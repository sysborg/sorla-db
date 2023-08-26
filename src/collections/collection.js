const documents = require('../documents/document.js');

class collection
{
    constructor(validationSchema)
    {
        this._documents = [];
        if(validationSchema !== null)
        {
            this._validationSchema = validationSchema;
        }
    }

    _validates()
    {

    }
}

module.exports =  collection;
const collection = require('../collections/collection.js');

class database
{
    constructor()
    {
        this._collections = [];
    }
    
    createCollection(schemaValidation)
    {
        this._collections.push(new collection(schemaValidation));
    }
}

module.exports = database;
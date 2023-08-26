const collection = require('../collections/collection.js');
const query = require('../query_language/query.js');

class database
{
    /**
     * Constructs class Database to manage collections
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param  string name
     * @return void
    **/
    constructor(name)
    {
        this._collections = [];
        this._name = name;
        this._selectedCollection = null;
        this._schemaValidation = null;
    }

    /**
     * Returns the database name
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param 
     * @return string
    **/
    get name()
    {
        return this._name;
    }

    /**
     * Get selected collection
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param 
     * @return instanceof collection
    **/
    get collection()
    {
        return this._selectedCollection;
    }

    /**
     * Search a collection`s position in the list of collections by its name and mark it as selected
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param string name
     * @return void
    **/
    _findCollectionIndex(name)
    {
        return this._collections.findIndex(collection => collection.name == name);
    }
    
    /**
     * Creates or select a collection that doesn`t exists
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param  string name
     * @param  Object | function | null schemaValidation
     * @return void
    **/
    useCollection(name, schemaValidation=null)
    {
        this._schemaValidation = schemaValidation;
        let pos = this._collections.length;
        this._collections.push(new collection(name, schemaValidation));

        this._selectCollection(pos);
    }
}

module.exports = database;
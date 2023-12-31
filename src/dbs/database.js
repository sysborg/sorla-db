const collection = require('../collections/collection.js');

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
        this._collections = {};
        this._name = name;
        this._collectionCount = 0;

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if(prop in target._collections)
                {
                    return target._collections[prop];
                }

                return target[prop];
            }
        });
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
     * Sets a new collection in the database
     * @param string name
     * @param object validationSchema - in construction
     * @return void
     */
    createCollection(name, validationSchema)
    {
        if(this._collections.hasOwnProperty(name) || typeof this[name] !== 'undefined')
        {
            throw new Error('Collection already exists');
        }

        this._collections[name] = new collection(validationSchema);
        this._collectionCount++;
    }

    /**
     * Returns the number of collections in the database
     * @param
     * @return int
     */
    countCollections()
    {
        return this._collectionCount;
    }
}

module.exports = database;
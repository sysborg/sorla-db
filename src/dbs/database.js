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
     * @param object|function validationSchema JSON Schema subset or a function (optional)
     * @param object options {nulls: 'last' | 'first'}, see collection.setOptions()
     * @return void
     */
    createCollection(name, validationSchema, options = {})
    {
        if(this._collections.hasOwnProperty(name) || typeof this[name] !== 'undefined')
        {
            throw new Error('Collection already exists');
        }

        this._collections[name] = new collection(validationSchema, options);
        this._collectionCount++;

        //creates _id as a index unique
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

    /**
     * Names of the collections, in creation order
     * @return array
     */
    listCollections()
    {
        return Object.keys(this._collections);
    }

    /**
     * A collection by name, also when the name is not a valid property (or shadows a method)
     * @param string name
     * @return collection|undefined
     */
    getCollection(name)
    {
        return this._collections.hasOwnProperty(name) ? this._collections[name] : undefined;
    }

    /**
     * Removes a collection and its documents
     * @param string name
     * @return boolean false when it did not exist
     */
    dropCollection(name)
    {
        if(!this._collections.hasOwnProperty(name))
            return false;

        delete this._collections[name];
        this._collectionCount--;
        return true;
    }

    /**
     * Number of documents per collection
     * @return object {name, documents, collections: [{name, documents}]}
     */
    getStats()
    {
        const collections = this.listCollections().map(name => ({ name, documents: this._collections[name].count() }));
        return {
            name: this._name,
            documents: collections.reduce((total, item) => total + item.documents, 0),
            collections
        };
    }
}

module.exports = database;
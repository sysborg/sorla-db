const documents = require('../documents/document.js');
const operatorsCheck = require('./operators.js');

class manipulation {
    constructor(validationSchema = null) {
        this.validationSchema = validationSchema;
        this._index = {};
        this._prohibitedCharacters = ['$', '.'];
    }

    /**
     * Generates a unique key as a uuid
     * @return string
     */
    _generateKey() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16)
        });
    }

    /**
     * Valid and set validation schema for collection
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param validationSchema
     * @return void
    **/
    set validationSchema(validationSchema)
    {
        if(typeof schemaValidation === 'undefined' || schemaValidation === null)
            return;

        if(['object', 'function'].indexOf(typeof schemaValidation) == -1)
        {
            throw new Error('Invalid schema validation');
        }

        this._validationSchema = validationSchema;  
    }

    /**
     * Validate data
     * @param object data
     * @return boolean
     */
    _validate(data) 
    {
        //under construction
        return true;
    }

    /**
     * Whether a value is a document: an object that is not null nor an array
     * @param mixed value
     * @return boolean
     */
    _isDocument(value)
    {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Verify that no key, at any depth, has prohibited characters
     * @param object document
     * @return boolean
     */
    _validateKeys(document)
    {
        const operators = new operatorsCheck();
        for(const key of Object.keys(document))
        {
            const hasProhibitedCharacters = this._prohibitedCharacters.some(char => key.indexOf(char) > -1);
            if(hasProhibitedCharacters && !operators.isOperator(key))
                return false;

            const value = document[key];
            const nested = Array.isArray(value) ? value : [value];
            for(const item of nested)
            {
                // null is a valid value, only objects have keys to check
                if(item !== null && typeof item === 'object' && !this._validateKeys(item))
                    return false;
            }
        }

        return true;
    }

    /**
     * Set of the _id values of the collection. It is rebuilt when its size no longer matches the
     * documents, so removals done directly on the documents array are handled too.
     * @return Set
     */
    _ids()
    {
        if(!this._idSet || this._idSet.size !== this._documents.length)
            this._idSet = new Set(this._documents.map(doc => doc._data._id));

        return this._idSet;
    }

    /**
     * Copies a document, so the object given by the caller is never changed
     * @param object document
     * @return object
     */
    _copy(document)
    {
        try {
            return structuredClone(document);
        } catch(error) {
            throw new Error('Documents can only contain cloneable values (no functions or DOM nodes)');
        }
    }

    /**
     * Inserts one document to the collection
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.2.0
     * @param object document
     * @param function callback - receives the inserted _id
     * @return mixed the _id of the inserted document
    **/
    insertOne(document, callback) 
    {
        if(!this._isDocument(document))
            throw new Error('Invalid document type');

        if(!this._validateKeys(document))
            throw new Error('Invalid document keys');

        const data = this._copy(document);
        if(typeof data._id === 'undefined')
        {
            do {
                data._id = this._generateKey();
            } while(this._ids().has(data._id));
        }
        else if(this._ids().has(data._id))
        {
            throw new Error(`Duplicate _id "${data._id}"`);
        }

        if(!this._validate(data))
            throw new Error('Invalid document');

        this._documents.push(new documents(data));
        this._ids().add(data._id);

        if(typeof callback === 'function')
            callback(data._id);

        return data._id;
    }

    /**
     * Insert many documents. Every document is validated before the first one is inserted,
     * so an invalid document never leaves the collection with only part of the batch.
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.2.0
     * @param array documents 
     * @param function callback - receives the inserted ids
     * @return array the _id of each inserted document
     */
    insertMany(documents, callback) {
        if(!Array.isArray(documents) || !documents.every(document => this._isDocument(document)))
            throw new Error('Documents must be an array of objects');

        const given = new Set();
        for(const document of documents)
        {
            if(!this._validateKeys(document))
                throw new Error('Invalid document keys');

            if(typeof document._id === 'undefined')
                continue;

            if(given.has(document._id) || this._ids().has(document._id))
                throw new Error(`Duplicate _id "${document._id}"`);

            given.add(document._id);
        }

        const ids = documents.map(document => this.insertOne(document));

        if(typeof callback === 'function')
            callback(ids);

        return ids;
    }

    //create index
    //create indexes
}

module.exports = manipulation;
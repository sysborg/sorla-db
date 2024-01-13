const documents = require('../documents/document.js');

class manipulation {
    constructor(validationSchema = null) {
        this.validationSchema = validationSchema;
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
     * Verify if exists some document that is not object
     * @param array documents
     * @return boolean
     */
    _validateDocumentsType(documents)
    {
        const count = documents.reduce((acc, doc) => {
            return typeof doc !== 'object' ? ++acc : acc;
        }, 0);

        return count;
    }

    /**
     * Inserts one document to the collection
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param object document
     * @param function callback - under construction
     * @return void
    **/
    insertOne(document, callback) 
    {
        if(typeof document !== 'object' || Array.isArray(document))
            throw new Error('Invalid document type');

        if(typeof document._id === 'undefined')
        {
            let _idKey = '';
            do {
                _idKey = this._generateKey();
            } while(this._documents.find(doc => doc._id === document._id));

            document._id = _idKey;
        }

        if(!this._validate(document))
            throw new Error('Invalid document');

        this._documents.push(new documents(document));

        if(typeof callback === 'function')
            callback();
    }

    /**
     * Insert many documents
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param array documents 
     * @param function callback 
     * @return void
     */
    insertMany(documents, callback) {
        console.info(this._validateDocumentsType(documents));
        if(!Array.isArray(documents) || this._validateDocumentsType(documents) > 0)
            throw new Error('Documents must be an array of objects');

        for(let document of documents)
            this.insertOne(document);

        if(typeof callback === 'function')
            callback();
    }

    //create index
    //create indexes
}

module.exports = manipulation;
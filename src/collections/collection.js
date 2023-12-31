const documents = require('../documents/document.js');

class collection
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
        this._documents = [];
        this.validationSchema = validationSchema;
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
     * Creates a new document in the collection and returns it`s uuid
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param 
     * @return 
    **/

    _validates(document)
    {
        if(this._validationSchema === null)
        {
            return true;
        }

        if(typeof this._validationSchema == 'function')
        {
            return this._validationSchema(document);
        }

        //return this._validationSchema.validate(this._documents);
    }
}

module.exports =  collection;
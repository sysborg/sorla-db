const manipulation = require('./manipulation.js');
const operators = require('./operators.js');

class query extends manipulation
{
    constructor(validationSchema)
    {
        console.log('manipulation', manipulation);
        super(validationSchema);
        this._operators = new operators();
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
     * Deeps find in object
     * @param object query
     * @param bool firstOne
     * @return array
     */
    _deepFind(query, firstOne = false)
    {
        const result = [];

        const find = (object) => {
            Object.keys(query).forEach(key => {
                console.log(key, query[key], object[key]);
                if(key in this._operators)
                {
                    if(this._operators[key](object[key], query[key]))
                        result.push(object);
                } else {

                }
                
                /*if(typeof object[key] === 'object')
                {
                    find(object[key]);
                } else
                {
                    console.log('object[key]', object[key], query[key]);
                    if(object[key] === query[key])
                    {
                        result.push(object);
                        if(firstOne)
                            return object;
                    }
                }*/
            });
        };

        find(this._documents);

        return result;
    }

    /**
     * Projection documents only fields
     * @param array | object documents
     * @param object fields
     * @return array
     */
    _projection(documents, fields)
    {
        const isObject = typeof documents === 'object';
        documents = Array.isArray(documents) ? documents : [documents];
        for(let field in fields)
        {
            documents.forEach(doc => {
                if(fields[field] === 0)
                    delete doc[field];
            });
        }

        return isObject ? documents[0] : documents;
    }

    /**
     * Find one document
     * @param query
     * @param projection
     * @return object
     */
    findOne(query, projection = null)
    {
        const document = Object.keys(query).length === 0 ? this._documents[0]._data : this._deepFind(query, true);
        return typeof projection === 'object' ? this._projection(document, projection) : document;
    }

    /**
     * Find documents
     * @param query
     * @param projection
     * @return array
     */
    find(query, projection = null)
    {
        const documents = Object.keys(query).length === 0 ? this._documents : this._deepFind(query);
        return typeof projection === 'object' ? this._projection(documents, projection) : documents;
    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
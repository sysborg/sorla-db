const manipulation = require('./manipulation.js');
const operators = require('./operators.js');

class query extends manipulation
{
    constructor(validationSchema)
    {
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
    _deepFind(query, documents, single=false)
    {
        let result = [];

        const find = (object) => {
            let finded = [];
            docsLoop: for(let doc of this._documents)
            {
                for(let key of Object.keys(query))
                {
                    if(this._operators.isLogicalOperator(key) && !this._operators[key](query[key], doc))
                            continue docsLoop;
                    else {
                        
                    }
                }



                console.log(doc);
            }

            Object.keys(query).forEach(key => {
                if(key in this._operators)
                {
                    const operator_result = this._operators[key](query[key], documents);
                    result = [...result, ...operator_result];
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
        return single ? result[0] : result;
    }

    /**
     * Projection documents only fields
     * @param array | object documents
     * @param object fields
     * @return array
     */
    _projection(documents, fields)
    {
        if(fields === null) return documents;

        const isObject = !Array.isArray(documents) && typeof documents === 'object';
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
        const document = Object.keys(query).length === 0 ? structuredClone(this._documents[0]._data) : this._deepFind(query, this._documents, true);
        return this._projection(document, projection);
    }

    /**
     * Find documents
     * @param query
     * @param projection
     * @return array
     */
    find(query, projection = null)
    {
        const documents = Object.keys(query).length === 0 ? structuredClone(this._documents) : this._deepFind(query, this._documents);
        return this._projection(documents, projection);
    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
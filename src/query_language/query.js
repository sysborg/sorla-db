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
    _deepFind(query, single=false)
    {
        const find = (documents, query, single, debug=false) => {
            let finded = [];
            const queryKeys = Object.keys(query);
            docsLoop: for(let doc of documents)
            {
                for(let k of queryKeys)
                {
                    if(!this._operators.isAnyOperator(k))
                    {
                        this._operators.currentField = k;

                        if(typeof query[k] === 'object')
                        {
                            if(find([doc], query[k], single).length === 0)
                            {
                                continue docsLoop;
                            }

                            continue;
                        }
                    }

                    if((this._operators.isLogicalOperator(k) && !this._operators[k](query[k], doc)) && (typeof doc[k] === 'undefined' || this._operators.handleComparison(k, query[k], doc) === false))
                    {
                        continue docsLoop;
                    }
                }

                finded.push(structuredClone(doc._data));
                if(single) break;
            }

            return finded;
        };

        return find(this._documents, query, single);
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
        const document = Object.keys(query).length === 0 ? structuredClone(this._documents[0]._data) : this._deepFind(query, true);
        return this._projection(document[0], projection);
    }

    /**
     * Find documents
     * @param query
     * @param projection
     * @return array
     */
    find(query, projection = null)
    {
        const documents = Object.keys(query).length === 0 ? structuredClone(this._documents) : this._deepFind(query);
        return this._projection(documents, projection);
    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
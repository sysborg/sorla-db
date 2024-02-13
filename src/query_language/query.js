const manipulation = require('./manipulation.js');
const operators = require('./operators.js');
const cursor = require('../documents/cursor.js');

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
        const c = new cursor();
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

                    const isLogicalOperator = this._operators.isLogicalOperator(k);
                    if((isLogicalOperator && !this._operators[k](query[k], doc)) || (!isLogicalOperator && !this._operators.handleComparison(k, query[k], doc)))
                    {
                        continue docsLoop;
                    }
                }

                finded.push(doc.clone());
                if(single) break;
            }

            return finded;
        };

        const result = find(this._documents, query, single);

        return single ? result[0] : (new cursor(result));
    }

    /**
     * Find one document
     * @param query
     * @param projection
     * @return object
     */
    findOne(query, projection = null)
    {
        const document = this._deepFind(query, true);
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
        const documents = this._deepFind(query);
        return this._projection(documents, projection);
    }

    //find
    //find one and delete
    //find one and update
    //find one and replace
}

module.exports =  query;
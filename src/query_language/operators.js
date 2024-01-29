class operators {
    /**
     * check if is logical operator
     * @param string operator
     * @return boolean
     */
    isLogicalOperator(operator) {
        return ['$or', '$and', '$not', '$nor'].indexOf(operator) > -1;
    }

    /**
     * Is operators
     * @param string operator
     * @return boolean
     */
    isOperator(operator) {
        return ['$lt', '$lte', '$gt', '$gte', '$eq', '$ne', '$in', '$nin'].indexOf(operator) > -1;
    }

    /**
     * Or operator
     * @param array queries
     * @return array
     */
    get $or() {
        return (queries, documents) => {
            if(!Array.isArray(queries))
                throw new Error('The $or operator must be an array');

            let result = [];
            docLoop: for(const doc of documents) {
                for(const query of queries) {
                    for(const attr of Object.keys(query)) {
                        if(this.isOperator(attr)){

                        } else if(typeof documents[attr] === 'object') {

                        } else if(Array.isArray(documents[attr])) {

                        } else if(doc[attr] === query[attr])
                        {
                            result.push(structuredClone(doc._data));
                            continue docLoop;
                        }
                    }
                }
            }

            return result;
        };
    }

    /**
     * And operator
     * @param array queries
     * @return array
     */
    get $and() {
        return (queries, documents) => {
            if(!Array.isArray(queries))
                throw new Error('The $and operator must be an array');

            let result = [];
            docLoop: for(const doc of documents) {
                    for(const query of queries) {
                        for(const attr of Object.keys(query)) {
                            if(this.isOperator(attr)){

                            } else if(typeof documents[attr] === 'object') {
    
                            } else if(Array.isArray(documents[attr])) {
    
                            } else if(doc[attr] !== query[attr])
                                continue docLoop;
                        }
                    }
                result.push(structuredClone(doc._data));
            }

            return result;
        };
    }

    get $not() {
        return this.operatorNot;
    }

    get $nor() {
        return this.operatorNor;
    }

    /**
     * Not in operator
     * @param mixed doc_value
     * @param array queries
     * @return boolean
     */
    get $nin() {
        return (doc_value, queries) => {
            return Array.isArray(queries) ? queries.indexOf(doc_value) === -1 : false;
        }
    }

    /**
     * In operator
     * @param mixed doc_value
     * @param array queries
     * @return boolean
     */
    get $in() {
        return (doc_value, queries) => {
            return Array.isArray(queries) ? queries.indexOf(doc_value) > -1 : false;
        }
    }

    /**
     * less than
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $lt() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value < query : false;
        }
    }

    /**
     * less than or equal
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $lte() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value <= query : false;
        }
    }

    /**
     * greater than
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $gt() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value > query : false;
        }
    }

    /**
     * greater than or equal
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $gte() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value >= query : false;
        }
    }

    /**
     * not equal
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $ne() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value !== query : false;
        }
    }

    /**
     * equal
     * @param mixed doc_value
     * @param mixed query
     * @return boolean
     */
    get $eq() {
        return (doc_value, query) => {
            return !Array.isArray(query) ? doc_value === query : false;
        };
    }

    /**
     * Handling with comparison of columns
     * @param string field
     * @param mixed query
     * @param object doc
     * @return boolean
     */
    handleComparison(field, query, doc) {
        if(typeof query === 'object')
        {
            const operator = Object.keys(query)[0];
            return this[operator](doc[field], query[operator]);
        }

        return this.$eq(doc[field], query);
    }

    /**
     * Not operator
     * @param array queries
     * @return array
     */
    get $ne() {
        return this.notEqual;
    }
}

module.exports = operators;
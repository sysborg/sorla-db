class operators {
    /**
     * Is operators
     * @param string operator
     * @return boolean
     */
    isOperator(operator) {
        return ['$or', '$and', '$lt', '$lte', '$gt', '$gte', '$eq', '$ne'].indexOf(operator) > -1;
    }

    /**
     * Not operator
     * @param array queries
     * @return array
     */
    operatorNot(queries) {
        //return { $not: queries };
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

    /**
     * less than
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    lessThan(document, field, value) {
        return document[field] < value;
    }

    /**
     * less than or equal
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    lessThanOrEqual(document, field, value) {
        return document[field] <= value;
    }

    /**
     * greater than
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    greaterThan(document, field, value) {
        return document[field] > value;
    }

    /**
     * greater than or equal
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    greaterThanOrEqual(document, field, value) {
        return document[field] >= value;
    }

    /**
     * equal
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    equal(document, field, value) {
        return document[field] == value;
    }

    /**
     * not equal
     * @param object document
     * @param string field
     * @param mixed value
     * @return array
     */
    notEqual(document, field, value) {
        return document[field] != value;
    }

    get $lt() {
        return this.lessThan;
    }

    get $lte() {
        return this.lessThanOrEqual;
    }

    get $gt() {
        return this.greaterThan;
    }

    get $gte() {
        return this.greaterThanOrEqual;
    }

    get $eq() {
        return this.equal;
    }

    get $ne() {
        return this.notEqual;
    }
}

module.exports = operators;
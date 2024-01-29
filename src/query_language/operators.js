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
     * @param object doc
     * @return array
     */
    get $or() {
        return (queries, doc) => {
            if(!Array.isArray(queries))
                throw new Error('The $or operator must be an array');

            let result = false;
            queryLoop: for(const query of queries) {
                for(const attr of Object.keys(query)) {
                    if(this.isLogicalOperator(attr) && this[attr](query[attr], doc))
                    {
                        result = true;
                        continue queryLoop;
                    }

                    if(this.handleComparison(attr, query[attr], doc))
                    {
                        result = true;
                        continue queryLoop;
                    }
                }
            }

            return result;
        };
    }

    /**
     * And operator
     * @param array queries
     * @param object doc
     * @return array
     */
    get $and() {
        return (queries, doc) => {
            if(!Array.isArray(queries))
                throw new Error('The $and operator must be an array');

            let result = true;
            queryLoop: for(const query of queries) {
                for(const attr of Object.keys(query)) {
                    if(this.isLogicalOperator(attr) && !this[attr](query[attr], doc))
                    {
                        result = false;
                        continue queryLoop;
                    }

                    if(!this.handleComparison(attr, query[attr], doc))
                    {
                        result = false;
                        continue queryLoop;
                    }
                }
            }

            return result;
        };
    }

    /**
     * Not operator
     * @param array queries
     * @param object doc
     * @return array
     */
    get $not() {
        const self = this;
        return (queries, doc) => {
            if(!Array.isArray(queries))
                throw new Error('The $not operator must be an array');

            return !self.$and(queries, doc);
        };
    }

    /**
     * Nor operator
     * @param array queries
     * @param object doc
     * @return array
     */
    get $nor() {
        return (queries, doc) => {
            if(!Array.isArray(queries))
                throw new Error('The $nor operator must be an array');

            return !this.$or(queries, doc);
        };
    }

    /**
     * Not in operator
     * @param mixed doc_value
     * @param array queries
     * @return boolean
     */
    get $nin() {
        return (doc_value, queries) => {
            if(!Array.isArray(queries))
                throw new Error('The $nin operator must be an array');

            return !this.$in(doc_value, queries);
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
            if(!Array.isArray(queries))
                throw new Error('The $in operator must be an array');

            if(Array.isArray(doc_value))
            {
                for(const value of queries)
                {
                    if(doc_value.indexOf(value) > -1)
                        return true;
                }
            }

            return  queries.indexOf(doc_value) > -1;
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
class operators {
    /**
     * Constructs the class with the list of supported operators
     */
    constructor() {
        this._logicalOperators = ['$or', '$and', '$not', '$nor'];
        this._comparisonOperators = ['$lt', '$lte', '$gt', '$gte', '$eq', '$ne', '$in', '$nin', '$exists', '$regex', '$options'];
    }

    /**
     * Check if is any operator
     * @param string operator
     * @return boolean
     */
    isAnyOperator(operator) {
        return this.isLogicalOperator(operator) || this.isOperator(operator);
    }

    /**
     * check if is logical operator
     * @param string operator
     * @return boolean
     */
    isLogicalOperator(operator) {
        return this._logicalOperators.indexOf(operator) > -1;
    }

    /**
     * Is operators
     * @param string operator
     * @return boolean
     */
    isOperator(operator) {
        return this._comparisonOperators.indexOf(operator) > -1;
    }

    /**
     * Checks if a document matches a query. Logical operators can be nested at any depth:
     * {$and: [{age: {$gte: 30}}, {$or: [{name: 'X'}, {city: {$in: ['A', 'B']}}]}]}
     * @param object doc
     * @param object query
     * @return boolean
     */
    matches(doc, query) {
        if(query === null || typeof query !== 'object' || Array.isArray(query))
            throw new Error('The query must be an object');

        for(const key of Object.keys(query)) {
            if(this.isLogicalOperator(key)) {
                if(!this.matchesLogical(key, query[key], doc))
                    return false;

                continue;
            }

            if(!this.matchesCondition(doc[key], query[key]))
                return false;
        }

        return true;
    }

    /**
     * Logical operators: every query of $and, at least one of $or, none of $nor
     * @param string operator
     * @param array queries
     * @param object doc
     * @return boolean
     */
    matchesLogical(operator, queries, doc) {
        if(operator === '$not')
            throw new Error('The $not operator must be used inside a field condition, like {age: {$not: {$gt: 30}}}');

        if(!Array.isArray(queries))
            throw new Error(`The ${operator} operator must be an array`);

        switch(operator) {
            case '$and':
                return queries.every(query => this.matches(doc, query));
            case '$or':
                return queries.some(query => this.matches(doc, query));
            case '$nor':
                return !queries.some(query => this.matches(doc, query));
        }

        return false;
    }

    /**
     * Checks a field value against a condition: a plain value means equality, an object of operators
     * must satisfy every operator ({$gte: 1, $lte: 5}), and $not inverts a condition
     * @param mixed value
     * @param mixed condition
     * @return boolean
     */
    matchesCondition(value, condition) {
        if(this.isRegExp(condition))
            return this.matchesRegex(value, condition);

        if(!this.isOperatorObject(condition))
            return this.$eq(value, condition);

        if('$options' in condition && !('$regex' in condition))
            throw new Error('The $options operator must be used with $regex');

        for(const operator of Object.keys(condition)) {
            if(operator === '$not') {
                if(this.matchesCondition(value, condition[operator]))
                    return false;

                continue;
            }

            if(operator === '$options')
                continue;

            if(operator === '$regex') {
                if(!this.matchesRegex(value, this.toRegExp(condition.$regex, condition.$options)))
                    return false;

                continue;
            }

            if(!this.isOperator(operator))
                throw new Error(`Unknown operator ${operator}`);

            if(!this[operator](value, condition[operator]))
                return false;
        }

        return true;
    }

    /**
     * Whether a value is a RegExp (also from another realm: iframes, workers, vm contexts)
     * @param mixed value
     * @return boolean
     */
    isRegExp(value) {
        return Object.prototype.toString.call(value) === '[object RegExp]';
    }

    /**
     * Builds the RegExp of a $regex condition
     * @param string|RegExp pattern
     * @param string options i (case insensitive), m (multiline), s (dot matches new lines)
     * @return RegExp
     */
    toRegExp(pattern, options = '') {
        if(typeof options !== 'string' || /[^ims]/.test(options))
            throw new Error('The $options operator accepts only the flags i, m and s');

        if(this.isRegExp(pattern))
            return new RegExp(pattern.source, [...new Set((pattern.flags + options).replace(/[gy]/g, ''))].join(''));

        if(typeof pattern !== 'string')
            throw new Error('The $regex operator must be a string or a RegExp');

        return new RegExp(pattern, options);
    }

    /**
     * Strings match when the pattern finds them, arrays when one of their strings does
     * @param mixed value
     * @param RegExp regex
     * @return boolean
     */
    matchesRegex(value, regex) {
        const test = item => typeof item === 'string' && (regex.lastIndex = 0, regex.test(item));
        return Array.isArray(value) ? value.some(test) : test(value);
    }

    /**
     * Whether a condition is an object made of operators, like {$gt: 5}
     * @param mixed condition
     * @return boolean
     */
    isOperatorObject(condition) {
        if(condition === null || typeof condition !== 'object' || Array.isArray(condition))
            return false;

        const keys = Object.keys(condition);
        return keys.length > 0 && keys.every(key => key.startsWith('$'));
    }

    /**
     * Exists operator: {field: {$exists: true}} matches documents that have the field (even null)
     * @param mixed doc_value
     * @param boolean exists
     * @return boolean
     */
    get $exists() {
        return (doc_value, exists) => (doc_value !== undefined) === !!exists;
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

            // like MongoDB, regular expressions in the list match strings
            const matchesOne = value => queries.some(query => this.isRegExp(query)
                ? typeof value === 'string' && new RegExp(query.source, query.flags.replace(/[gy]/g, '')).test(value)
                : query === value);

            if(Array.isArray(doc_value) && doc_value.some(matchesOne))
                return true;

            return matchesOne(doc_value);
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
}

module.exports = operators;
class operators {
    /**
     * Or operator
     * @param array queries
     * @return array
     */
    operatorOr(queries) {
        //return { $or: queries };
    }

    /**
     * And operator
     * @param array queries
     * @return array
     */
    operatorAnd(queries) {
        //return { $and: queries };
    }

    /**
     * Not operator
     * @param array queries
     * @return array
     */
    operatorNot(queries) {
        //return { $not: queries };
    }

    get $or() {
        return this.operatorOr;
    }

    get $and() {
        return this.operatorAnd;
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

module.exports = operator;
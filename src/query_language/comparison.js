class comparison {
    /**
     * less than
     * @param $queries
     * @return array
     */
    lessThan($queries) {
        return { $lt: $queries };
    }

    /**
     * less than or equal
     * @param $queries
     * @return array
     */
    lessThanOrEqual($queries) {
        return { $lte: $queries };
    }

    /**
     * greater than
     * @param $queries
     * @return array
     */
    greaterThan($queries) {
        return { $gt: $queries };
    }

    /**
     * greater than or equal
     * @param $queries
     * @return array
     */
    greaterThanOrEqual($queries) {
        return { $gte: $queries };
    }

    /**
     * equal
     * @param $queries
     * @return array
     */
    equal($queries) {
        return { $eq: $queries };
    }

    /**
     * not equal
     * @param $queries
     * @return array
     */
    notEqual($queries) {
        return { $ne: $queries };
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

module.exports = comparison;
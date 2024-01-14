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
}

module.exports = operator;
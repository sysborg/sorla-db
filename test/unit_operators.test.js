const chai = require('chai')
const expect = chai.expect
const operators = require('../src/query_language/operators.js')

describe('SORLA comparison operators', () => {
    const op = new operators();

    it('recognizes logical and comparison operators', () => {
        for(const name of ['$and', '$or', '$not', '$nor'])
            expect(op.isLogicalOperator(name)).to.equal(true);
        for(const name of ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'])
            expect(op.isOperator(name)).to.equal(true);
        expect(op.isAnyOperator('$regex')).to.equal(false);
        expect(op.isAnyOperator('name')).to.equal(false);
    });

    it('$eq is strict', () => {
        expect(op.$eq(1, 1)).to.equal(true);
        expect(op.$eq('1', 1)).to.equal(false);
        expect(op.$eq(null, null)).to.equal(true);
        expect(op.$eq(undefined, null)).to.equal(false);
        expect(op.$eq(true, 1)).to.equal(false);
        expect(op.$eq([1], [1]), 'arrays are not compared').to.equal(false);
    });

    it('$ne is the negation of $eq for scalars', () => {
        expect(op.$ne(1, 2)).to.equal(true);
        expect(op.$ne(1, 1)).to.equal(false);
        expect(op.$ne(undefined, 1), 'missing field').to.equal(true);
    });

    it('range operators compare numbers, strings and ISO dates', () => {
        expect(op.$gt(5, 3)).to.equal(true);
        expect(op.$gte(3, 3)).to.equal(true);
        expect(op.$lt(2, 3)).to.equal(true);
        expect(op.$lte(3, 3)).to.equal(true);
        expect(op.$gt('b', 'a')).to.equal(true);
        expect(op.$lt('2026-01-31', '2026-02-01')).to.equal(true);
        expect(op.$gt(undefined, 0), 'missing field').to.equal(false);
        expect(op.$lt(undefined, 10), 'missing field').to.equal(false);
    });

    it('range operators reject arrays as the operand', () => {
        for(const name of ['$gt', '$gte', '$lt', '$lte', '$eq', '$ne'])
            expect(op[name](1, [1, 2]), name).to.equal(false);
    });

    it('$in and $nin work with scalar and array fields', () => {
        expect(op.$in('a', ['a', 'b'])).to.equal(true);
        expect(op.$in('c', ['a', 'b'])).to.equal(false);
        expect(op.$in(['x', 'b'], ['a', 'b']), 'array field shares a value').to.equal(true);
        expect(op.$in(['x'], ['a', 'b'])).to.equal(false);
        expect(op.$in(1, ['1']), 'strict').to.equal(false);
        expect(op.$nin('c', ['a', 'b'])).to.equal(true);
        expect(op.$nin(undefined, ['a']), 'missing field').to.equal(true);
    });

    it('$in and $nin require an array', () => {
        expect(() => op.$in('a', 'a')).to.throw('$in operator must be an array');
        expect(() => op.$nin('a', 'a')).to.throw('$nin operator must be an array');
    });

    it('matchesCondition treats plain values as equality and objects of operators as conditions', () => {
        expect(op.matchesCondition(5, 5)).to.equal(true);
        expect(op.matchesCondition(5, { $gt: 1, $lt: 10 })).to.equal(true);
        expect(op.matchesCondition(5, { $gt: 1, $lt: 4 })).to.equal(false);
        expect(op.matchesCondition(5, { $not: { $gt: 10 } })).to.equal(true);
        expect(op.matchesCondition({ a: 1 }, { a: 1 }), 'objects are not deep compared').to.equal(false);
    });

    it('isOperatorObject only accepts non empty objects made of operators', () => {
        expect(op.isOperatorObject({ $gt: 1 })).to.equal(true);
        expect(op.isOperatorObject({ $gt: 1, name: 2 })).to.equal(false);
        expect(op.isOperatorObject({})).to.equal(false);
        expect(op.isOperatorObject(null)).to.equal(false);
        expect(op.isOperatorObject([1])).to.equal(false);
    });
});

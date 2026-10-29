const chai = require('chai')
const expect = chai.expect
const operators = require('../src/query_language/operators.js')

describe('SORLA comparison operators', () => {
    const op = new operators();

    it('recognizes logical and comparison operators', () => {
        for(const name of ['$and', '$or', '$not', '$nor'])
            expect(op.isLogicalOperator(name)).to.equal(true);
        for(const name of ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex'])
            expect(op.isOperator(name)).to.equal(true);
        expect(op.isAnyOperator('$where')).to.equal(false);
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

    it('$exists tells missing fields apart from null ones', () => {
        expect(op.$exists(undefined, true)).to.equal(false);
        expect(op.$exists(null, true)).to.equal(true);
        expect(op.$exists(0, true)).to.equal(true);
        expect(op.$exists(undefined, false)).to.equal(true);
        expect(op.$exists('a', false)).to.equal(false);
    });

    it('$regex matches strings and arrays of strings, with options', () => {
        expect(op.matchesCondition('Ana', { $regex: '^an', $options: 'i' })).to.equal(true);
        expect(op.matchesCondition('Ana', { $regex: '^an' })).to.equal(false);
        expect(op.matchesCondition('Ana', /^AN/i)).to.equal(true);
        expect(op.matchesCondition(['x', 'Admin'], { $regex: 'adm', $options: 'i' })).to.equal(true);
        expect(op.matchesCondition(42, { $regex: '4' }), 'only strings match').to.equal(false);
        expect(op.matchesCondition(undefined, { $regex: '.*' })).to.equal(false);
        expect(op.matchesCondition('a\nb', { $regex: 'a.b', $options: 's' })).to.equal(true);
        expect(op.matchesCondition('Ana', { $not: { $regex: 'z' } })).to.equal(true);
    });

    it('a global RegExp gives the same answer on every call', () => {
        const regex = /a/g;
        expect([1, 2, 3].map(() => op.matchesCondition('banana', regex))).to.deep.equal([true, true, true]);
    });

    it('rejects invalid $regex usage', () => {
        expect(() => op.matchesCondition('a', { $options: 'i' })).to.throw('must be used with $regex');
        expect(() => op.matchesCondition('a', { $regex: 'a', $options: 'g' })).to.throw('flags i, m and s');
        expect(() => op.matchesCondition('a', { $regex: 5 })).to.throw('string or a RegExp');
    });

    it('isOperatorObject only accepts non empty objects made of operators', () => {
        expect(op.isOperatorObject({ $gt: 1 })).to.equal(true);
        expect(op.isOperatorObject({ $gt: 1, name: 2 })).to.equal(false);
        expect(op.isOperatorObject({})).to.equal(false);
        expect(op.isOperatorObject(null)).to.equal(false);
        expect(op.isOperatorObject([1])).to.equal(false);
    });
});

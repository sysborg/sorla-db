const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

describe('SORLA nested logical queries', () => {
    let people;

    beforeAll(() => {
        const srla = new sorla();
        srla.useDb('nestedQueries');
        srla.db.createCollection('people');
        srla.db.people.insertOne({ name: 'Ana', age: 25, city: 'A', tags: ['admin'] });
        srla.db.people.insertOne({ name: 'Bruno', age: 31, city: 'B', tags: [] });
        srla.db.people.insertOne({ name: 'Carla', age: 42, city: 'C', tags: ['admin', 'dev'] });
        srla.db.people.insertOne({ name: 'Davi', age: 35, city: 'A' });
        srla.db.people.insertOne({ name: 'Eva', age: 19, city: 'D', tags: ['dev'] });
        people = srla.db.people;
    });

    const names = cursor => {
        const result = [];
        while(cursor.hasNext()) result.push(cursor.next()._data.name);
        return result;
    };

    it('combines $and with a nested $or', () => {
        const docs = people.find({
            $and: [
                { age: { $gte: 30 } },
                { $or: [{ name: 'Carla' }, { city: { $in: ['A', 'B'] } }] }
            ]
        });
        expect(names(docs)).to.deep.equal(['Bruno', 'Carla', 'Davi']);
    });

    it('nests groups at any depth', () => {
        const docs = people.find({
            $or: [
                { $and: [{ city: 'A' }, { $or: [{ age: { $lt: 30 } }, { name: 'Davi' }] }] },
                { $and: [{ city: 'D' }, { age: { $lt: 20 } }] }
            ]
        });
        expect(names(docs)).to.deep.equal(['Ana', 'Davi', 'Eva']);
    });

    it('evaluates every operator of a field inside $or', () => {
        const docs = people.find({ $or: [{ age: { $gte: 30, $lte: 35 } }, { name: 'Eva' }] });
        expect(names(docs)).to.deep.equal(['Bruno', 'Davi', 'Eva']);
    });

    it('evaluates every operator of a field at the top level', () => {
        expect(names(people.find({ age: { $gt: 20, $lt: 40, $ne: 31 } }))).to.deep.equal(['Ana', 'Davi']);
    });

    it('supports $nor with nested groups', () => {
        const docs = people.find({ $nor: [{ city: 'A' }, { $and: [{ age: { $gt: 40 } }, { city: 'C' }] }] });
        expect(names(docs)).to.deep.equal(['Bruno', 'Eva']);
    });

    it('$not inverts the whole condition, with one or more operators', () => {
        expect(names(people.find({ age: { $not: { $gte: 30 } } }))).to.deep.equal(['Ana', 'Eva']);
        expect(names(people.find({ age: { $not: { $gte: 30, $lte: 35 } } }))).to.deep.equal(['Ana', 'Carla', 'Eva']);
    });

    it('$not can be combined with other operators and logical groups', () => {
        const docs = people.find({ $and: [{ city: { $not: { $eq: 'A' } } }, { $or: [{ age: { $lt: 20 } }, { name: 'Bruno' }] }] });
        expect(names(docs)).to.deep.equal(['Bruno', 'Eva']);
    });

    it('matches array fields with $in', () => {
        expect(names(people.find({ $or: [{ tags: { $in: ['dev'] } }, { age: 31 }] }))).to.deep.equal(['Bruno', 'Carla', 'Eva']);
    });

    it('a field missing in the document matches $ne and $nin', () => {
        expect(names(people.find({ tags: { $ne: 'x' }, city: 'A' }))).to.deep.equal(['Ana', 'Davi']);
        expect(names(people.find({ name: { $nin: ['Ana', 'Bruno'] }, age: { $lt: 40 } }))).to.deep.equal(['Davi', 'Eva']);
    });

    it('accepts null values in conditions', () => {
        expect(people.find({ name: null }).length).to.equal(0);
        expect(people.find({ $or: [{ name: null }, { name: 'Ana' }] }).length).to.equal(1);
    });

    it('findOne works with nested queries', () => {
        const doc = people.findOne({ $and: [{ $or: [{ city: 'C' }, { city: 'D' }] }, { age: { $gt: 40 } }] });
        expect(doc.name).to.equal('Carla');
    });

    it('rejects invalid queries with a clear error', () => {
        expect(() => people.find({ $or: { name: 'Ana' } })).to.throw('The $or operator must be an array');
        expect(() => people.find({ age: { $between: [1, 2] } })).to.throw('Unknown operator $between');
        expect(() => people.find({ $not: { age: 1 } })).to.throw('$not operator must be used inside a field condition');
    });
});

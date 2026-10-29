const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

describe('SORLA cursor', () => {
    let people;

    beforeAll(() => {
        const srla = new sorla();
        srla.useDb('cursor');
        srla.db.createCollection('people');
        people = srla.db.people;
        for(const [name, age] of [['Carla', 42], ['Ana', 25], ['Bruno', 31]])
            people.insertOne({ name, age, email: `${name.toLowerCase()}@mail.com` });
    });

    it('iterates with hasNext/next and can be reset', () => {
        const cursor = people.find({});
        expect(cursor.length).to.equal(3);
        const names = [];
        while(cursor.hasNext()) names.push(cursor.next()._data.name);
        expect(names).to.deep.equal(['Carla', 'Ana', 'Bruno']);
        expect(() => cursor.next()).to.throw('No more item to the cursor');
        cursor.reset();
        expect(cursor.next()._data.name).to.equal('Carla');
    });

    it('first() returns the data of the first document', () => {
        expect(people.find({ age: { $gt: 30 } }).first().name).to.equal('Carla');
    });

    it('returns copies: changing a result does not change the collection', () => {
        const cursor = people.find({ name: 'Ana' });
        cursor.next()._data.age = 99;
        expect(people.findOne({ name: 'Ana' }).age).to.equal(25);
    });

    it('projection with 0 removes fields from the results only', () => {
        const cursor = people.find({ name: 'Ana' }, { email: 0 });
        expect(cursor.next()._data).to.not.have.property('email');
        expect(people.findOne({ name: 'Ana' }).email).to.equal('ana@mail.com');
    });

    it('last() gives access to the fields of the last document', () => {
        expect(people.find({}).last().name).to.equal('Bruno');
    });

    it('push only accepts objects', () => {
        const cursor = people.find({});
        expect(() => cursor.push('x')).to.throw('The element must be an object');
        cursor.push({ name: 'Extra' });
        expect(cursor.length).to.equal(4);
    });

    it('sorts by a number ascending and returns the cursor for chaining', () => {
        const cursor = people.find({});
        expect(cursor.sort({ age: 1 })).to.equal(cursor);
        expect(cursor.toArray().map(doc => doc.name)).to.deep.equal(['Ana', 'Bruno', 'Carla']);
    });

    it('sorts by several fields and directions', () => {
        const cursor = people.find({}).sort({ age: -1, name: 1 });
        expect(cursor.first().name).to.equal('Carla');
        expect(cursor.last().name).to.equal('Ana');
    });

    it('toArray returns plain copies', () => {
        const rows = people.find({}).toArray();
        expect(rows.map(doc => doc.name)).to.deep.equal(['Carla', 'Ana', 'Bruno']);
        rows[0].name = 'changed';
        expect(people.findOne({ name: 'Carla' })).to.not.equal(null);
    });

    it('findOne returns null when nothing matches, first() and last() of an empty cursor too', () => {
        expect(people.findOne({ name: 'Nobody' })).to.equal(null);
        expect(people.find({ name: 'Nobody' }).first()).to.equal(null);
        expect(people.find({ name: 'Nobody' }).last()).to.equal(null);
    });

    it('rejects invalid sort specifications', () => {
        expect(() => people.find({}).sort('age')).to.throw('must be an object');
        expect(() => people.find({}).sort({ age: 'asc' })).to.throw('must be 1 or -1');
    });

    it.todo('projection with 1 keeps only the listed fields');
    it.todo('skip() and limit()');
});

describe('SORLA cursor sort order', () => {
    let items;

    beforeAll(() => {
        const srla = new sorla();
        srla.useDb('sortOrder');
        srla.db.createCollection('items');
        items = srla.db.items;
        const rows = [
            { n: 1, v: 'b' }, { n: 2, v: 10 }, { n: 3, v: null }, { n: 4 }, { n: 5, v: true },
            { n: 6, v: 'B' }, { n: 7, v: 2 }, { n: 8, v: 'á' }, { n: 9, v: new Date('2026-01-01') },
            { n: 10, v: false }, { n: 11, v: 'a' }, { n: 12, v: new Date('2025-01-01') }, { n: 13, v: 'item 10' }, { n: 14, v: 'item 2' }
        ];
        items.insertMany(rows);
    });

    const order = (spec, options) => items.find({}).sort(spec, options).toArray().map(doc => doc.n);

    it('orders mixed types like MongoDB: missing/null, numbers, strings, booleans, dates', () => {
        // missing and null keep insertion order (stable sort), strings by code point
        expect(order({ v: 1 })).to.deep.equal([3, 4, 7, 2, 6, 11, 1, 13, 14, 8, 10, 5, 12, 9]);
    });

    it('descending reverses the order', () => {
        expect(order({ v: -1 })).to.deep.equal([9, 12, 5, 10, 8, 14, 13, 1, 11, 6, 2, 7, 3, 4]);
    });

    it('collation sorts strings by language rules', () => {
        const strings = items.find({ v: { $in: ['b', 'B', 'á', 'a', 'item 10', 'item 2'] } })
            .sort({ v: 1 }, { collation: { locale: 'pt-BR', sensitivity: 'base', numeric: true } })
            .toArray().map(doc => doc.v);
        expect(strings.slice(0, 2).sort()).to.deep.equal(['a', 'á'].sort());
        expect(strings.slice(-2)).to.deep.equal(['item 2', 'item 10']);
    });

    it('sorts by a nested path', () => {
        const srla = new sorla();
        srla.useDb('nestedSort');
        srla.db.createCollection('c');
        srla.db.c.insertMany([{ n: 1, a: { b: 3 } }, { n: 2, a: { b: 1 } }, { n: 3, a: {} }]);
        expect(srla.db.c.find({}).sort({ 'a.b': 1 }).toArray().map(doc => doc.n)).to.deep.equal([3, 2, 1]);
    });
});

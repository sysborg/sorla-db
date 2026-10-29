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

    it('projection with 1 keeps only the listed fields and _id', () => {
        expect(people.find({ name: 'Ana' }, { name: 1 }).first()).to.have.all.keys('name', '_id');
        expect(people.find({ name: 'Ana' }, { name: 1, _id: 0 }).first()).to.deep.equal({ name: 'Ana' });
        expect(people.find({ name: 'Ana' }, { _id: 0 }).first()).to.not.have.property('_id');
        expect(people.findOne({ name: 'Ana' }, { age: 1 })).to.have.all.keys('age', '_id');
    });

    it('rejects invalid projections', () => {
        expect(() => people.find({}, { name: 1, email: 0 })).to.throw('cannot mix');
        expect(() => people.find({}, { name: true })).to.throw('must be 0 or 1');
        expect(() => people.find({}, { 'a.b': 1 })).to.throw('top level fields only');
    });

    it('skip() and limit() page through sorted results', () => {
        const page = (skip, limit) => people.find({}).sort({ age: 1 }).skip(skip).limit(limit).toArray().map(doc => doc.name);
        expect(page(0, 2)).to.deep.equal(['Ana', 'Bruno']);
        expect(page(2, 2)).to.deep.equal(['Carla']);
        expect(page(5, 2)).to.deep.equal([]);
        expect(page(1, 0), 'limit(0) means no limit').to.deep.equal(['Bruno', 'Carla']);
        expect(() => people.find({}).skip(-1)).to.throw('non negative integer');
        expect(() => people.find({}).limit(1.5)).to.throw('non negative integer');
    });
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

    it('orders mixed types like MongoDB: numbers, strings, booleans, dates, then missing/null', () => {
        // missing and null keep insertion order (stable sort), strings by code point
        expect(order({ v: 1 })).to.deep.equal([7, 2, 6, 11, 1, 13, 14, 8, 10, 5, 12, 9, 3, 4]);
    });

    it('descending reverses the values; missing/null stay last', () => {
        expect(order({ v: -1 })).to.deep.equal([9, 12, 5, 10, 8, 14, 13, 1, 11, 6, 2, 7, 3, 4]);
    });

    it('nulls: "first" puts missing/null first in both directions', () => {
        expect(order({ v: 1 }, { nulls: 'first' })).to.deep.equal([3, 4, 7, 2, 6, 11, 1, 13, 14, 8, 10, 5, 12, 9]);
        expect(order({ v: -1 }, { nulls: 'first' })).to.deep.equal([3, 4, 9, 12, 5, 10, 8, 14, 13, 1, 11, 6, 2, 7]);
        expect(() => order({ v: 1 }, { nulls: 'middle' })).to.throw('"first" or "last"');
    });

    it('the collection option sets the default, a sort option overrides it', () => {
        const srla = new sorla();
        srla.useDb('nullsOption');
        srla.db.createCollection('c', null, { nulls: 'first' });
        srla.db.c.insertMany([{ n: 1, v: 2 }, { n: 2 }, { n: 3, v: 1 }]);
        const sorted = options => srla.db.c.find({}).sort({ v: 1 }, options).toArray().map(doc => doc.n);
        expect(sorted()).to.deep.equal([2, 3, 1]);
        expect(sorted({ nulls: 'last' })).to.deep.equal([3, 1, 2]);
        srla.db.c.setOptions({ nulls: 'last' });
        expect(sorted()).to.deep.equal([3, 1, 2]);
        expect(srla.db.c.getOptions()).to.deep.equal({ nulls: 'last' });
        expect(() => srla.db.c.setOptions({ nulls: 'up' })).to.throw('"first" or "last"');
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
        expect(srla.db.c.find({}).sort({ 'a.b': 1 }).toArray().map(doc => doc.n)).to.deep.equal([2, 1, 3]);
    });
});

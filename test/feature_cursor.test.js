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
        // projection logs every removed property
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterAll(() => jest.restoreAllMocks());

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

    // ---- known bugs: these document current behavior and will start failing once fixed

    it.failing('sorts by a number ascending (cursor.js/document.js circular require)', () => {
        const cursor = people.find({});
        cursor.sort({ age: 1 });
        expect(cursor.first().name).to.equal('Ana');
    });

    it.failing('sorts by several fields descending', () => {
        const cursor = people.find({});
        cursor.sort({ age: -1, name: 1 });
        expect(cursor.first().name).to.equal('Carla');
    });

    it.failing('toArray returns plain objects (structuredClone of a Proxy)', () => {
        expect(people.find({}).toArray().map(doc => doc.name)).to.deep.equal(['Carla', 'Ana', 'Bruno']);
    });

    it.failing('findOne returns null when nothing matches', () => {
        expect(people.findOne({ name: 'Nobody' })).to.equal(null);
    });


    it.todo('projection with 1 keeps only the listed fields');
    it.todo('skip() and limit()');
});

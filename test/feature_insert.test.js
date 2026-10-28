const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('SORLA inserting documents', () => {
    let srla;
    let counter = 0;
    const fresh = () => {
        const name = `insert${++counter}`;
        srla.db.createCollection(name);
        return srla.db[name];
    };

    beforeAll(() => {
        srla = new sorla();
        srla.useDb('inserts');
        // insertMany logs the count of invalid documents on every call
        jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterAll(() => jest.restoreAllMocks());

    it('generates a uuid v4 _id when the document has none', () => {
        const collection = fresh();
        collection.insertOne({ name: 'Ana' });
        expect(collection.first._id).to.match(UUID_V4);
    });

    it('generates unique ids', () => {
        const collection = fresh();
        for(let i = 0; i < 500; i++) collection.insertOne({ i });
        const ids = new Set(collection.all.map(doc => doc._id));
        expect(ids.size).to.equal(500);
    });

    it('keeps a provided _id', () => {
        const collection = fresh();
        collection.insertOne({ _id: 'custom-1', name: 'Ana' });
        expect(collection.findOne({ _id: 'custom-1' }).name).to.equal('Ana');
    });

    it('keeps values of every type', () => {
        const collection = fresh();
        collection.insertOne({ text: 'a', number: 1.5, flag: false, list: [1, 'b'], nested: { deep: { value: 3 } }, empty: '' });
        const doc = collection.first;
        expect(doc).to.include({ text: 'a', number: 1.5, flag: false, empty: '' });
        expect(doc.list).to.deep.equal([1, 'b']);
        expect(doc.nested.deep.value).to.equal(3);
    });

    it('insertMany inserts in order and counts', () => {
        const collection = fresh();
        collection.insertMany([{ n: 1 }, { n: 2 }, { n: 3 }]);
        expect(collection.count()).to.equal(3);
        expect(collection.all.map(doc => doc.n)).to.deep.equal([1, 2, 3]);
        expect(collection.last.n).to.equal(3);
    });

    it('calls the callbacks', () => {
        const collection = fresh();
        let calls = 0;
        collection.insertOne({ n: 1 }, () => calls++);
        collection.insertMany([{ n: 2 }], () => calls++);
        expect(calls).to.equal(2);
    });

    it('rejects documents that are not objects', () => {
        const collection = fresh();
        expect(() => collection.insertOne('text')).to.throw('Invalid document type');
        expect(() => collection.insertOne(['a'])).to.throw('Invalid document type');
        expect(() => collection.insertMany('text')).to.throw();
        expect(() => collection.insertMany([{ a: 1 }, 'b'])).to.throw('Documents must be an array of objects');
    });

    it('rejects keys with $ or .', () => {
        const collection = fresh();
        expect(() => collection.insertOne({ $name: 'a' })).to.throw('Invalid document keys');
        expect(() => collection.insertOne({ 'a.b': 1 })).to.throw('Invalid document keys');
        expect(() => collection.insertOne({ nested: { 'a.b': 1 } })).to.throw('Invalid document keys');
        expect(() => collection.insertOne({ list: [{ 'a.b': 1 }] })).to.throw('Invalid document keys');
        expect(collection.count()).to.equal(0);
    });

    // ---- known bugs: these document current behavior and will start failing once fixed

    it.failing('accepts null values (Object.keys(null) in _validateKeys)', () => {
        const collection = fresh();
        collection.insertOne({ name: 'Ana', nickname: null });
        expect(collection.first.nickname).to.equal(null);
    });

    it.failing('validates every nested object, not only the first one', () => {
        const collection = fresh();
        expect(() => collection.insertOne({ first: { ok: 1 }, second: { 'a.b': 1 } })).to.throw('Invalid document keys');
    });

    it.failing('rejects a duplicated _id', () => {
        const collection = fresh();
        collection.insertOne({ _id: 'same' });
        expect(() => collection.insertOne({ _id: 'same' })).to.throw();
    });

    it.failing('insertMany explains why a non array is rejected (it calls reduce before validating)', () => {
        const collection = fresh();
        expect(() => collection.insertMany('text')).to.throw('Documents must be an array of objects');
    });

    it.failing('does not mutate the inserted object', () => {
        const collection = fresh();
        const input = { name: 'Ana' };
        collection.insertOne(input);
        expect(input).to.not.have.property('_id');
    });
});

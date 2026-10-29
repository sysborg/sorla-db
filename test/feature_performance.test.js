const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

// generous limits: they catch quadratic behaviour (minutes) without failing on slow CI machines
describe('SORLA performance', () => {
    const collection = () => {
        const srla = new sorla();
        srla.useDb(`perf${Math.random()}`);
        srla.db.createCollection('c');
        return srla.db.c;
    };
    const rows = count => Array.from({ length: count }, (_, i) => ({ n: i, name: `item ${i}`, tags: ['a'] }));

    it('inserts 50 000 documents with insertMany in linear time', () => {
        const c = collection();
        const started = Date.now();
        c.insertMany(rows(50000));
        expect(c.count()).to.equal(50000);
        expect(Date.now() - started).to.be.below(5000);
    });

    it('inserts 20 000 documents one by one in linear time', () => {
        const c = collection();
        const started = Date.now();
        for(const row of rows(20000)) c.insertOne(row);
        expect(c.count()).to.equal(20000);
        expect(Date.now() - started).to.be.below(5000);
    });

    it('keeps rejecting duplicated ids after many inserts and deletes', () => {
        const c = collection();
        c.insertMany(rows(1000).map(row => ({ ...row, _id: `id${row.n}` })));
        c.deleteMany({ n: { $lt: 500 } });
        expect(() => c.insertOne({ _id: 'id999' })).to.throw('Duplicate');
        expect(() => c.insertOne({ _id: 'id10' })).to.not.throw();
    });
});

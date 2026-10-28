const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

describe('SORLA databases and collections', () => {
    it('useDb creates the database when needed and selects it', () => {
        const srla = new sorla();
        expect(srla.dbExists('shop')).to.equal(false);
        srla.useDb('shop');
        expect(srla.dbExists('shop')).to.equal(true);
        expect(srla.db.name).to.equal('shop');
        expect(srla.countDb()).to.equal(1);
    });

    it('createDb returns the position, or false when the name exists', () => {
        const srla = new sorla();
        expect(srla.createDb('a')).to.equal(0);
        expect(srla.createDb('b')).to.equal(1);
        expect(srla.createDb('a')).to.equal(false);
    });

    it('keeps databases and their collections isolated', () => {
        const srla = new sorla();
        srla.useDb('one');
        srla.db.createCollection('items');
        srla.db.items.insertOne({ n: 1 });
        srla.useDb('two');
        srla.db.createCollection('items');
        expect(srla.db.items.count()).to.equal(0);
        srla.useDb('one');
        expect(srla.db.items.count()).to.equal(1);
    });

    it('instances do not share data', () => {
        const a = new sorla();
        const b = new sorla();
        a.useDb('x');
        expect(b.dbExists('x')).to.equal(false);
    });

    it('rejects duplicated collection names', () => {
        const srla = new sorla();
        srla.useDb('dupes');
        srla.db.createCollection('items');
        expect(() => srla.db.createCollection('items')).to.throw('Collection already exists');
        expect(srla.db.countCollections()).to.equal(1);
    });

    it('collection count, first, last and all', () => {
        const srla = new sorla();
        srla.useDb('basics');
        srla.db.createCollection('items');
        const items = srla.db.items;
        expect(items.count()).to.equal(0);
        items.insertOne({ n: 1 });
        items.insertOne({ n: 2 });
        expect(items.count()).to.equal(2);
        expect(items.first.n).to.equal(1);
        expect(items.last.n).to.equal(2);
        expect(items.all.length).to.equal(2);
    });
});

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

    it('lists, inspects and drops collections', () => {
        const srla = new sorla();
        srla.useDb('inspect');
        srla.db.createCollection('people');
        srla.db.createCollection('orders');
        srla.db.people.insertMany([{ n: 1 }, { n: 2 }]);
        expect(srla.db.listCollections()).to.deep.equal(['people', 'orders']);
        expect(srla.db.getStats()).to.deep.equal({ name: 'inspect', documents: 2, collections: [{ name: 'people', documents: 2 }, { name: 'orders', documents: 0 }] });
        expect(srla.db.getCollection('people').count()).to.equal(2);
        expect(srla.db.getCollection('missing')).to.equal(undefined);
        expect(srla.db.dropCollection('orders')).to.equal(true);
        expect(srla.db.dropCollection('orders')).to.equal(false);
        expect(srla.db.listCollections()).to.deep.equal(['people']);
        expect(srla.db.countCollections()).to.equal(1);
        srla.db.createCollection('orders');
        expect(srla.db.orders.count(), 'a dropped name can be created again, empty').to.equal(0);
    });

    it('"stats" and other common words stay valid collection names', () => {
        const srla = new sorla();
        srla.useDb('names');
        for(const name of ['stats', 'users', 'logs', 'collections'])
            expect(() => srla.db.createCollection(name), name).to.not.throw();
        expect(srla.db.stats.count()).to.equal(0);
    });

    it('lists and drops databases', () => {
        const srla = new sorla();
        srla.useDb('one');
        srla.useDb('two');
        expect(srla.listDatabases()).to.deep.equal(['one', 'two']);
        expect(srla.dropDb('two')).to.equal(true);
        expect(srla.db).to.equal(null, 'the selected database was dropped');
        expect(srla.dropDb('two')).to.equal(false);
        expect(srla.listDatabases()).to.deep.equal(['one']);
    });
});

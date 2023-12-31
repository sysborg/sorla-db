const chai = require('chai')
const expect = chai.expect
const faker = require('faker')
const sorla = require('../src/sorla.js')
const collection = require('../src/collections/collection.js');

describe('SORLA Database Unit Text', () => {
    beforeAll(() => {
        this.srla = new sorla();
        this.dbname = faker.random.word();
        this.srla.createDb(this.dbname);
        this.srla.useDb(this.dbname);
    });

    it('Should create a new collection with specified name', () => {
        this.srla.db.createCollection('collection1');
        expect(this.srla.db.countCollections()).to.equal(1);
        expect(this.srla.db.collection1).to.not.be.undefined;
        expect(this.srla.db.collection1).to.be.an.instanceof(collection);
    });

    it('Should create a new collection with specified name, second collection', () => {
        this.srla.db.createCollection('collection2');
        expect(this.srla.db.countCollections()).to.equal(2);
        expect(this.srla.db.collection2).to.not.be.undefined;
        expect(this.srla.db.collection2).to.be.an.instanceof(collection);
    });

    it('Should return a collection undefined when not exists', () => {
        expect(this.srla.db.collection3).to.be.undefined;
    });

    it('Should avoid create a collection with name that exists in database class', () => {
        expect(() => this.srla.db.createCollection('_name')).to.throw();
    });
});
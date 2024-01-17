const chai = require('chai')
const expect = chai.expect
const faker = require('faker')
const sorla = require('../src/sorla.js')

describe('SORLA Collection Feature Test', () => {
    beforeAll(() => {
        this.srla = new sorla();
        this.dbname = faker.random.word();
        this.srla.createDb(this.dbname);
        this.srla.useDb(this.dbname);
    });

    beforeEach(() => {
        this.collectionName = faker.random.word();
        this.srla.db.createCollection(this.collectionName);
    });

    it('Create a single document inside of a collection and check by length', () => {
        this.srla.db[this.collectionName].insertOne({name: 'Anderson'});
        expect(this.srla.db[this.collectionName].count()).to.equal(1);
    });

    it('create multiple documents and check by length', () => {
        this.srla.db[this.collectionName].insertMany([
            {name: 'Anderson'},
            {name: 'Arruda'},
            {name: 'Sorla'}
        ]);
        expect(this.srla.db[this.collectionName].count()).to.equal(3);
    });

    it('create a document with prohibited character $', () => {
        expect(() => this.srla.db[this.collectionName].insertOne({name: 'Anderson', $test: '123'})).to.throw();
    });

    it('create a document with prohibited character .', () => {
        expect(() => this.srla.db[this.collectionName].insertOne({"name.name": 'Anderson', test: {test: '123'}})).to.throw();
    });

    it('create a document with prohibited character . inside of an array', () => {
        expect(() => this.srla.db[this.collectionName].insertOne({name: 'Anderson', test: [{"test.number": '123'}, {"test.number": '123'}]})).to.throw();
    });

    it('create a document with prohibited character . inside of an object', () => {
        expect(() => this.srla.db[this.collectionName].insertOne({name: 'Anderson', test: {"test.number": '123'}})).to.throw();
    });

    it('get a document by his subfield using test.inscription', () => {
        this.srla.db[this.collectionName].insertMany([
            {name: 'Anderson', test: {inscription: 123}},
            {name: 'Arruda', test: {inscription: 321}},
            {name: 'Sorla', test: {inscription: 213}}
        ]);
        expect(this.srla.db[this.collectionName].find({'test.inscription': 123}).length).to.equal(1);
    });

    /*it('Try to create a document without beeing a valid object', () => {
        expect(() => this.srla.db[this.collectionName].insertOne('Anderson')).to.throw();
    });

    it('Try to create a document with array', () => {
        expect(() => this.srla.db[this.collectionName].insertOne(['Anderson'])).to.throw();
    });

    it('Try to create many documents without beeing a valid array', () => {
        expect(() => this.srla.db[this.collectionName].insertMany('Anderson')).to.throw();
    });

    it('Try to create many documents without having valid object', () => {
        expect(() => this.srla.db[this.collectionName].insertMany([{test: '123', }, 'anderson'])).to.throw();
    });*/
});
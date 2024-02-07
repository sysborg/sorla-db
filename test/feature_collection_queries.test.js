const chai = require('chai')
const expect = chai.expect
const faker = require('faker')
const sorla = require('../src/sorla.js')
const helper = require('../src/helper.js')

describe('SORLA Collection Queries Feature Test', () => {
    beforeAll(() => {
        this.srla = new sorla();
        this.dbname = faker.random.word();
        this.srla.createDb(this.dbname);
        this.srla.useDb(this.dbname);
        this.collectionName = faker.random.word();
        this.srla.db.createCollection(this.collectionName);
        this.objects = helper.createFakeCollection(this.srla, this.collectionName, 30);
    });

    it('Test if the first document in the collection is the same first document on the objects array', () => {
        const firstDoc = this.srla.db[this.collectionName].findOne({}, { _id: 0 });
        const firstObj = this.objects[0];
        expect(firstDoc).to.deep.equal(firstObj);
    });

    it('Takes the data field name from the document inside the collection', () => {
        const firstDoc = this.srla.db[this.collectionName].findOne({}, { _id: 0 });
        const firstObj = this.objects[0];
        expect(firstDoc.name).to.be.a('string').equal(firstObj.name);
    });

    it('Takes the data field email from the document inside the collection', () => {
        const firstDoc = this.srla.db[this.collectionName].findOne({}, { _id: 0 });
        const firstObj = this.objects[0];
        expect(firstDoc.email).to.be.a('string').equal(firstObj.email);
    });

    it('Takes the data field age from the document inside the collection', () => {
        const firstDoc = this.srla.db[this.collectionName].findOne({}, { _id: 0 });
        const firstObj = this.objects[0];
        expect(firstDoc.age).to.be.a('number').equal(firstObj.age);
    });

    it('Creates a few documents and search for one of them', () => {
        const [item1,] = helper.getRandomComparisonData(this.objects);
        const doc = this.srla.db[this.collectionName].findOne({ uuid: item1.uuid }, { _id: 0 });
        expect(doc).to.deep.equal(item1);
    });

    it('Creates a few documents and search for some of them', () => {
        const [item1, item2] = helper.getRandomComparisonData(this.objects);
        const docs = this.srla.db[this.collectionName].find({
            $or: [
                { uuid: item1.uuid },
                { uuid: item2.uuid }
            ]
        });

        expect(docs.length).to.be.equal(2);
    });

    it('Creates a few documents and search using not', () => {
        const [item1] = helper.getRandomComparisonData(this.objects);
        const docs = this.srla.db[this.collectionName].find(
            {
                uuid: { 
                    $not: {
                        $eq: item1.uuid 
                    }
                }
            }
        );

        expect(docs.length).to.be.equal(this.objects.length - 1);
    });

    it('Creates a few documents and search using not with more than one expression', () => {
        const [item1,] = helper.getRandomComparisonData(this.objects);
        const docs = this.srla.db[this.collectionName].find(
            {
                age: { 
                    $not: {
                        $eq: item1.age,
                        $gt: 18
                    }
                }
            }
        );

        expect(docs.length).to.be.equal(this.objects.length - 1);
    });

    it('Creates a few documents and search it using nor', () => {
        const [item1,] = helper.getRandomComparisonData(this.objects);
        const docs = this.srla.db[this.collectionName].findOne({
            $nor: [
                {name: item1.name},
                {age: item1.age}
            ]
        });

        expect(docs.name).to.not.be.equal(item1.name);
        expect(docs.age).to.not.be.equal(item1.age);
    });

    it('Creates a few documents and search it using nor with more than one expression', () => {
        const [item1, item2] = helper.getRandomComparisonData(this.objects);
        const docs = this.srla.db[this.collectionName].find({
            $nor: [
                {name: item1.name},
                {age: item1.age},
                {name: item2.name},
                {age: item2.age}
            ]
        });

        expect(docs.length).to.be.equal(this.objects.length - 2);
    });
});
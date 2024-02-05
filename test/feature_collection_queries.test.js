const chai = require('chai')
const expect = chai.expect
const faker = require('faker')
const sorla = require('../src/sorla.js')

const searchItem = (array) => {
    const itemIndex1 = Math.floor(Math.random() * this.objects.length);
    let itemIndex2 = null;
    do {
        itemIndex2 = Math.floor(Math.random() * this.objects.length);
    } while(itemIndex1 === itemIndex2);

    return [itemIndex1, itemIndex2];
};

describe('SORLA Collection Queries Feature Test', () => {
    beforeAll(() => {
        this.srla = new sorla();
        this.dbname = faker.random.word();
        this.srla.createDb(this.dbname);
        this.srla.useDb(this.dbname);
    });

    beforeEach(() => {
        this.collectionName = faker.random.word();
        this.srla.db.createCollection(this.collectionName);
        this.objects = [];

        for(let i=0; i<10; i++)
        {
            const obj = {
                name: faker.random.word(),
                email: faker.internet.email(),
                age: faker.datatype.number(),
                uuid: faker.datatype.uuid()
            };
            this.objects.push(obj);
            this.srla.db[this.collectionName].insertOne(structuredClone(obj));
        }
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
        const [itemIndex1,] = searchItem(this.objects);
        const doc = this.srla.db[this.collectionName].findOne({ uuid: this.objects[itemIndex1].uuid }, { _id: 0 });
        expect(doc).to.deep.equal(this.objects[itemIndex1]);
    });

    it('Creates a few documents and search for some of them', () => {
        const [itemIndex1, itemIndex2] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].find({
            $or: [
                { uuid: this.objects[itemIndex1].uuid },
                { uuid: this.objects[itemIndex2].uuid }
            ]
        });
    });

    it('Creates a few documents and search using not', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].find(
            {
                uuid: { 
                    $not: {
                        $eq: this.objects[itemIndex1].uuid 
                    }
                }
            }
        );

        expect(docs.length).to.be.equal(this.objects.length - 1);
    });

    it('Creates a few documents and search using not with more than one expression', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].find(
            {
                age: { 
                    $not: {
                        $eq: this.objects[itemIndex1].age,
                        $gt: 18
                    }
                }
            }
        );

        expect(docs.length).to.be.equal(this.objects.length - 1);
    });

    it('Creates a few documents and search it using nor, both fields existing', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].findOne({
            $nor: [
                {name: this.objects[itemIndex1].name},
                {age: this.objects[itemIndex1].age}
            ]
        });

        expect(docs.name).to.not.be.equal(this.objects[itemIndex1].name);
        expect(docs.age).to.not.be.equal(this.objects[itemIndex1].age);
    });

    it('Creates a few documents and search it using nor, first field missing', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].findOne({
            $nor: [
                {city: 'Ribeirão Preto'},
                {age: this.objects[itemIndex1].age}
            ]
        });

        expect(docs.age).to.not.be.equal(this.objects[itemIndex1].age);
    });

    it('Creates a few documents and search it using nor, secound field missing', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].findOne({
            $nor: [
                {name: this.objects[itemIndex1].name},
                {instrument: 'Drums'}
            ]
        });

        expect(docs.name).to.not.be.equal(this.objects[itemIndex1].name);
    });

    it('Creates a few documents and search it using nor, all fields missing', () => {
        const [itemIndex1,] = searchItem(this.objects);
        const docs = this.srla.db[this.collectionName].find({
            $nor: [
                {city: 'Ribeirão Preto'},
                {instrument: 'Drums'}
            ]
        });

        expect(docs.length).to.be.equal(this.objects.length);
    });

    /*it('Creates a few documents and search using or', () => {
        const [itemIndex1, itemIndex2] = searchItem(this.objects);
    });

    it('Creates a few documents and search using lt', () => {
        const [itemIndex1,] = searchItem(this.objects);
    });

    it('Creates a few documents and search using gt', () => {
        const [itemIndex1,] = searchItem(this.objects);
    });*/
});
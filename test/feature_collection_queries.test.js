const chai = require('chai')
const expect = chai.expect
const faker = require('faker')
const sorla = require('../src/sorla.js')

const searchItem = (array) => {
    const itemIndex1 = Math.floor(Math.random() * this.objects.length);
    do {
        const itemIndex2 = Math.floor(Math.random() * this.objects.length);
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
                age: faker.random.number()
            };
            this.objects.push(obj);
            this.srla.db[this.collectionName].insertOne(obj);
        }
    });

    it('Creates a few documents and search for one of them', () => {
        const [itemIndex1,] = searchItem(this.objects);
    });

    it('Creates a few documents and search for some of them', () => {
        const [itemIndex1, itemIndex2] = searchItem(this.objects);
    });

    it('Creates a few documents and search using or', () => {
        const [itemIndex1, itemIndex2] = searchItem(this.objects);
    });

    it('Creates a few documents and search using lt', () => {
        const [itemIndex1,] = searchItem(this.objects);
    });

    it('Creates a few documents and search using gt', () => {
        const [itemIndex1,] = searchItem(this.objects);
    });
});
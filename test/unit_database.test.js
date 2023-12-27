const chai = require('chai')
const expect = chai.expect
const faker = require('faker')

const sorla = require('../src/sorla.js')

describe('SORLA Database Unit Text', () => {
    it('Should create a new database with random name', () => {
        const srla = new sorla();
        const dbname = faker.random.word();
        srla.createDb(dbname);
        srla.useDb(dbname);

        expect(srla.countDb()).to.equal(1);
        expect(srla.dbExists(dbname)).to.equal(true);
        expect(srla.db.name).to.equal(dbname);
    });

    it('Should not create a new database with the same name', () => {
        const srla = new sorla();
        const dbname = faker.random.word();
        srla.createDb(dbname);

        expect(srla.createDb(dbname)).to.equal(false);
    });

    it('Should created more than one database', () => {
        const srla = new sorla();
        for(let i=0; i<2; i++)
        {
            const dbname = faker.random.word();
            srla.createDb(dbname);
        }

        expect(srla.countDb()).to.equal(2);
    });

    it('Should not have any database created', () => {
        const srla = new sorla();
        expect(srla.countDb()).to.equal(0);
    });
});
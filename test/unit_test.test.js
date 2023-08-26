const chai = require('chai');
const expect = chai.expect;

const sorla = require('../src/sorla.js');

describe('Sorla Class', () => {
    it('should create a new database', () => {
        const srla = new sorla();
        srla.createDb('test');
        expect(srla.countDb()).to.equal(1);
    });

    it('should not create a new database with the same name', () => {
        const srla = new sorla();
        srla.createDb('test');
        expect(srla.createDb('test')).to.equal(false);
    });

    it('should created a new database and select it', () => {
        const srla = new sorla();
        const dbname = 'test';
        srla.useDb(dbname);
        expect(srla.db.name).to.equal(dbname);
    });
});
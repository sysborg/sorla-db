const chai = require('chai');
const expect = chai.expect;

const sorla = require('../src/sorla.js');

describe('Sorla Class', () => {
    it('should create a new database', () => {
        const srla = new sorla();
        srla.createDb('test');
        expect(srla.countDb()).to.equal(1);
    });
});
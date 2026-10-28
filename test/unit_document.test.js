const chai = require('chai');
const expect = chai.expect;
const faker = require('faker');
const documents = require('../src/documents/document.js');

describe('testing document capabilities', () => {
    it('checking capabilities of getting a field inside a object', () => {
        const doc = new documents({
            name: 'Anderson',
            test: {
                inscription: 123
            }
        });
        
        expect(doc.name).to.equal('Anderson');
    });

    it('checking capabilities of getting a field inside a object', () => {
        const doc = new documents({
            name: 'Anderson',
            test: {
                inscription: 123
            }
        });
        
        expect(doc.test.inscription).to.equal(123);
    });

    it('checking capabilities of getting a field inside a object', () => {
        const doc = new documents({
            name: 'Anderson',
            test: {
                inscription: 123
            }
        });
        
        expect(doc['test.inscription']).to.equal(123);
    });
});
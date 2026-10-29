const chai = require('chai')
const expect = chai.expect
const { execFileSync } = require('child_process')
const path = require('path')
const sorla = require('../src/sorla.js')

describe('SORLA documents', () => {
    let srla;

    beforeAll(() => {
        srla = new sorla();
        srla.useDb('documents');
        srla.db.createCollection('c');
        srla.db.c.insertOne({ name: 'Ana', address: { city: 'A', zip: null }, tags: ['x', 'y'] });
    });

    it('loads without circular require warnings', () => {
        const output = execFileSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(__dirname, '../src/sorla.js'))})`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        expect(output).to.equal('');
    });

    it('reads nested paths and returns undefined for missing ones', () => {
        const doc = srla.db.c.all[0];
        expect(doc['address.city']).to.equal('A');
        expect(doc['address.zip']).to.equal(null);
        expect(doc['tags.1']).to.equal('y');
        expect(doc['address.street']).to.equal(undefined);
        expect(doc['nothing.here']).to.equal(undefined);
        expect(doc['address.zip.code']).to.equal(undefined);
    });

    it('queries on missing nested paths do not match the parent object', () => {
        expect(srla.db.c.find({ 'address.street': { $ne: 'x' } }).length).to.equal(1);
        expect(srla.db.c.find({ 'address.street': { $in: [undefined] } }).length).to.equal(1);
        expect(srla.db.c.find({ 'address.city': 'A' }).length).to.equal(1);
    });

    it('stored documents are read-only with a clear error', () => {
        const doc = srla.db.c.all[0];
        expect(() => { doc.name = 'changed'; }).to.throw('read-only');
        expect(srla.db.c.findOne({}).name).to.equal('Ana');
    });

    it('works with symbols: String(), template literals and spreading', () => {
        const doc = srla.db.c.all[0];
        expect(String(doc)).to.equal('[object Object]');
        expect(`${doc}`).to.equal('[object Object]');
        expect(() => ({ ...doc })).to.not.throw();
    });

    it('projection does not print to the console', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        srla.db.c.find({}, { tags: 0 });
        expect(log.mock.calls.length).to.equal(0);
        log.mockRestore();
    });
});

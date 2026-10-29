const chai = require('chai')
const expect = chai.expect
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '..')
const node = code => execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' }).trim()

describe('SORLA package', () => {
    it('require("sorla-db") returns the class in Node', () => {
        const sorla = require('..');
        const srla = new sorla();
        srla.useDb('package');
        expect(srla.db.name).to.equal('package');
    });

    it('import sorla from "sorla-db" works as an ES module', () => {
        expect(node("import sorla, { sorla as named } from 'sorla-db'; console.log(typeof sorla, sorla === named)")).to.equal('function true');
    });

    it('the browser bundle registers window.sorla and does not include dev dependencies', () => {
        const bundle = fs.readFileSync(path.join(root, 'dist/sorla.min.js'), 'utf8');
        expect(bundle).to.not.include('faker');
        expect(bundle.length).to.be.below(50 * 1024);
        const window = {};
        new Function('window', bundle)(window);
        expect(window.sorla).to.be.a('function');
        // a stale dist (a build that failed silently) would miss the newest API
        const srla = new window.sorla();
        srla.useDb('bundle');
        srla.db.createCollection('c', { required: ['a'] });
        for(const method of ['bindForm', 'validate', 'updateOne', 'deleteMany', 'on', 'applyDefaults'])
            expect(srla.db.c[method], method).to.be.a('function');
        expect(window.sorla.ValidationError).to.be.a('function');
        expect(srla.db.getStats).to.be.a('function');
    });

    it('ships type declarations and only the library files', () => {
        const pkg = require('../package.json');
        expect(fs.existsSync(path.join(root, pkg.types))).to.equal(true);
        expect(pkg.files).to.include('!src/helper.js');
        expect(pkg).to.not.have.property('browser');
    });
});

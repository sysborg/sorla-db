const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')
const { clone, fallbackClone } = require('../src/clone.js')

describe('SORLA copies without structuredClone', () => {
    it('the fallback copies plain values, Dates, RegExps, Maps, Sets and cycles', () => {
        const date = new Date('2026-01-01');
        const source = { a: 1, s: 'x', n: null, list: [1, { b: 2 }], date, re: /x/gi, map: new Map([['k', { v: 1 }]]), set: new Set([1, 2]) };
        source.self = source;
        const copy = fallbackClone(source);
        expect(copy).to.not.equal(source);
        expect(copy.list[1]).to.deep.equal({ b: 2 });
        expect(copy.list[1]).to.not.equal(source.list[1]);
        expect(copy.date.getTime()).to.equal(date.getTime());
        expect(copy.date).to.not.equal(date);
        expect(copy.re.flags).to.equal('gi');
        expect(copy.map.get('k')).to.deep.equal({ v: 1 });
        expect([...copy.set]).to.deep.equal([1, 2]);
        expect(copy.self).to.equal(copy);
    });

    it('the fallback rejects what structuredClone rejects', () => {
        expect(() => fallbackClone({ fn: () => 1 })).to.throw().with.property('name', 'DataCloneError');
        expect(() => fallbackClone({ s: Symbol('x') })).to.throw().with.property('name', 'DataCloneError');
    });

    it('the database works when structuredClone does not exist (older browsers, jsdom pages)', () => {
        const original = global.structuredClone;
        delete global.structuredClone;
        try {
            const srla = new sorla();
            srla.useDb('noClone');
            srla.db.createCollection('c', { properties: { tags: { default: [] } } });
            const id = srla.db.c.insertOne({ name: 'Ana', when: new Date('2026-01-01') });
            srla.db.c.updateOne({ _id: id }, { $push: { tags: 'x' } });
            const doc = srla.db.c.findOne({ _id: id });
            expect(doc.tags).to.deep.equal(['x']);
            expect(doc.when.getTime()).to.equal(new Date('2026-01-01').getTime());
            expect(srla.db.c.find({}).toArray().length).to.equal(1);
            expect(() => srla.db.c.insertOne({ fn: () => 1 })).to.throw('cloneable values');
        } finally {
            global.structuredClone = original;
        }
        expect(clone({ a: 1 })).to.deep.equal({ a: 1 });
    });

    it('collection.first and last are null when the collection is empty', () => {
        const srla = new sorla();
        srla.useDb('empty');
        srla.db.createCollection('c');
        expect(srla.db.c.first).to.equal(null);
        expect(srla.db.c.last).to.equal(null);
    });
});

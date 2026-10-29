const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

let counter = 0;
function people() {
    const srla = new sorla();
    srla.useDb(`writes${++counter}`);
    srla.db.createCollection('people');
    srla.db.people.insertMany([
        { _id: 'a', name: 'Ana', age: 25, tags: ['dev'], address: { city: 'A' } },
        { _id: 'b', name: 'Bruno', age: 31, tags: [] },
        { _id: 'c', name: 'Carla', age: 42, tags: ['dev', 'ops'], score: 10 }
    ]);
    return srla.db.people;
}
const get = (collection, id) => collection.findOne({ _id: id });

describe('SORLA updateOne / updateMany', () => {
    it('$set changes fields, creates nested paths and keeps the rest', () => {
        const c = people();
        const result = c.updateOne({ name: 'Ana' }, { $set: { age: 26, 'address.zip': '14000', 'meta.source': 'form' } });
        expect(result).to.deep.equal({ matchedCount: 1, modifiedCount: 1, upsertedId: null });
        expect(get(c, 'a')).to.deep.equal({ _id: 'a', name: 'Ana', age: 26, tags: ['dev'], address: { city: 'A', zip: '14000' }, meta: { source: 'form' } });
    });

    it('updateOne changes only the first match, updateMany all of them', () => {
        const c = people();
        expect(c.updateOne({ tags: { $in: ['dev'] } }, { $set: { team: 1 } }).modifiedCount).to.equal(1);
        expect(c.count({ team: 1 })).to.equal(1);
        expect(c.updateMany({ tags: { $in: ['dev'] } }, { $set: { team: 2 } })).to.deep.equal({ matchedCount: 2, modifiedCount: 2, upsertedId: null });
        expect(c.count({ team: 2 })).to.equal(2);
    });

    it('$unset, $inc, $push (with $each) and $pull', () => {
        const c = people();
        c.updateOne({ _id: 'c' }, { $unset: { score: '' }, $inc: { age: 1, visits: 2 }, $push: { tags: 'qa' } });
        expect(get(c, 'c')).to.include({ age: 43, visits: 2 });
        expect(get(c, 'c')).to.not.have.property('score');
        expect(get(c, 'c').tags).to.deep.equal(['dev', 'ops', 'qa']);
        c.updateOne({ _id: 'c' }, { $push: { tags: { $each: ['x', 'y'] } } });
        c.updateOne({ _id: 'c' }, { $pull: { tags: { $in: ['ops', 'x'] } } });
        expect(get(c, 'c').tags).to.deep.equal(['dev', 'qa', 'y']);
        c.updateOne({ _id: 'b' }, { $push: { log: { at: 1, ok: true } } });
        c.updateOne({ _id: 'b' }, { $push: { log: { at: 2, ok: false } } });
        c.updateOne({ _id: 'b' }, { $pull: { log: { ok: false } } });
        expect(get(c, 'b').log).to.deep.equal([{ at: 1, ok: true }]);
    });

    it('counts matched but unchanged documents as not modified', () => {
        const c = people();
        expect(c.updateOne({ _id: 'a' }, { $set: { age: 25 } })).to.deep.equal({ matchedCount: 1, modifiedCount: 0, upsertedId: null });
        expect(c.updateMany({ age: { $gt: 100 } }, { $set: { x: 1 } })).to.deep.equal({ matchedCount: 0, modifiedCount: 0, upsertedId: null });
    });

    it('a failing operator leaves every document untouched', () => {
        const c = people();
        expect(() => c.updateMany({}, { $inc: { name: 1 } })).to.throw('it is not a number');
        expect(() => c.updateOne({ _id: 'a' }, { $set: { age: 99, 'name.first': 'x' } })).to.throw('"name" is not an object');
        expect(get(c, 'a').age).to.equal(25);
        expect(c.findOne({ name: 'Ana' }).name).to.equal('Ana');
    });

    it('upsert inserts from the filter equality fields when nothing matches', () => {
        const c = people();
        const result = c.updateOne({ email: 'new@mail.com', age: { $gt: 1 } }, { $set: { name: 'New' }, $inc: { visits: 1 } }, { upsert: true });
        expect(result.matchedCount).to.equal(0);
        expect(result.upsertedId).to.be.a('string');
        expect(get(c, result.upsertedId)).to.deep.include({ email: 'new@mail.com', name: 'New', visits: 1 });
        expect(c.updateOne({ email: 'new@mail.com' }, { $inc: { visits: 1 } }, { upsert: true }).upsertedId).to.equal(null);
        expect(c.findOne({ email: 'new@mail.com' }).visits).to.equal(2);
    });

    it('rejects invalid updates', () => {
        const c = people();
        expect(() => c.updateOne({ _id: 'a' }, { name: 'x' })).to.throw('use replaceOne()');
        expect(() => c.updateOne({ _id: 'a' }, { $rename: { a: 'b' } })).to.throw('Unknown update operator $rename');
        expect(() => c.updateOne({ _id: 'a' }, {})).to.throw('at least one operator');
        expect(() => c.updateOne({ _id: 'a' }, { $set: { _id: 'z' } })).to.throw('_id field cannot be updated');
        expect(() => c.updateOne({ _id: 'a' }, { $set: { 'bad..path': 1 } })).to.throw('Invalid field path');
        expect(() => c.updateOne({ _id: 'a' }, { $set: { nested: { 'a.b': 1 } } })).to.throw('Invalid document keys');
        expect(() => c.updateOne(null, { $set: { a: 1 } })).to.throw('filter must be a query object');
        expect(() => c.updateOne({ _id: 'a' }, { $inc: { age: 'x' } })).to.throw('$inc needs a number');
    });

    it('updated values are copies', () => {
        const c = people();
        const value = { deep: [1] };
        c.updateOne({ _id: 'a' }, { $set: { value } });
        value.deep.push(2);
        expect(get(c, 'a').value.deep).to.deep.equal([1]);
    });
});

describe('SORLA replaceOne', () => {
    it('replaces the document and keeps its _id', () => {
        const c = people();
        expect(c.replaceOne({ name: 'Bruno' }, { name: 'Bruno R.', age: 32 })).to.deep.equal({ matchedCount: 1, modifiedCount: 1, upsertedId: null });
        expect(get(c, 'b')).to.deep.equal({ name: 'Bruno R.', age: 32, _id: 'b' });
    });

    it('validates the replacement', () => {
        const c = people();
        expect(() => c.replaceOne({ _id: 'b' }, { $set: { a: 1 } })).to.throw('cannot contain update operators');
        expect(() => c.replaceOne({ _id: 'b' }, { _id: 'other' })).to.throw('_id field cannot be changed');
        expect(() => c.replaceOne({ _id: 'b' }, { 'a.b': 1 })).to.throw('Invalid document keys');
        expect(c.replaceOne({ _id: 'zzz' }, { a: 1 }).matchedCount).to.equal(0);
        expect(c.replaceOne({ _id: 'zzz' }, { a: 1 }, { upsert: true }).upsertedId).to.be.a('string');
    });
});

describe('SORLA deleteOne / deleteMany / count', () => {
    it('deleteOne removes the first match, deleteMany all of them', () => {
        const c = people();
        expect(c.deleteOne({ tags: { $in: ['dev'] } })).to.deep.equal({ deletedCount: 1 });
        expect(c.count()).to.equal(2);
        expect(get(c, 'a')).to.equal(null);
        expect(c.deleteMany({ age: { $gt: 30 } })).to.deep.equal({ deletedCount: 2 });
        expect(c.count()).to.equal(0);
        expect(c.deleteMany({})).to.deep.equal({ deletedCount: 0 });
    });

    it('a deleted _id can be inserted again', () => {
        const c = people();
        c.deleteOne({ _id: 'a' });
        expect(() => c.insertOne({ _id: 'a', name: 'Ana again' })).to.not.throw();
        expect(() => c.insertOne({ _id: 'b' })).to.throw('Duplicate');
    });

    it('count(query) counts matches', () => {
        const c = people();
        expect(c.count()).to.equal(3);
        expect(c.count({ age: { $gte: 30 } })).to.equal(2);
        expect(c.count({ name: { $regex: '^c', $options: 'i' } })).to.equal(1);
    });

    it('requires a filter', () => {
        const c = people();
        expect(() => c.deleteMany()).to.throw('use {} to match every document');
    });
});

describe('SORLA change events', () => {
    it('emits insert, update, replace and delete, plus change for all of them', () => {
        const c = people();
        const events = [];
        const all = [];
        for(const type of ['insert', 'update', 'replace', 'delete'])
            c.on(type, event => events.push([event.type, event.ids]));
        c.on('change', event => all.push(event.type));

        c.insertMany([{ _id: 'x' }, { _id: 'y' }]);
        c.updateMany({ _id: { $in: ['x', 'y'] } }, { $set: { n: 1 } });
        c.updateOne({ _id: 'x' }, { $set: { n: 1 } });
        c.replaceOne({ _id: 'y' }, { n: 2 });
        c.deleteMany({ _id: { $in: ['x', 'y'] } });

        expect(events).to.deep.equal([['insert', ['x', 'y']], ['update', ['x', 'y']], ['replace', ['y']], ['delete', ['x', 'y']]]);
        expect(all).to.deep.equal(['insert', 'update', 'replace', 'delete'], 'no event when nothing was modified');
    });

    it('payloads carry copies of the documents before and after', () => {
        const c = people();
        let event = null;
        c.on('update', e => { event = e; });
        c.updateOne({ _id: 'a' }, { $inc: { age: 1 } });
        expect(event.previous[0].age).to.equal(25);
        expect(event.documents[0].age).to.equal(26);
        event.documents[0].age = 0;
        expect(get(c, 'a').age).to.equal(26);
    });

    it('off and once unsubscribe; a failing listener does not break the write', async () => {
        const c = people();
        let calls = 0;
        const off = c.on('insert', () => calls++);
        c.once('insert', () => calls++);
        c.insertOne({ n: 1 });
        c.insertOne({ n: 2 });
        off();
        c.insertOne({ n: 3 });
        expect(calls).to.equal(3);

        const errors = [];
        const original = global.setTimeout;
        global.setTimeout = fn => { try { fn(); } catch(error) { errors.push(error.message); } };
        c.on('delete', () => { throw new Error('listener failed'); });
        expect(c.deleteOne({ n: 1 }).deletedCount).to.equal(1);
        global.setTimeout = original;
        expect(errors).to.deep.equal(['listener failed']);
        expect(() => c.on('insert', 'not a function')).to.throw('must be a function');
    });
});

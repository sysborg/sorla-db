const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

describe('SORLA bulkWrite and the _id index', () => {
    let c;
    let events;

    beforeEach(() => {
        const srla = new sorla();
        srla.useDb(`bulk${Math.random()}`);
        srla.db.createCollection('c', { type: 'object', properties: { qty: { type: 'number' } } });
        c = srla.db.c;
        c.insertMany([{ _id: 'a', qty: 1 }, { _id: 'b', qty: 2 }, { _id: 'c', qty: 3 }]);
        events = [];
        c.on('change', event => events.push({ type: event.type, ids: event.ids }));
    });

    const state = () => c.find({}).toArray().map(doc => `${doc._id}:${doc.qty}`);

    it('runs every kind of operation and reports the counts like MongoDB', () => {
        const result = c.bulkWrite([
            { insertOne: { document: { _id: 'd', qty: 4 } } },
            { updateOne: { filter: { _id: 'a' }, update: { $inc: { qty: 10 } } } },
            { updateMany: { filter: { qty: { $gt: 2 } }, update: { $set: { big: true } } } },
            { replaceOne: { filter: { _id: 'b' }, replacement: { qty: 20 } } },
            { updateOne: { filter: { _id: 'z' }, update: { $set: { qty: 0 } }, upsert: true } },
            { deleteOne: { filter: { _id: 'c' } } },
            { deleteMany: { filter: { qty: 0 } } }
        ]);
        expect(result).to.deep.equal({
            insertedCount: 1, matchedCount: 5, modifiedCount: 5, deletedCount: 2, upsertedCount: 1,
            insertedIds: { 0: 'd' }, upsertedIds: { 4: result.upsertedIds[4] }
        });
        expect(state()).to.deep.equal(['a:11', 'b:20', 'd:4']);
    });

    it('emits one event per type at the end, with every document of that type', () => {
        c.bulkWrite([
            { updateOne: { filter: { _id: 'a' }, update: { $set: { qty: 5 } } } },
            { updateOne: { filter: { _id: 'b' }, update: { $set: { qty: 6 } } } },
            { insertOne: { document: { _id: 'e', qty: 7 } } },
            { updateOne: { filter: { _id: 'c' }, update: { $set: { qty: 8 } } } }
        ]);
        expect(events).to.deep.equal([
            { type: 'update', ids: ['a', 'b', 'c'] },
            { type: 'insert', ids: ['e'] }
        ]);
    });

    it('ordered stops at the first error, keeps what ran, and throws a BulkWriteError', () => {
        let error;
        try {
            c.bulkWrite([
                { updateOne: { filter: { _id: 'a' }, update: { $set: { qty: 9 } } } },
                { updateOne: { filter: { _id: 'b' }, update: { $set: { qty: 'x' } } } },
                { updateOne: { filter: { _id: 'c' }, update: { $set: { qty: 9 } } } }
            ]);
        } catch(e) {
            error = e;
        }
        expect(error.name).to.equal('BulkWriteError');
        expect(error.writeErrors.map(e => e.index)).to.deep.equal([1]);
        expect(error.result.modifiedCount).to.equal(1);
        expect(state()).to.deep.equal(['a:9', 'b:2', 'c:3']);
        expect(events).to.deep.equal([{ type: 'update', ids: ['a'] }], 'events of the applied operations');
    });

    it('ordered: false runs the others and lists every failure', () => {
        expect(() => c.bulkWrite([
            { insertOne: { document: { _id: 'a' } } },
            { updateOne: { filter: { _id: 'b' }, update: { $set: { qty: 9 } } } },
            { nope: {} }
        ], { ordered: false })).to.throw('2 operation(s) failed').with.property('writeErrors').with.length(2);
        expect(state()).to.deep.equal(['a:1', 'b:9', 'c:3']);
        expect(() => c.bulkWrite('x')).to.throw('array');
    });

    it('filters on _id use the index and still check the other conditions', () => {
        expect(c.find({ _id: 'b' }).ids()).to.deep.equal(['b']);
        expect(c.find({ _id: { $in: ['c', 'a', 'zz'] } }).ids()).to.deep.equal(['a', 'c'], 'collection order');
        expect(c.find({ _id: 'b', qty: 99 }).length).to.equal(0);
        expect(c.find({ _id: { $in: [/^[ab]$/] } }).ids()).to.deep.equal(['a', 'b'], 'regular expressions scan');
        expect(c.count({ _id: { $eq: 'c' } })).to.equal(1);
        c.deleteOne({ _id: 'a' });
        expect(c.find({ _id: 'c' }).first().qty).to.equal(3, 'positions move after a delete');
        c.updateOne({ _id: 'c' }, { $set: { qty: 30 } });
        expect(c.findOne({ _id: 'c' }).qty).to.equal(30);
        expect(() => c.insertOne({ _id: 'b' })).to.throw('Duplicate');
    });

    it('updates 50 000 documents by _id in linear time', () => {
        const srla = new sorla();
        srla.useDb(`bulkPerf${Math.random()}`);
        srla.db.createCollection('big');
        const big = srla.db.big;
        big.insertMany(Array.from({ length: 50000 }, (_, i) => ({ _id: `r${i}`, n: i })));
        const started = Date.now();
        const result = big.bulkWrite(Array.from({ length: 50000 }, (_, i) => ({ updateOne: { filter: { _id: `r${i}` }, update: { $set: { n: i * 2 + 1 } } } })));
        expect(result.modifiedCount).to.equal(50000);
        expect(Date.now() - started).to.be.below(5000);
        expect(big.findOne({ _id: 'r49999' }).n).to.equal(99999);
    });
});

describe('SORLA cursors copy only what is read', () => {
    let c;

    beforeAll(() => {
        const srla = new sorla();
        srla.useDb('lazyCursor');
        srla.db.createCollection('c');
        c = srla.db.c;
        c.insertMany(Array.from({ length: 10 }, (_, i) => ({ _id: `d${i}`, n: i, tags: ['x'] })));
    });

    it('ids(), length, sort, skip and limit work on references', () => {
        const cursor = c.find({ n: { $gte: 5 } }).sort({ n: -1 }).skip(1).limit(2);
        expect(cursor.ids()).to.deep.equal(['d8', 'd7']);
        expect(cursor.length).to.equal(2);
        expect(cursor._data[0]._data).to.equal(c.all.find(doc => doc._data._id === 'd8')._data, 'no copy was made');
    });

    it('what is handed out is a copy', () => {
        const [first] = c.find({ _id: 'd1' }).toArray();
        first.tags.push('changed');
        expect(c.findOne({ _id: 'd1' }).tags).to.deep.equal(['x']);
        const doc = c.find({ _id: 'd1' }).next();
        doc._data.n = 99;
        expect(c.findOne({ _id: 'd1' }).n).to.equal(1);
    });

    it('iterates and forEach with copies, projection applied when read', () => {
        const names = [];
        for(const doc of c.find({ n: { $lt: 2 } }, { n: 1, _id: 0 })) names.push(doc);
        expect(names).to.deep.equal([{ n: 0 }, { n: 1 }]);
        const seen = [];
        c.find({ n: 3 }, { tags: 0 }).forEach((doc, index) => seen.push([index, doc]));
        expect(seen).to.deep.equal([[0, { _id: 'd3', n: 3 }]]);
        expect(c.findOne({ n: 3 }).tags).to.deep.equal(['x'], 'the stored document keeps every field');
    });

    it('a cursor is a snapshot: later updates and deletes do not change it', () => {
        const cursor = c.find({ n: { $lt: 3 } });
        c.updateOne({ _id: 'd0' }, { $set: { n: 100 } });
        c.deleteOne({ _id: 'd1' });
        expect(cursor.toArray().map(doc => doc.n)).to.deep.equal([0, 1, 2]);
        expect(c.find({ n: { $lt: 3 } }).ids()).to.deep.equal(['d2']);
    });
});

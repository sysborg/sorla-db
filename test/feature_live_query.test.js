const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SORLA live queries (collection.watch)', () => {
    let tasks;

    beforeEach(() => {
        const srla = new sorla();
        srla.useDb(`live${Math.random()}`);
        srla.db.createCollection('tasks');
        tasks = srla.db.tasks;
        tasks.insertMany([
            { _id: 't1', title: 'Write', done: false, due: 3 },
            { _id: 't2', title: 'Test', done: true, due: 1 },
            { _id: 't3', title: 'Ship', done: false, due: null }
        ]);
    });

    const titles = list => list.map(doc => doc.title);

    it('calls the listener at once, then once per batch of writes', async () => {
        const live = tasks.watch({ done: false }, { sort: { due: 1 } });
        const calls = [];
        const off = live.subscribe(list => calls.push(titles(list)));
        expect(calls).to.deep.equal([['Write', 'Ship']], 'blanks last, like sort()');

        tasks.insertOne({ _id: 't4', title: 'Plan', done: false, due: 2 });
        tasks.updateOne({ _id: 't2' }, { $set: { done: false } });
        tasks.updateOne({ _id: 't1' }, { $set: { done: true } });
        expect(calls.length).to.equal(1, 'merged into one notification');
        await tick();
        expect(calls).to.deep.equal([['Write', 'Ship'], ['Test', 'Plan', 'Ship']]);

        tasks.deleteOne({ _id: 't3' });
        tasks.updateOne({ _id: 't1' }, { $set: { note: 'x' } });
        await tick();
        expect(calls.at(-1)).to.deep.equal(['Test', 'Plan']);
        expect(calls.length).to.equal(3, 'a change outside the query does not notify');
        off();
        tasks.insertOne({ title: 'Later', done: false });
        await tick();
        expect(calls.length).to.equal(3);
    });

    it('getSnapshot is stable until something changes; unchanged documents keep their object', async () => {
        const live = tasks.watch({});
        live.subscribe(() => {});
        const first = live.getSnapshot();
        expect(live.getSnapshot()).to.equal(first);
        expect(Object.isFrozen(first) && Object.isFrozen(first[0])).to.equal(true);
        tasks.updateOne({ _id: 't2' }, { $set: { title: 'Test again' } });
        await tick();
        const second = live.getSnapshot();
        expect(second).to.not.equal(first);
        expect(second[0]).to.equal(first[0], 'same object for t1');
        expect(second[1]).to.not.equal(first[1]);
        expect(titles(second)).to.deep.equal(['Write', 'Test again', 'Ship'], 'collection order');
        expect(() => { 'use strict'; second[0].title = 'x'; }).to.throw();
        expect(tasks.findOne({ _id: 't1' }).title).to.equal('Write');
    });

    it('without subscribers it watches nothing, and getSnapshot still follows the collection', () => {
        const live = tasks.watch({ done: true });
        expect(tasks._listeners.get('change')?.size ?? 0).to.equal(0);
        const before = live.getSnapshot();
        expect(live.getSnapshot()).to.equal(before);
        tasks.updateOne({ _id: 't1' }, { $set: { done: true } });
        expect(titles(live.getSnapshot())).to.deep.equal(['Write', 'Test']);
        const off = live.subscribe(() => {});
        expect(tasks._listeners.get('change').size).to.equal(1);
        off();
        expect(tasks._listeners.get('change').size).to.equal(0);
        expect(live.length).to.equal(2);
    });

    it('skip, limit and projection; sorting works on fields the projection hides', async () => {
        const live = tasks.watch({}, { sort: { due: -1 }, limit: 2, projection: { title: 1, _id: 0 } });
        const calls = [];
        live.subscribe(list => calls.push(list));
        expect(calls[0]).to.deep.equal([{ title: 'Write' }, { title: 'Test' }]);
        tasks.insertOne({ title: 'Top', due: 9 });
        await tick();
        expect(calls[1]).to.deep.equal([{ title: 'Top' }, { title: 'Write' }]);
    });

    it('is a Svelte store and an Observable (observers with next, RxJS interop)', async () => {
        const live = tasks.watch({ done: true });
        const seen = [];
        const subscription = live.subscribe({ next: list => seen.push(list.length) });
        expect(typeof subscription).to.equal('function');
        expect(typeof subscription.unsubscribe).to.equal('function');
        expect(live['@@observable']()).to.equal(live);
        tasks.updateMany({}, { $set: { done: true } });
        await tick();
        expect(seen).to.deep.equal([1, 3]);
        subscription.unsubscribe();
        expect(() => live.subscribe(42)).to.throw('function or an observer');
        expect(() => tasks.watch(null)).to.throw('must be an object');
    });

    it('follows bulkWrite and SSE style row blocks', async () => {
        const live = tasks.watch({ done: false });
        const counts = [];
        live.subscribe(list => counts.push(list.length));
        tasks.bulkWrite([
            { insertOne: { document: { title: 'A', done: false } } },
            { deleteOne: { filter: { _id: 't1' } } },
            { updateOne: { filter: { _id: 't2' }, update: { $set: { done: false } } } }
        ]);
        await tick();
        expect(counts).to.deep.equal([2, 3]);
        live.close();
        expect(tasks._listeners.get('change').size).to.equal(0);
    });

    it('stays fast: 20 000 documents, 1 000 updates, one rebuild of the snapshot', async () => {
        const srla = new sorla();
        srla.useDb(`livePerf${Math.random()}`);
        srla.db.createCollection('c');
        const c = srla.db.c;
        c.insertMany(Array.from({ length: 20000 }, (_, i) => ({ _id: i, n: i })));
        const live = c.watch({ n: { $gte: 0 } }, { sort: { n: -1 } });
        let calls = 0;
        live.subscribe(() => calls++);
        const started = Date.now();
        for(let i = 0; i < 1000; i++) c.updateOne({ _id: i }, { $set: { n: i + 0.5 } });
        await tick();
        expect(calls).to.equal(2);
        expect(Date.now() - started).to.be.below(3000);
        expect(live.getSnapshot()[19999].n).to.equal(0.5);
    });
});

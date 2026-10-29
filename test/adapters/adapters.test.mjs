// Framework bindings against the real libraries: node --test test/adapters/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const sorla = require('../../src/sorla.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function collection() {
    const srla = new sorla();
    srla.useDb(`adapters${Math.random()}`);
    srla.db.createCollection('tasks');
    srla.db.tasks.insertMany([
        { _id: 't1', title: 'Write', done: false, due: 2 },
        { _id: 't2', title: 'Test', done: true, due: 1 },
        { _id: 't3', title: 'Ship', done: false, due: 3 }
    ]);
    return srla.db.tasks;
}

test('React: useQuery re-renders on changes, keeps the query across renders, useDocument', async () => {
    const dom = new JSDOM('<div id="root"></div>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { useQuery, useDocument } = await import('../../adapters/react.mjs');

    const tasks = collection();
    let renders = 0;
    let rerender;
    function List() {
        const [, setCount] = React.useState(0);
        rerender = () => setCount(n => n + 1);
        renders++;
        // a new object on every render: compared by value
        const open = useQuery(tasks, { done: false }, { sort: { due: 1 } });
        const second = useDocument(tasks, 't2');
        return React.createElement('p', null, `${open.map(t => t.title).join(',')}|${second?.title ?? '-'}`);
    }
    const root = createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(List)));
    assert.equal(document.getElementById('root').textContent, 'Write,Ship|Test');

    await React.act(async () => {
        tasks.updateOne({ _id: 't2' }, { $set: { done: false, title: 'Test!' } });
        await tick();
    });
    assert.equal(document.getElementById('root').textContent, 'Test!,Write,Ship|Test!');

    const listeners = () => tasks._listeners.get('change').size;
    const before = listeners();
    await React.act(async () => rerender());
    assert.equal(listeners(), before, 'rerendering with an equal query does not add subscriptions');
    await React.act(async () => root.unmount());
    assert.equal(listeners(), 0, 'unmounting stops watching');
    assert.ok(renders >= 3);
});

test('Vue: useQuery is a ref, follows changes and reactive queries, stops with its scope', async () => {
    const { effectScope, ref, nextTick } = await import('vue');
    const { useQuery } = await import('../../adapters/vue.mjs');
    const tasks = collection();
    const done = ref(false);
    const scope = effectScope();
    const list = scope.run(() => useQuery(tasks, () => ({ done: done.value }), { sort: { due: 1 } }));
    assert.deepEqual(list.value.map(t => t.title), ['Write', 'Ship']);

    tasks.insertOne({ title: 'Plan', done: false, due: 0 });
    await tick();
    assert.deepEqual(list.value.map(t => t.title), ['Plan', 'Write', 'Ship']);

    done.value = true;
    await nextTick();
    assert.deepEqual(list.value.map(t => t.title), ['Test']);
    assert.equal(tasks._listeners.get('change').size, 1, 'the old query stopped');

    scope.stop();
    assert.equal(tasks._listeners.get('change').size, 0);
});

test('Svelte: query() is a store ($store), documentStore follows one document', async () => {
    const { get } = await import('svelte/store');
    const { query, documentStore } = await import('../../adapters/svelte.mjs');
    const tasks = collection();
    const open = query(tasks, { done: false });
    assert.deepEqual(get(open).map(t => t.title), ['Write', 'Ship']);
    const seen = [];
    const off = documentStore(tasks, 't1').subscribe(doc => seen.push(doc?.title ?? null));
    tasks.updateOne({ _id: 't1' }, { $set: { title: 'Rewrite' } });
    await tick();
    tasks.deleteOne({ _id: 't1' });
    await tick();
    off();
    assert.deepEqual(seen, ['Write', 'Rewrite', null]);
});

test('Angular: querySignal and documentSignal, destroyed with their injector; RxJS from()', async () => {
    const { createEnvironmentInjector } = await import('@angular/core');
    const { querySignal, documentSignal } = await import('../../adapters/angular.mjs');
    const { from } = await import('rxjs');
    const tasks = collection();
    const injector = createEnvironmentInjector([], null);
    const open = querySignal(tasks, { done: false }, { sort: { due: -1 } }, { injector });
    const test = documentSignal(tasks, 't2', {}, { injector });
    assert.deepEqual(open().map(t => t.title), ['Ship', 'Write']);
    assert.equal(test().title, 'Test');
    tasks.updateMany({}, { $set: { done: false } });
    await tick();
    assert.deepEqual(open().map(t => t.title), ['Ship', 'Write', 'Test']);
    injector.destroy();
    assert.equal(tasks._listeners.get('change')?.size ?? 0, 0);

    const seen = [];
    const subscription = from(tasks.watch({ due: { $gt: 1 } })).subscribe(list => seen.push(list.length));
    tasks.insertOne({ title: 'More', due: 5 });
    await tick();
    subscription.unsubscribe();
    assert.deepEqual(seen, [2, 3]);
});

/**
 * Svelte bindings: a live query is a Svelte store, so $tasks just works (Svelte 3, 4 and 5).
 *   const tasks = query(db.tasks, { done: false }, { sort: { due: 1 } });
 *   {#each $tasks as task (task._id)} ... {/each}
 * The collection is watched only while a component uses the store.
 */
export function query(collection, filter = {}, options = {}) {
    return collection.watch(filter, options);
}

/** One document by _id, as a store of the document or null */
export function documentStore(collection, id, options = {}) {
    const live = collection.watch({ _id: id }, options);
    return {
        subscribe(run) {
            return live.subscribe(list => run(list[0] ?? null));
        }
    };
}

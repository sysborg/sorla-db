/**
 * Angular bindings: a read-only signal with the matching documents.
 *   tasks = querySignal(db.tasks, { done: false }, { sort: { due: 1 } });   // in a field initializer
 *   @for (task of tasks(); track task._id) { ... }
 * Call it in an injection context (constructor, field initializer) or pass { injector }; the query
 * stops when the component or service is destroyed. For RxJS, from(db.tasks.watch(query)) works too.
 */
import { DestroyRef, computed, inject, runInInjectionContext, signal } from '@angular/core';

export function querySignal(collection, query = {}, options = {}, { injector } = {}) {
    const create = () => {
        const live = collection.watch(query, options);
        const documents = signal(live.getSnapshot());
        const off = live.subscribe(list => documents.set(list));
        inject(DestroyRef).onDestroy(off);
        return documents.asReadonly();
    };
    return injector ? runInInjectionContext(injector, create) : create();
}

/** One document by _id, as a signal of the document or null */
export function documentSignal(collection, id, options = {}, context = {}) {
    const documents = querySignal(collection, { _id: id }, options, context);
    return computed(() => documents()[0] ?? null);
}


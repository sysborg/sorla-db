/**
 * Vue bindings: a shallow ref with the matching documents, current as the collection changes.
 *   const tasks = useQuery(db.tasks, { done: false }, { sort: { due: 1 } });
 *   const mine = useQuery(db.tasks, () => ({ owner: user.value }));   // reactive query
 * The collection, query and options may be refs or getters; the query restarts only when its value
 * changes, and stops with the component (effect scope).
 */
import { getCurrentScope, onScopeDispose, shallowReadonly, shallowRef, toValue, watch } from 'vue';
import { queryKey } from './key.mjs';

export function useQuery(collection, query = {}, options = {}) {
    const documents = shallowRef([]);
    let off = null;
    const current = () => [toValue(collection), toValue(query), toValue(options)];
    const start = () => {
        const [target, currentQuery, currentOptions] = current();
        if (off) off();
        off = target.watch(currentQuery, currentOptions).subscribe(list => { documents.value = list; });
    };

    start();
    // a string key: a new object with the same query does not restart it
    const stop = watch([
        () => toValue(collection),
        () => queryKey(toValue(query), toValue(options))
    ], start, { flush: 'sync' });

    if (getCurrentScope()) {
        onScopeDispose(() => {
            stop();
            if (off) off();
        });
    }
    return shallowReadonly(documents);
}

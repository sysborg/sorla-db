/**
 * React bindings: the component re-renders when the matching documents change.
 *   const tasks = useQuery(db.tasks, { done: false }, { sort: { due: 1 } });
 *   const task = useDocument(db.tasks, id);
 * Queries are compared by value, so an inline object does not restart the query on every render.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { queryKey } from './key.mjs';

export function useQuery(collection, query = {}, options = {}) {
    const key = queryKey(query, options);
    // the key (query and options by value) replaces them in the dependencies
    const live = useMemo(() => collection.watch(query, options), [collection, key]);
    const subscribe = useCallback(onChange => live.subscribe(() => onChange()), [live]);
    const getSnapshot = useCallback(() => live.getSnapshot(), [live]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** One document by _id (a frozen copy), or null */
export function useDocument(collection, id, options = {}) {
    const [doc] = useQuery(collection, { _id: id }, options);
    return doc ?? null;
}

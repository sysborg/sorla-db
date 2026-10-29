import type { Collection, Document, LiveQuery, LiveQueryOptions, Query } from '../index.js';
/** A Svelte store of the matching documents: $store in components. */
export declare function query<T extends Document = Document>(collection: Collection, filter?: Query, options?: LiveQueryOptions): LiveQuery<T>;
export declare function documentStore<T extends Document = Document>(collection: Collection, id: unknown, options?: LiveQueryOptions): { subscribe(run: (doc: Readonly<T> | null) => void): () => void };

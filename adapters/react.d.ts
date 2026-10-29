import type { Collection, Document, LiveQueryOptions, Query } from '../index.js';
/** The matching documents (frozen copies); re-renders when they change. Queries compare by value. */
export declare function useQuery<T extends Document = Document>(collection: Collection, query?: Query, options?: LiveQueryOptions): readonly Readonly<T>[];
/** One document by _id, or null. */
export declare function useDocument<T extends Document = Document>(collection: Collection, id: unknown, options?: LiveQueryOptions): Readonly<T> | null;

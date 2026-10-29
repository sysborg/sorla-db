import type { MaybeRefOrGetter, Ref } from 'vue';
import type { Collection, Document, LiveQueryOptions, Query } from '../index.js';
/** A read-only shallow ref with the matching documents. Arguments may be refs or getters. */
export declare function useQuery<T extends Document = Document>(collection: MaybeRefOrGetter<Collection>, query?: MaybeRefOrGetter<Query>, options?: MaybeRefOrGetter<LiveQueryOptions>): Readonly<Ref<readonly Readonly<T>[]>>;

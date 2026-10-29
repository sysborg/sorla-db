import type { Injector, Signal } from '@angular/core';
import type { Collection, Document, LiveQueryOptions, Query } from '../index.js';
/** A read-only signal of the matching documents. Call in an injection context or pass { injector }. */
export declare function querySignal<T extends Document = Document>(collection: Collection, query?: Query, options?: LiveQueryOptions, context?: { injector?: Injector }): Signal<readonly Readonly<T>[]>;
export declare function documentSignal<T extends Document = Document>(collection: Collection, id: unknown, options?: LiveQueryOptions, context?: { injector?: Injector }): Signal<Readonly<T> | null>;

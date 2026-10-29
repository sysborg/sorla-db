// Type declarations for sorla-db

export type Document = Record<string, unknown> & { _id?: unknown };

export type ComparisonOperators = {
    $eq?: unknown;
    $ne?: unknown;
    $gt?: unknown;
    $gte?: unknown;
    $lt?: unknown;
    $lte?: unknown;
    $in?: unknown[];
    $nin?: unknown[];
    $exists?: boolean;
    $regex?: string | RegExp;
    /** Flags for $regex: i, m, s */
    $options?: string;
    $not?: ComparisonOperators | RegExp;
};

/** A query: field conditions (value or operators, "a.b" paths allowed) and nested $and / $or / $nor. */
export type Query = {
    $and?: Query[];
    $or?: Query[];
    $nor?: Query[];
    [field: string]: unknown;
};

/** Exclusion ({ email: 0 }) or inclusion ({ name: 1 }); only _id can mix both. */
export type Projection = Record<string, 0 | 1>;

export type UpdateFilter = {
    $set?: Record<string, unknown>;
    $unset?: Record<string, unknown>;
    $inc?: Record<string, number>;
    $push?: Record<string, unknown | { $each: unknown[] }>;
    $pull?: Record<string, unknown>;
};

export interface UpdateOptions {
    /** Insert a document built from the filter when nothing matches. */
    upsert?: boolean;
}

export interface UpdateResult {
    matchedCount: number;
    modifiedCount: number;
    upsertedId: unknown | null;
}

export interface DeleteResult {
    deletedCount: number;
}

export type ChangeType = 'insert' | 'update' | 'replace' | 'delete';

export interface ChangeEvent {
    type: ChangeType;
    ids: unknown[];
    /** Copies of the documents (after the change; the removed ones for delete). */
    documents: Document[];
    /** Copies of the documents before an update or replace. */
    previous?: Document[];
}
export type SortSpec = Record<string, 1 | -1>;

export interface SortOptions {
    /** Intl.Collator options plus the locale, e.g. { locale: 'pt-BR', sensitivity: 'base', numeric: true } */
    collation?: Intl.CollatorOptions & { locale?: string };
}

export interface StoredDocument {
    readonly _data: Document;
    readonly [field: string]: unknown;
}

export declare class Cursor {
    readonly length: number;
    currIndex: number;
    hasNext(): boolean;
    next(): StoredDocument;
    reset(): void;
    /** Data of the first document, null when empty. */
    first(): Document | null;
    /** Data of the last document, null when empty. */
    last(): Document | null;
    /** Plain copies of the documents. */
    toArray(): Document[];
    sort(spec: SortSpec, options?: SortOptions): this;
    skip(count: number): this;
    /** 0 means no limit. */
    limit(count: number): this;
    projection(projection: Projection): this;
    push(element: object): void;
}

export declare class Collection {
    readonly first: Document;
    readonly last: Document;
    readonly all: StoredDocument[];
    /** All documents, or the ones matching the query. */
    count(query?: Query): number;
    /** Inserts a copy of the document and returns its _id. */
    insertOne(document: Document, callback?: (id: unknown) => void): unknown;
    /** Validates every document first, then inserts them and returns their ids. */
    insertMany(documents: Document[], callback?: (ids: unknown[]) => void): unknown[];
    find(query: Query, projection?: Projection | null): Cursor;
    /** Data of the first matching document, null when nothing matches. */
    findOne(query: Query, projection?: Projection | null): Document | null;
    updateOne(filter: Query, update: UpdateFilter, options?: UpdateOptions): UpdateResult;
    updateMany(filter: Query, update: UpdateFilter, options?: UpdateOptions): UpdateResult;
    /** Replaces the document, keeping its _id. */
    replaceOne(filter: Query, replacement: Document, options?: UpdateOptions): UpdateResult;
    deleteOne(filter: Query): DeleteResult;
    /** deleteMany({}) empties the collection. */
    deleteMany(filter: Query): DeleteResult;
    /** Returns a function that unsubscribes. "change" receives every type. */
    on(event: ChangeType | 'change', listener: (event: ChangeEvent) => void): () => void;
    once(event: ChangeType | 'change', listener: (event: ChangeEvent) => void): () => void;
    off(event: ChangeType | 'change', listener?: (event: ChangeEvent) => void): void;
}

export interface DatabaseStats {
    name: string;
    documents: number;
    collections: Array<{ name: string; documents: number }>;
}

export declare class Database {
    readonly name: string;
    createCollection(name: string, validationSchema?: unknown): void;
    countCollections(): number;
    listCollections(): string[];
    /** Any collection by name, also when the name shadows a method. */
    getCollection(name: string): Collection | undefined;
    dropCollection(name: string): boolean;
    getStats(): DatabaseStats;
    [collection: string]: unknown;
}

declare class sorla {
    constructor();
    /** The selected database. Collections are properties of it: sorla.db.people */
    readonly db: Database & Record<string, Collection>;
    dbExists(name: string): boolean;
    /** Position of the new database, or false when the name exists. */
    createDb(name: string): number | false;
    /** Selects a database, creating it when needed. */
    useDb(name: string): void;
    countDb(): number;
    listDatabases(): string[];
    /** When the dropped database was selected, db becomes null. */
    dropDb(name: string): boolean;
}

export { sorla };
export default sorla;

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
    $not?: ComparisonOperators;
};

/** A query: field conditions (value or operators, "a.b" paths allowed) and nested $and / $or / $nor. */
export type Query = {
    $and?: Query[];
    $or?: Query[];
    $nor?: Query[];
    [field: string]: unknown;
};

export type Projection = Record<string, 0>;
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
    projection(projection: Projection): void;
    push(element: object): void;
}

export declare class Collection {
    readonly first: Document;
    readonly last: Document;
    readonly all: StoredDocument[];
    count(): number;
    /** Inserts a copy of the document and returns its _id. */
    insertOne(document: Document, callback?: (id: unknown) => void): unknown;
    /** Validates every document first, then inserts them and returns their ids. */
    insertMany(documents: Document[], callback?: (ids: unknown[]) => void): unknown[];
    find(query: Query, projection?: Projection | null): Cursor;
    /** Data of the first matching document, null when nothing matches. */
    findOne(query: Query, projection?: Projection | null): Document | null;
}

export declare class Database {
    readonly name: string;
    createCollection(name: string, validationSchema?: unknown): void;
    countCollections(): number;
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
}

export { sorla };
export default sorla;

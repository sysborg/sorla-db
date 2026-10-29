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
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null' | 'date';

/** Subset of JSON Schema used to validate documents ("date" accepts Date objects). */
export interface JSONSchema {
    type?: SchemaType | SchemaType[];
    properties?: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean | JSONSchema;
    items?: JSONSchema;
    enum?: unknown[];
    const?: unknown;
    /** Applied on insert and upsert when the field is missing. */
    default?: unknown;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: 'email' | 'date' | 'date-time' | 'uri';
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    title?: string;
    description?: string;
    examples?: unknown[];
    $schema?: string;
    $id?: string;
}

export type SchemaFunction = (document: Document) => true | false | string | Array<string | Partial<ValidationIssue>> | null | undefined;

export interface ValidationIssue {
    /** Field path: 'email', 'address.zip', 'tags[1]'; '' for the whole document. */
    path: string;
    rule: string;
    message: string;
}

export declare class ValidationError extends Error {
    name: 'ValidationError';
    errors: ValidationIssue[];
}

export interface BindFormOptions {
    /** "insert" (default) runs insertOne; "update" loads `id` and runs updateOne with the form fields. */
    mode?: 'insert' | 'update';
    id?: unknown;
    /** Build labeled fields from the collection JSON schema. */
    generate?: boolean;
    /** When fields are validated before submit (default "blur"). */
    validateOn?: 'blur' | 'input' | 'submit';
    /** Clear the form after an insert (default true). */
    resetOnInsert?: boolean;
    /** Keep the browser validation bubbles (default false: the form gets novalidate). */
    nativeValidation?: boolean;
    /** Translate or rewrite messages; return null to keep the default one. */
    messages?: (issue: ValidationIssue) => string | null | undefined;
    onSuccess?: (result: FormResult) => void;
    onError?: (errors: ValidationIssue[]) => void;
    /** Document used to resolve a selector (defaults to the global document). */
    document?: Document;
}

export interface FormResult {
    ok: true;
    mode: 'insert' | 'update';
    id: unknown;
    document: Document | null;
    /** update only: whether something changed. */
    modified?: boolean;
}

export interface FormController {
    readonly form: HTMLFormElement;
    readonly mode: 'insert' | 'update';
    readonly id: unknown;
    /** Current values, converted with the schema. */
    values(): Document;
    fill(document: Document): void;
    /** Shows every error and returns them. */
    validate(): ValidationIssue[];
    submit(): FormResult | { ok: false; errors: ValidationIssue[] };
    /** Loads a document and switches to update mode. */
    load(id: unknown): Document;
    reset(): void;
    destroy(): void;
}

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
    /** Checks a document against the schema without storing it. */
    validate(document: Document): { valid: boolean; errors: ValidationIssue[] };
    /** Existing documents are not revalidated. null removes the schema. */
    setSchema(schema: JSONSchema | SchemaFunction | null): this;
    getSchema(): JSONSchema | SchemaFunction | null;
    /** Copy of the document with the schema defaults filled in. */
    applyDefaults(document: Document): Document;
    /** Binds an HTML form to the collection (browser). */
    bindForm(form: string | HTMLFormElement, options?: BindFormOptions): FormController;
}

export interface DatabaseStats {
    name: string;
    documents: number;
    collections: Array<{ name: string; documents: number }>;
}

export declare class Database {
    readonly name: string;
    /** Inserts, updates and replaces must satisfy the schema; a ValidationError is thrown otherwise. */
    createCollection(name: string, validationSchema?: JSONSchema | SchemaFunction | null): void;
    countCollections(): number;
    listCollections(): string[];
    /** Any collection by name, also when the name shadows a method. */
    getCollection(name: string): Collection | undefined;
    dropCollection(name: string): boolean;
    getStats(): DatabaseStats;
    [collection: string]: unknown;
}

declare class sorla {
    static ValidationError: typeof ValidationError;
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

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
    /** Missing and null values: last (default, from the collection options) or first, in both directions. */
    nulls?: 'first' | 'last';
}

export interface CollectionOptions {
    /** Default of sort({ nulls }): 'last' (default) or 'first'. */
    nulls?: 'first' | 'last';
}

export type BulkWriteOperation =
    | { insertOne: { document: Document } }
    | { updateOne: { filter: Query; update: UpdateFilter; upsert?: boolean } }
    | { updateMany: { filter: Query; update: UpdateFilter; upsert?: boolean } }
    | { replaceOne: { filter: Query; replacement: Document; upsert?: boolean } }
    | { deleteOne: { filter: Query } }
    | { deleteMany: { filter: Query } };

export interface BulkWriteResult {
    insertedCount: number;
    matchedCount: number;
    modifiedCount: number;
    deletedCount: number;
    upsertedCount: number;
    /** Operation index => _id */
    insertedIds: Record<number, unknown>;
    upsertedIds: Record<number, unknown>;
}

/** Thrown by bulkWrite: name is 'BulkWriteError'. The operations before the error stay applied. */
export interface BulkWriteError extends Error {
    writeErrors: Array<{ index: number; operation: BulkWriteOperation; error: Error }>;
    result: BulkWriteResult;
}

export interface StreamState {
    /** Rows received in "rows" events. */
    loaded: number;
    /** From the "meta" or "end" event, null until then. */
    total: number | null;
    blocks: number;
    /** Rows (or messages) that could not be applied. */
    errors: number;
    lastEventId: string | null;
    finished: boolean;
}

export interface StreamOptions {
    /** 'fetch' (default: headers, POST, Node 18+) or 'eventsource' (the browser's EventSource). */
    transport?: 'fetch' | 'eventsource';
    headers?: Record<string, string>;
    method?: string;
    body?: BodyInit;
    credentials?: RequestCredentials;
    /** EventSource transport: send cookies to another origin. */
    withCredentials?: boolean;
    /** 'upsert' (default): rows with an existing _id replace it; 'insert': duplicated ids are errors. */
    mode?: 'upsert' | 'insert';
    /** Delay before reconnecting in ms (default 1000; the server can change it with "retry:"). */
    retry?: number;
    /** Failed connections in a row before giving up (default 10). */
    maxRetries?: number;
    /** Resume a stream: sent as Last-Event-ID on the first request. */
    lastEventId?: string | null;
    onProgress?: (state: StreamState) => void;
    onError?: (error: Error) => void;
    /** Events with other names. */
    onMessage?: (event: { type: string; data: string; id: string | null }) => void;
    /** Handle rows / ops / delete yourself instead of writing them to the collection. */
    apply?: (type: 'rows' | 'ops' | 'delete', data: unknown) => void;
    fetch?: typeof fetch;
    EventSource?: typeof EventSource;
}

export interface StreamController {
    /** Resolves on "end" or close(), rejects on "abort", HTTP 4xx or too many failures. */
    readonly done: Promise<StreamState>;
    readonly state: StreamState;
    close(): void;
}

export interface ConnectOptions {
    /** Store loaded and pushed rows in the collection (default: true for collection.connect, false for sorla.connect). */
    apply?: boolean;
    mode?: 'upsert' | 'insert';
    /** Reconnect after a drop (default true), with exponential back off from retry (500 ms) up to maxRetry (30 s). */
    reconnect?: boolean;
    retry?: number;
    maxRetry?: number;
    maxRetries?: number;
    /** Ping interval in ms (default 25000, 0 disables); no message for two intervals reconnects. */
    heartbeat?: number;
    /** Reply timeout in ms (default 30000, 0 disables). */
    timeout?: number;
    protocols?: string | string[];
    WebSocket?: typeof WebSocket;
}

export interface LoadParams {
    offset?: number;
    limit?: number;
    query?: Query;
    sort?: SortSpec;
    [key: string]: unknown;
}

export interface LoadResult {
    rows: Document[];
    hasMore?: boolean;
    total?: number;
}

export interface LiveQueryOptions {
    sort?: SortSpec;
    nulls?: 'first' | 'last';
    collation?: SortOptions['collation'];
    skip?: number;
    /** 0 means no limit. */
    limit?: number;
    projection?: Projection;
}

/** collection.watch(): the matching documents kept current. A Svelte store and an Observable. */
export declare class LiveQuery<T extends Document = Document> {
    /** The same frozen array until something changes. */
    getSnapshot(): readonly Readonly<T>[];
    /** Called at once and after every change (merged per microtask). Returns unsubscribe (also .unsubscribe()). */
    subscribe(listener: ((documents: readonly Readonly<T>[]) => void) | { next(documents: readonly Readonly<T>[]): void }): (() => void) & { unsubscribe(): void };
    readonly length: number;
    close(): void;
}

export declare class Remote {
    readonly state: 'connecting' | 'open' | 'closed';
    /** {type: 'load', id, ...params} → {type: 'reply', id, rows, hasMore, total} */
    load(params?: LoadParams): Promise<LoadResult>;
    /** Any request: {type, id, ...payload} → {type: 'reply', id, ...} or {type: 'error', id, message} */
    request(type: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>>;
    send(type: string, payload?: Record<string, unknown>): void;
    close(): void;
    on(event: 'open' | 'close' | 'error' | 'push' | 'message', listener: (event: Record<string, unknown>) => void): () => void;
    once(event: 'open' | 'close' | 'error' | 'push' | 'message', listener: (event: Record<string, unknown>) => void): () => void;
    off(event: string, listener?: (event: Record<string, unknown>) => void): void;
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
    /** Copy of the first document, null when empty. */
    first(): Document | null;
    /** Copy of the last document, null when empty. */
    last(): Document | null;
    /** Plain copies of the documents. Only the documents read are copied. */
    toArray(): Document[];
    /** The _id of each document, without copying anything. */
    ids(): unknown[];
    forEach(fn: (document: Document, index: number) => void): void;
    [Symbol.iterator](): Iterator<Document>;
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
    /** Several writes, one change event per type; filters on _id use the index. Throws a BulkWriteError. */
    bulkWrite(operations: BulkWriteOperation[], options?: { ordered?: boolean }): BulkWriteResult;
    setOptions(options: CollectionOptions): this;
    getOptions(): Required<CollectionOptions>;
    /** Live query: subscribe(fn) / getSnapshot(), see sorla-db/react, /vue, /svelte, /angular. */
    watch<T extends Document = Document>(query?: Query, options?: LiveQueryOptions): LiveQuery<T>;
    /** Loads rows sent in blocks by a Server-Sent Events endpoint. */
    stream(url: string, options?: StreamOptions): StreamController;
    /** WebSocket to a backend: pages, requests and pushed changes. */
    connect(url: string, options?: ConnectOptions): Remote;
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
    createCollection(name: string, validationSchema?: JSONSchema | SchemaFunction | null, options?: CollectionOptions): void;
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
    /** WebSocket not tied to a collection: load() returns the rows without storing them. */
    static connect(url: string, options?: ConnectOptions): Remote;
    /** Server-Sent Events stream without a collection: options.apply receives each block. */
    static stream(url: string, options: StreamOptions & { apply: NonNullable<StreamOptions['apply']> }): StreamController;
    /** text/event-stream parser. */
    static readEventStream(body: ReadableStream<Uint8Array>, onEvent: (event: { type: string; data: string; id: string | null }) => void, onRetry?: (ms: number) => void): Promise<void>;
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

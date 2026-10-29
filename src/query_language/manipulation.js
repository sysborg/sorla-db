const documents = require('../documents/document.js');
const operatorsCheck = require('./operators.js');
const emitter = require('../events.js');
const { clone } = require('../clone.js');
const { applyUpdate } = require('./update.js');
const { compileSchema, ValidationError } = require('../schema/schema.js');

class manipulation extends emitter {
    constructor(validationSchema = null) {
        super();
        this.validationSchema = validationSchema;
        this._index = {};
        this._prohibitedCharacters = ['$', '.'];
    }

    /**
     * Generates a unique key as a uuid
     * @return string
     */
    _generateKey() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16)
        });
    }

    /**
     * Sets the validation schema of the collection (JSON Schema subset or a function).
     * Documents inserted, updated or replaced afterwards must satisfy it; existing ones are not checked.
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.4.0
     * @param object|function|null validationSchema
     * @return void
    **/
    set validationSchema(validationSchema)
    {
        if(validationSchema === null || typeof validationSchema === 'undefined')
        {
            this._schema = null;
            return;
        }

        if(['object', 'function'].indexOf(typeof validationSchema) === -1 || Array.isArray(validationSchema))
            throw new Error('The validation schema must be an object (JSON Schema) or a function');

        this._schema = compileSchema(validationSchema);
    }

    /**
     * The schema given to the collection, or null
     * @return object|function|null
     */
    get validationSchema()
    {
        return this._schema ? this._schema.source : null;
    }

    /**
     * @param object|function|null schema
     * @return this
     */
    setSchema(schema)
    {
        this.validationSchema = schema;
        return this;
    }

    getSchema()
    {
        return this.validationSchema;
    }

    /**
     * Checks a document against the schema without storing it (e.g. to validate a form)
     * @param object document
     * @return object {valid, errors: [{path, rule, message}]}
     */
    validate(document)
    {
        const errors = this._schema ? this._schema.validate(document) : [];
        return { valid: errors.length === 0, errors };
    }

    /**
     * Copy of a document with the schema defaults filled in (what insertOne would store)
     * @param object document
     * @return object
     */
    applyDefaults(document)
    {
        const data = this._copy(document);
        if(this._schema)
            this._schema.applyDefaults(data, value => this._copy(value));

        return data;
    }

    /**
     * Throws a ValidationError when the data does not satisfy the schema
     * @param object data
     * @return void
     */
    _validate(data) 
    {
        const errors = this._schema ? this._schema.validate(data) : [];
        if(errors.length)
            throw new ValidationError(errors);
    }

    /**
     * Whether a value is a document: an object that is not null nor an array
     * @param mixed value
     * @return boolean
     */
    _isDocument(value)
    {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Verify that no key, at any depth, has prohibited characters
     * @param object document
     * @return boolean
     */
    _validateKeys(document)
    {
        const operators = new operatorsCheck();
        for(const key of Object.keys(document))
        {
            const hasProhibitedCharacters = this._prohibitedCharacters.some(char => key.indexOf(char) > -1);
            if(hasProhibitedCharacters && !operators.isOperator(key))
                return false;

            const value = document[key];
            const nested = Array.isArray(value) ? value : [value];
            for(const item of nested)
            {
                // null is a valid value, only objects have keys to check
                if(item !== null && typeof item === 'object' && !this._validateKeys(item))
                    return false;
            }
        }

        return true;
    }

    /**
     * Set of the _id values of the collection. It is rebuilt when its size no longer matches the
     * documents, so removals done directly on the documents array are handled too.
     * @return Set
     */
    _ids()
    {
        if(!this._idSet || this._idSet.size !== this._documents.length)
            this._idSet = new Set(this._documents.map(doc => doc._data._id));

        return this._idSet;
    }

    /**
     * Copies a document, so the object given by the caller is never changed
     * @param object document
     * @return object
     */
    _copy(document)
    {
        try {
            return clone(document);
        } catch(error) {
            if(error && error.name === 'DataCloneError')
                throw new Error('Documents can only contain cloneable values (no functions or DOM nodes)');

            throw error;
        }
    }

    /**
     * Inserts one document to the collection
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.2.0
     * @param object document
     * @param function callback - receives the inserted _id
     * @return mixed the _id of the inserted document
    **/
    insertOne(document, callback) 
    {
        const id = this._insertDocument(document);
        this._emitChange('insert', { ids: [id], documents: [this._copy(this._documents.at(-1)._data)] });

        if(typeof callback === 'function')
            callback(id);

        return id;
    }

    /**
     * Validates and stores one document, without events
     * @param object document
     * @return mixed the _id
     */
    _insertDocument(document)
    {
        return this._store(this._prepare(document));
    }

    /**
     * Copy of a document ready to be stored: _id, schema defaults, keys and schema checked
     * @param object document
     * @param Set reserved ids taken by the same batch
     * @return object
     */
    _prepare(document, reserved = null)
    {
        if(!this._isDocument(document))
            throw new Error('Invalid document type');

        if(!this._validateKeys(document))
            throw new Error('Invalid document keys');

        const taken = id => this._ids().has(id) || (reserved !== null && reserved.has(id));
        const data = this._copy(document);
        if(typeof data._id === 'undefined')
        {
            do {
                data._id = this._generateKey();
            } while(taken(data._id));
        }
        else if(taken(data._id))
        {
            throw new Error(`Duplicate _id "${data._id}"`);
        }

        if(this._schema)
        {
            this._schema.applyDefaults(data, value => this._copy(value));
            if(!this._validateKeys(data))
                throw new Error('Invalid document keys');
        }

        this._validate(data);
        return data;
    }

    /**
     * @param object data prepared document
     * @return mixed the _id
     */
    _store(data)
    {
        this._documents.push(new documents(data));
        this._ids().add(data._id);
        return data._id;
    }

    /**
     * Insert many documents. Every document is validated before the first one is inserted,
     * so an invalid document never leaves the collection with only part of the batch.
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.2.0
     * @param array documents 
     * @param function callback - receives the inserted ids
     * @return array the _id of each inserted document
     */
    insertMany(documents, callback) {
        if(!Array.isArray(documents) || !documents.every(document => this._isDocument(document)))
            throw new Error('Documents must be an array of objects');

        // prepare (and validate) the whole batch before storing anything
        const reserved = new Set();
        const prepared = documents.map(document => {
            const data = this._prepare(document, reserved);
            reserved.add(data._id);
            return data;
        });

        const start = this._documents.length;
        const ids = prepared.map(data => this._store(data));
        this._emitChange('insert', { ids, documents: this._documents.slice(start).map(doc => this._copy(doc._data)) });

        if(typeof callback === 'function')
            callback(ids);

        return ids;
    }

    /**
     * Helpers the update operators need
     * @return object
     */
    _updateHelpers()
    {
        return {
            copy: value => this._copy(value),
            validateKeys: value => this._validateKeys(value),
            operators: this._operators
        };
    }

    /**
     * Document for an upsert: the equality conditions of the filter, then the update
     * @param object filter
     * @return object
     */
    _upsertBase(filter)
    {
        const base = {};
        for(const [key, value] of Object.entries(filter))
        {
            // only top level equality conditions describe the new document
            if(key.startsWith('$') || key.includes('.') || this._operators.isRegExp(value))
                continue;

            if(this._operators.isOperatorObject(value))
            {
                if('$eq' in value)
                    base[key] = value.$eq;

                continue;
            }

            base[key] = value;
        }
        return base;
    }

    /**
     * Applies an update to the matching documents
     * @param object filter
     * @param object update
     * @param object options {upsert}
     * @param boolean many
     * @return object {matchedCount, modifiedCount, upsertedId}
     */
    _update(filter, update, options, many)
    {
        this._requireFilter(filter);
        const helpers = this._updateHelpers();
        const changes = [];

        // compute every new version first: one invalid update leaves all documents untouched
        for(let i = 0; i < this._documents.length; i++)
        {
            const doc = this._documents[i];
            if(!this._operators.matches(doc, filter))
                continue;

            const next = applyUpdate(doc._data, update, helpers);
            this._validate(next);
            changes.push({ index: i, previous: doc._data, next });
            if(!many) break;
        }

        if(!changes.length && options.upsert)
        {
            const data = applyUpdate(this._upsertBase(filter), update, helpers);
            const id = this._insertDocument(data);
            this._emitChange('insert', { ids: [id], documents: [this._copy(this._documents.at(-1)._data)] });
            return { matchedCount: 0, modifiedCount: 0, upsertedId: id };
        }

        const modified = changes.filter(change => JSON.stringify(change.previous) !== JSON.stringify(change.next));
        for(const change of modified)
            this._documents[change.index] = new documents(change.next);

        if(modified.length)
        {
            this._emitChange('update', {
                ids: modified.map(change => change.next._id),
                documents: modified.map(change => this._copy(change.next)),
                previous: modified.map(change => this._copy(change.previous))
            });
        }

        return { matchedCount: changes.length, modifiedCount: modified.length, upsertedId: null };
    }

    /**
     * Updates the first matching document: updateOne({name: 'Ana'}, {$set: {age: 30}, $inc: {visits: 1}})
     * Operators: $set, $unset, $inc, $push (with $each), $pull. The _id cannot change.
     * @param object filter
     * @param object update
     * @param object options {upsert: insert when nothing matches}
     * @return object {matchedCount, modifiedCount, upsertedId}
     */
    updateOne(filter, update, options = {})
    {
        return this._update(filter, update, options, false);
    }

    /**
     * Updates every matching document, see updateOne()
     * @param object filter
     * @param object update
     * @param object options {upsert}
     * @return object {matchedCount, modifiedCount, upsertedId}
     */
    updateMany(filter, update, options = {})
    {
        return this._update(filter, update, options, true);
    }

    /**
     * Replaces the first matching document, keeping its _id
     * @param object filter
     * @param object replacement a document without update operators
     * @param object options {upsert}
     * @return object {matchedCount, modifiedCount, upsertedId}
     */
    replaceOne(filter, replacement, options = {})
    {
        this._requireFilter(filter);
        if(!this._isDocument(replacement))
            throw new Error('The replacement must be a document');

        if(Object.keys(replacement).some(key => key.startsWith('$')))
            throw new Error('The replacement cannot contain update operators, use updateOne()');

        if(!this._validateKeys(replacement))
            throw new Error('Invalid document keys');

        const index = this._documents.findIndex(doc => this._operators.matches(doc, filter));
        if(index === -1)
        {
            if(!options.upsert)
                return { matchedCount: 0, modifiedCount: 0, upsertedId: null };

            const id = this._insertDocument(replacement);
            this._emitChange('insert', { ids: [id], documents: [this._copy(this._documents.at(-1)._data)] });
            return { matchedCount: 0, modifiedCount: 0, upsertedId: id };
        }

        const previous = this._documents[index]._data;
        if(typeof replacement._id !== 'undefined' && replacement._id !== previous._id)
            throw new Error('The _id field cannot be changed');

        const next = { ...this._copy(replacement), _id: previous._id };
        this._validate(next);
        const modified = JSON.stringify(previous) !== JSON.stringify(next);
        if(modified)
        {
            this._documents[index] = new documents(next);
            this._emitChange('replace', { ids: [next._id], documents: [this._copy(next)], previous: [this._copy(previous)] });
        }

        return { matchedCount: 1, modifiedCount: modified ? 1 : 0, upsertedId: null };
    }

    /**
     * Removes matching documents, keeping the documents array in place
     * @param object filter
     * @param boolean many
     * @return object {deletedCount}
     */
    _delete(filter, many)
    {
        this._requireFilter(filter);
        const removed = [];
        let write = 0;
        for(let read = 0; read < this._documents.length; read++)
        {
            const doc = this._documents[read];
            if((many || !removed.length) && this._operators.matches(doc, filter))
                removed.push(doc._data);
            else
                this._documents[write++] = doc;
        }
        this._documents.length = write;

        if(removed.length)
        {
            for(const data of removed)
                this._idSet?.delete(data._id);

            this._emitChange('delete', { ids: removed.map(data => data._id), documents: removed });
        }

        return { deletedCount: removed.length };
    }

    /**
     * Deletes the first matching document
     * @param object filter
     * @return object {deletedCount}
     */
    deleteOne(filter)
    {
        return this._delete(filter, false);
    }

    /**
     * Deletes every matching document; deleteMany({}) empties the collection
     * @param object filter
     * @return object {deletedCount}
     */
    deleteMany(filter)
    {
        return this._delete(filter, true);
    }

    _requireFilter(filter)
    {
        if(!this._isDocument(filter))
            throw new Error('The filter must be a query object, use {} to match every document');
    }

    //create index
    //create indexes
}

module.exports = manipulation;
/**
 * @class Cursor
 * @description Result of find(). It holds references to the stored documents, not copies:
 * filtering, sort(), skip(), limit(), length and ids() copy nothing. A document is copied only when
 * it is read (next(), toArray(), first(), last(), iteration), so reading one page of a large result
 * copies one page. Stored documents are never changed in place (updates store new objects), so a
 * cursor is a consistent snapshot of the moment find() ran.
 */
const { clone } = require('../clone.js');

class cursor {
    /**
     * @constructor
     * @param array data stored documents
     * @param object projection
     * @param object options {nulls: 'last' | 'first'} defaults of the collection
     * @description Create a new cursor instance
     */
    constructor(data, projection, options = {}) {
        this._data = typeof data === 'undefined' ? [] : data;
        this._projection = null;
        this._options = options || {};
        this.currIndex = 0;
        if(typeof projection === 'object')
            this.projection(projection);
    }

    /**
     * @method hasNext
     * @description Check if the cursor has more elements
     * @return boolean
     */
    hasNext() {
        return this.currIndex < this._data.length;
    }

    /**
     * @method next
     * @description Get a copy of the next document (with the projection applied)
     * @return Document
     */
    next() {
        if(!this.hasNext())
            throw new Error('No more item to the cursor');

        const copy = this._data[this.currIndex++].clone();
        this._projectDocument(copy);
        return copy;
    }

    /**
     * @method toArray
     * @description Copies of the documents, as plain objects
     * @return array
     */
    toArray() {
        return this._data.map(doc => this._read(doc));
    }

    /**
     * Copies of the documents one at a time, as plain objects
     * @return Iterator
     */
    *[Symbol.iterator]() {
        for(const doc of this._data)
            yield this._read(doc);
    }

    /**
     * Calls fn(document, index) with a copy of each document
     * @param function fn
     * @return void
     */
    forEach(fn) {
        this._data.forEach((doc, index) => fn(this._read(doc), index));
    }

    /**
     * The _id of each document, without copying anything
     * @return array
     */
    ids() {
        return this._data.map(doc => doc._data._id);
    }

    /**
     * @methor reset
     * @description Reset the cursor to the first element
     * @return void
     */
    reset() {
        this.currIndex = 0;
    }

    /**
     * @method first
     * @description Copy of the first document, or null
     * @return object|null
     */
    first() {
        return this._data.length ? this._read(this._data[0]) : null;
    }

    /**
     * @method last
     * @description Copy of the last document, or null
     * @return object|null
     */
    last() {
        return this._data.length ? this._read(this._data[this._data.length - 1]) : null;
    }

    /**
     * @method sort
     * @description Sort the documents of the cursor: {age: -1, name: 1}
     * Values of different types follow MongoDB's order: numbers, strings, objects, arrays, booleans,
     * dates. Missing and null values go last in both directions, or first with {nulls: 'first'}
     * (the default comes from the collection options). Strings compare by code point unless a
     * collation is given.
     * @param json sortQuery field => 1 (ascending) or -1 (descending), "a.b" paths allowed
     * @param json options {nulls: 'last' | 'first', collation: {locale, sensitivity, numeric...}} (Intl.Collator options)
     * @return cursor
     */
    sort(sortQuery, options = {}) {
        if(sortQuery === null || typeof sortQuery !== 'object' || Array.isArray(sortQuery))
            throw new Error('The sort query must be an object like {field: 1}');

        const keys = Object.keys(sortQuery);
        for(const key of keys)
        {
            if(sortQuery[key] !== 1 && sortQuery[key] !== -1)
                throw new Error(`Sort direction of "${key}" must be 1 or -1`);
        }

        const nulls = options.nulls ?? this._options.nulls ?? 'last';
        if(nulls !== 'first' && nulls !== 'last')
            throw new Error('options.nulls must be "first" or "last"');

        const collation = options.collation
            ? new Intl.Collator(options.collation.locale, options.collation)
            : null;

        // blanks are placed outside the direction: "last" means last for ascending and descending
        const blankOrder = nulls === 'last' ? 1 : -1;
        this._data.sort((a, b) => {
            for(const key of keys)
            {
                const valueA = a[key];
                const valueB = b[key];
                const blankA = valueA === undefined || valueA === null;
                const blankB = valueB === undefined || valueB === null;
                if(blankA || blankB)
                {
                    if(blankA && blankB) continue;
                    return blankA ? blankOrder : -blankOrder;
                }

                const result = compareValues(valueA, valueB, collation);
                if(result !== 0)
                    return result * sortQuery[key];
            }

            return 0;
        });

        return this;
    }

    /**
     * @get length
     * @description Get the number of elements in the cursor
     * @return number
     */
    get length() {
        return this._data.length;
    }

    /**
     * Projection of the cursor, like MongoDB:
     *   {email: 0}           every field except email
     *   {name: 1, age: 1}    only name and age, plus _id unless {_id: 0}
     * Inclusion and exclusion cannot be mixed, except for _id. Top level fields only.
     * It applies to the copies handed out; the stored documents keep every field.
     * @param json projection
     * @return cursor
     */
    projection(projection) {
        if(projection === null || typeof projection !== 'object')
            return this;

        const fields = Object.keys(projection);
        for(const field of fields)
        {
            if(projection[field] !== 0 && projection[field] !== 1)
                throw new Error(`Projection of "${field}" must be 0 or 1`);

            if(field.includes('.'))
                throw new Error(`Projection supports top level fields only ("${field}")`);
        }

        const included = fields.filter(field => projection[field] === 1 && field !== '_id');
        const excluded = fields.filter(field => projection[field] === 0 && field !== '_id');
        if(included.length && excluded.length)
            throw new Error('Projection cannot mix inclusion and exclusion (except for _id)');

        const keep = new Set(included);
        if(projection._id !== 0) keep.add('_id');
        this._projection = { included, keep, remove: [...excluded, ...(projection._id === 0 ? ['_id'] : [])] };
        return this;
    }

    /**
     * Skips the first documents (apply after sort, like MongoDB applies it)
     * @param int count
     * @return cursor
     */
    skip(count) {
        if(!Number.isInteger(count) || count < 0)
            throw new Error('skip() needs a non negative integer');

        this._data = this._data.slice(count);
        this.currIndex = 0;
        return this;
    }

    /**
     * Keeps at most `count` documents; 0 means no limit, like MongoDB
     * @param int count
     * @return cursor
     */
    limit(count) {
        if(!Number.isInteger(count) || count < 0)
            throw new Error('limit() needs a non negative integer');

        if(count > 0)
            this._data = this._data.slice(0, count);

        this.currIndex = 0;
        return this;
    }

    /**
     * @method push
     * @description Push an element to the cursor
     * @param object element
     * @return void
     */
    push(element) {
        if(typeof element !== 'object')
            throw new Error('The element must be an object');

        this._data.push(element);
    }

    /**
     * Plain copy of a stored document with the projection applied
     * @param Document doc
     * @return object
     */
    _read(doc) {
        const data = this._projection && this._projection.included.length
            ? pick(doc._data, this._projection.keep)
            : doc._data;
        const copy = clone(data);
        if(this._projection && !this._projection.included.length)
        {
            for(const field of this._projection.remove)
                delete copy[field];
        }
        return copy;
    }

    /**
     * Applies the projection to a copied document (next())
     * @param Document copy
     * @return void
     */
    _projectDocument(copy) {
        if(!this._projection)
            return;

        const remove = this._projection.included.length
            ? Object.keys(copy._data).filter(field => !this._projection.keep.has(field))
            : this._projection.remove;

        for(const field of remove)
            copy.deleteProp(field);
    }
}

/**
 * The given top level fields of an object (shallow, the caller copies)
 * @param object data
 * @param Set fields
 * @return object
 */
function pick(data, fields) {
    const picked = {};
    for(const field of fields)
    {
        if(Object.prototype.hasOwnProperty.call(data, field))
            picked[field] = data[field];
    }
    return picked;
}

/**
 * Rank of a value in MongoDB's comparison order (missing and null are handled by sort())
 * @param mixed value
 * @return number
 */
function typeRank(value) {
    if(value === undefined || value === null) return 0;
    if(typeof value === 'number') return 1;
    if(typeof value === 'string') return 2;
    // toString instead of instanceof: Dates from another realm (iframes, workers, vm) still count
    if(Object.prototype.toString.call(value) === '[object Date]') return 6;
    if(Array.isArray(value)) return 4;
    if(typeof value === 'object') return 3;
    if(typeof value === 'boolean') return 5;
    return 7;
}

/**
 * Compares two field values for sorting
 * @param mixed a
 * @param mixed b
 * @param Intl.Collator|null collation
 * @return number -1, 0 or 1
 */
function compareValues(a, b, collation) {
    const rankA = typeRank(a);
    const rankB = typeRank(b);
    if(rankA !== rankB) return rankA < rankB ? -1 : 1;

    switch(rankA) {
        case 0:
            return 0;
        case 2:
            if(collation) return Math.sign(collation.compare(a, b));
            break;
        case 3:
        case 4:
            a = JSON.stringify(a);
            b = JSON.stringify(b);
            break;
        case 6:
            a = a.getTime();
            b = b.getTime();
            break;
    }

    return a < b ? -1 : a > b ? 1 : 0;
}

module.exports = cursor;

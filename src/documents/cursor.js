/**
 * @class Cursor
 * @description Cursor class is used to represent the cursor in the document, adding some extra capabilities to object.
 */


class cursor {
    /**
     * @constructor
     * @param array data
     * @description Create a new cursor instance
     */
    constructor(data, projection) {
        this._data = typeof data === 'undefined' ? [] : data;
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
     * @description Get the next element in the cursor
     * @return mixed
     */
    next() {
        if(!this.hasNext())
            throw new Error('No more item to the cursor');

        return this._data[this.currIndex++];
    }

    /**
     * @method toArray
     * @description Convert the cursor to an array
     * @return array
     */
    toArray() {
        // the documents are proxies, which structuredClone cannot copy: clone their data
        return this._data.map(doc => structuredClone(doc._data));
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
     * @description Get the first element in the cursor
     * @return mixed
     */
    first() {
        return this._data.length ? this._data[0]._data : null;
    }

    /**
     * @method last
     * @description Get the last element in the cursor
     * @return mixed
     */
    last() {
        return this._data.length ? this._data[this._data.length - 1]._data : null;
    }

    /**
     * @method sort
     * @description Sort the documents of the cursor, like MongoDB: {age: -1, name: 1}
     * Values of different types follow MongoDB's order: missing and null, numbers, strings,
     * objects, arrays, booleans, dates. Strings compare by code point unless a collation is given.
     * @param json sortQuery field => 1 (ascending) or -1 (descending), "a.b" paths allowed
     * @param json options {collation: {locale, sensitivity, numeric...}} (Intl.Collator options)
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

        const collation = options.collation
            ? new Intl.Collator(options.collation.locale, options.collation)
            : null;

        this._data.sort((a, b) => {
            for(const key of keys)
            {
                const result = compareValues(a[key], b[key], collation);
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

        this._data.forEach(doc => {
            const remove = included.length
                ? Object.keys(doc._data).filter(field => !keep.has(field))
                : [...excluded, ...(projection._id === 0 ? ['_id'] : [])];

            for(const field of remove)
                doc.deleteProp(field);
        });

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
}

/**
 * Rank of a value in MongoDB's comparison order
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
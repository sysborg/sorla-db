/**
 * @class Cursor
 * @description Cursor class is used to represent the cursor in the document, adding some extra capabilities to object.
 */

const documents = require('../documents/document.js');

class cursor {
    /**
     * @constructor
     * @param array data
     * @description Create a new cursor instance
     */
    constructor(data) {
        this._data = data;
        this.currIndex = 0;
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
        return structuredClone(this._data);
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
        return this._data[0];
    }

    /**
     * @method last
     * @description Get the last element in the cursor
     * @return mixed
     */
    last() {
        return this._data[this._data.length - 1];
    }

    /**
     * @method sort
     * @description Sort the cursor using collection
     * @param json sortQuery
     * @return void
     */
    sort(sortQuery) {
        const queryDoc = new documents(sortQuery);
        this._data.sort((a, b) => {
            for(const key of Object.keys(sortQuery))
            {
                const ascending = queryDoc[key] === 1;
                if(a[key] > b[key])
                    return ascending ? 1 : -1;

                if(a[key] < b[key])
                    return ascending ? -1 : 1;
            }

            return 0;
        });
    }

    /**
     * @get length
     * @description Get the number of elements in the cursor
     * @return number
     */
    get length() {
        return this._data.length;
    }
}

module.exports = cursor;
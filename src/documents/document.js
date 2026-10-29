const utils = require('../utils');

/**
 * A stored document. Fields read like a plain object, including "a.b" paths. Stored documents are
 * read-only from the outside; find() returns copies (clone()) whose fields projection can remove.
 * This module requires no other document or query module, which keeps the require graph acyclic.
 */
class documents
{
    constructor(object)
    {
        this._data = object;
        this._utils = new utils();
        this._cloned = false;

        return new Proxy(this, {
            deleteProperty: (target, prop) => {
                if(target._cloned && prop in target._data)
                {
                    delete target._data[prop];
                    return true;
                }

                return false;
            },

            get: (target, prop) => {
                // symbols (Symbol.toPrimitive, Symbol.iterator...) belong to the wrapper, not to the data
                if(typeof prop !== 'string')
                    return target[prop];

                if(prop.indexOf('.') > -1)
                    return target._utils.getDotData(target._data, prop);

                if(prop in target._data)
                    return target._data[prop];

                return target[prop];
            },

            set: (target, prop, value) => {
                if(prop === '_cloned')
                {
                    target._cloned = value;
                    return true;
                }

                if(typeof prop === 'string' && prop in target._data)
                    throw new Error(`Document fields are read-only ("${prop}"), change documents through the collection`);

                return false;
            }
        });
    }

    /**
     * @method clone
     * @description Clone the document
     * @return Document
     */
    clone()
    {
        const cloned = new documents(structuredClone(this._data));
        cloned._cloned = true;
        return cloned;
    }

    /**
     * @method delete prop
     * @description Delete a property from a copy returned by find() (used by projection)
     * @param string prop
     * @return boolean
     */
    deleteProp(prop)
    {
        if(!this._cloned)
            return false;

        return Reflect.deleteProperty(this, prop);
    }
}


module.exports = documents;
const utils = require('../utils');
const cursor = require('./cursor');

class documents
{
    constructor(object)
    {
        this._data = object;
        this._utils = new utils();
        this._cloned = false;

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if(prop.indexOf('.') > -1)
                    return target._utils.getDotData(target._data, prop);

                if(prop in target._data)
                    return target._data[prop];

                return target[prop];
            },

            set: (target, prop, value, receiver) => {
                if(this._data.hasOwnProperty(prop))
                {
                    if(
                        receiver instanceof manipulation || 
                        (target._cloned && receiver instanceof cursor)
                    ) {
                        if(prop in target._data)
                        {
                            target._data[prop] = value;
                            return true;
                        }

                        return false;
                    }

                    return false;
                }

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
        const cloned = Object.assign({}, this);
        cloned._clone = true;
        return cloned;
    }
}


module.exports = documents;
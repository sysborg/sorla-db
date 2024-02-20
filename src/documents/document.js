const utils = require('../utils');
const cursor = require('./cursor');
const manipulation = require('../query_language/manipulation');

class documents
{
    constructor(object)
    {
        this._data = object;
        this._utils = new utils();
        this._cloned = false;
        this._deleteReceiver = null;

        return new Proxy(this, {
            deleteProperty: (target, prop, receiver) => {
                if(target._cloned && target._deleteReceiver instanceof cursor)
                {
                    if(prop in target._data)
                    {
                        console.log('2', prop);
                        delete target._data[prop];
                        return true;
                    }

                    return false;
                }
            },

            get: (target, prop) => {
                if(prop.indexOf('.') > -1)
                    return target._utils.getDotData(target._data, prop);

                if(prop in target._data)
                    return target._data[prop];

                return target[prop];
            },

            set: (target, prop, value, receiver) => {
                if(!(prop in target._data) && !target.hasOwnProperty(prop))
                    return false;

                if(target.hasOwnProperty(prop) && ['_data', '_utils'].indexOf(prop) === -1){
                    target[prop] = value;
                    return true;
                }

                if(receiver instanceof manipulation || target._cloned && receiver instanceof cursor) {
                    target._data[prop] = value;
                    return true;
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
        const cloned = new documents(structuredClone(this._data));
        cloned._cloned = true;
        return cloned;
    }

    /**
     * @method delete prop
     * @description Delete a property from the document
     * @param string prop
     * @param cursor receiver
     * @return boolean
     */
    deleteProp(prop, receiver)
    {
        this._deleteReceiver = receiver;
        if(this._cloned)
            return Reflect.deleteProperty(this, prop);

        return false;
    }
}


module.exports = documents;
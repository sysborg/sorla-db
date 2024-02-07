const utils = require('../utils');

class documents
{
    constructor(object)
    {
        this._data = object;
        this._utils = new utils();

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if(prop.indexOf('.') > -1)
                    return target._utils.getDotData(target._data, prop);

                if(prop in target._data)
                    return target._data[prop];

                return target[prop];
            },

            set: (target, prop, value, receiver) => {
                console.log(receiver);
                if(receiver instanceof manipulation)
                {
                    if(prop in target._data)
                    {
                        target._data[prop] = value;
                        return true;
                    }

                    return false;
                }

                return false;
            }
        });
    }
}


module.exports = documents;
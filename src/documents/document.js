class documents
{
    constructor(object)
    {
        this._data = object;

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if(prop in target._data)
                {
                    return target._data[prop];
                }

                return target[prop];
            },
            
            set: (target, prop, value) => {
                console.log(prop, value, target);
                /*if(prop in target._data)
                {
                    target._data[prop] = value;
                }

                return true;*/
            }
        });
    }
}


module.exports = documents;
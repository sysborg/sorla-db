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
            }
        });
    }
}


module.exports = documents;
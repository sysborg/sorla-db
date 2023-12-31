class documents
{
    constructor(object)
    {
        this._data = object;
    }

    /**
     * Returns the id of the document
     * @return string
     */
    get _id()
    {
        return this._data._id;
    }
}


module.exports = documents;
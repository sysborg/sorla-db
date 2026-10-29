/**
 * Applies rows sent by a server (SSE blocks, WebSocket pages and pushes) to a collection with one
 * bulkWrite: rows whose _id exists replace the stored document (so a block sent again after a
 * reconnection does not fail on duplicated ids), the others are inserted.
 */

/**
 * @param collection collection
 * @param array rows
 * @param string mode 'upsert' (default) or 'insert' (duplicated ids are errors)
 * @return object bulkWrite result
 */
function applyRows(collection, rows, mode = 'upsert')
{
    if(!Array.isArray(rows))
        throw new Error('Rows must be an array of documents');

    const ids = collection._ids();
    const operations = rows.map(row => mode === 'upsert' && row && typeof row === 'object' && row._id !== undefined && ids.has(row._id)
        ? { replaceOne: { filter: { _id: row._id }, replacement: row } }
        : { insertOne: { document: row } });

    // one bad row must not drop the rest of a block
    return collection.bulkWrite(operations, { ordered: false });
}

/**
 * Applies a server message that changes data: rows, bulkWrite operations or deleted ids
 * @param collection collection
 * @param string type 'rows' | 'ops' | 'delete'
 * @param mixed data
 * @param string mode
 * @return object|null result, or null when the type is not a data change
 */
function applyChange(collection, type, data, mode)
{
    switch(type) {
        case 'rows':
            return applyRows(collection, Array.isArray(data) ? data : data.rows, mode);
        case 'ops':
            return collection.bulkWrite(Array.isArray(data) ? data : data.ops, { ordered: false });
        case 'delete': {
            const ids = Array.isArray(data) ? data : data.ids;
            return collection.deleteMany({ _id: { $in: ids } });
        }
        default:
            return null;
    }
}

/**
 * Number of rows a data message carries (for progress)
 * @param string type
 * @param mixed data
 * @return number
 */
function rowCount(type, data)
{
    if(type !== 'rows') return 0;
    const rows = Array.isArray(data) ? data : data && data.rows;
    return Array.isArray(rows) ? rows.length : 0;
}

module.exports = { applyRows, applyChange, rowCount };

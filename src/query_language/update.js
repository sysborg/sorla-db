/**
 * Update operators: $set, $unset, $inc, $push and $pull, with "a.b" paths.
 * Updates are applied to a copy of the document, so a failing operator never leaves it half updated.
 */
const UPDATE_OPERATORS = ['$set', '$unset', '$inc', '$push', '$pull'];

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.toString.call(value) === '[object Object]';

function splitPath(path)
{
    if(typeof path !== 'string' || path === '' || path.split('.').some(part => part === ''))
        throw new Error(`Invalid field path "${path}"`);

    if(path === '_id' || path.startsWith('_id.'))
        throw new Error('The _id field cannot be updated');

    return path.split('.');
}

function getPath(data, parts)
{
    let value = data;
    for(const part of parts)
    {
        if(value === null || typeof value !== 'object' || !(part in value))
            return undefined;

        value = value[part];
    }
    return value;
}

/**
 * Parent object of a path, creating missing objects on the way
 */
function parentOf(data, parts, create)
{
    let target = data;
    for(const part of parts.slice(0, -1))
    {
        if(!(part in target))
        {
            if(!create) return null;
            target[part] = {};
        }

        if(target[part] === null || typeof target[part] !== 'object')
            throw new Error(`Cannot create the field "${parts.join('.')}": "${part}" is not an object`);

        target = target[part];
    }
    return target;
}

/**
 * Validates an update document
 * @param object update
 * @return void
 */
function validateUpdate(update)
{
    if(!isPlainObject(update))
        throw new Error('The update must be an object like {$set: {field: value}}');

    const keys = Object.keys(update);
    if(!keys.length)
        throw new Error('The update must contain at least one operator');

    for(const key of keys)
    {
        if(!key.startsWith('$'))
            throw new Error(`The update can only contain operators, use replaceOne() to replace a document (found "${key}")`);

        if(!UPDATE_OPERATORS.includes(key))
            throw new Error(`Unknown update operator ${key}`);

        if(!isPlainObject(update[key]))
            throw new Error(`The ${key} operator must be an object like {${key}: {field: value}}`);
    }
}

/**
 * Applies an update to a copy of the data
 * @param object data stored document data
 * @param object update
 * @param object helpers {copy(value), validateKeys(object), operators}
 * @return object the updated copy
 */
function applyUpdate(data, update, helpers)
{
    validateUpdate(update);
    const result = helpers.copy(data);

    for(const [path, value] of Object.entries(update.$set ?? {}))
    {
        const parts = splitPath(path);
        if(value !== null && typeof value === 'object' && !helpers.validateKeys(Array.isArray(value) ? { value } : value))
            throw new Error('Invalid document keys');

        parentOf(result, parts, true)[parts.at(-1)] = helpers.copy(value);
    }

    for(const path of Object.keys(update.$unset ?? {}))
    {
        const parts = splitPath(path);
        const parent = parentOf(result, parts, false);
        if(parent && !Array.isArray(parent))
            delete parent[parts.at(-1)];
    }

    for(const [path, amount] of Object.entries(update.$inc ?? {}))
    {
        const parts = splitPath(path);
        if(typeof amount !== 'number' || !Number.isFinite(amount))
            throw new Error(`$inc needs a number for "${path}"`);

        const current = getPath(result, parts);
        if(current !== undefined && typeof current !== 'number')
            throw new Error(`Cannot $inc "${path}": it is not a number`);

        parentOf(result, parts, true)[parts.at(-1)] = (current ?? 0) + amount;
    }

    for(const [path, value] of Object.entries(update.$push ?? {}))
    {
        const parts = splitPath(path);
        const current = getPath(result, parts);
        if(current !== undefined && !Array.isArray(current))
            throw new Error(`Cannot $push to "${path}": it is not an array`);

        const items = isPlainObject(value) && Array.isArray(value.$each) ? value.$each : [value];
        for(const item of items)
        {
            if(item !== null && typeof item === 'object' && !helpers.validateKeys(Array.isArray(item) ? { item } : item))
                throw new Error('Invalid document keys');
        }
        parentOf(result, parts, true)[parts.at(-1)] = [...(current ?? []), ...items.map(helpers.copy)];
    }

    for(const [path, condition] of Object.entries(update.$pull ?? {}))
    {
        const parts = splitPath(path);
        const current = getPath(result, parts);
        if(current === undefined)
            continue;

        if(!Array.isArray(current))
            throw new Error(`Cannot $pull from "${path}": it is not an array`);

        const { operators } = helpers;
        const matches = item => {
            if(operators.isRegExp(condition) || operators.isOperatorObject(condition))
                return operators.matchesCondition(item, condition);

            if(isPlainObject(condition))
                return isPlainObject(item) && operators.matches(item, condition);

            return item === condition;
        };
        parentOf(result, parts, false)[parts.at(-1)] = current.filter(item => !matches(item));
    }

    return result;
}

module.exports = { applyUpdate, validateUpdate, UPDATE_OPERATORS };

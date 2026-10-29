/**
 * Deep copy of document values. Uses structuredClone when the environment has it and a small
 * equivalent otherwise (older browsers, jsdom pages), so copying never depends on the host.
 * Functions, DOM nodes and other non cloneable values throw a DataCloneError-like error.
 */
function fallbackClone(value, seen = new Map())
{
    if(value === null || typeof value !== 'object')
    {
        if(typeof value === 'function' || typeof value === 'symbol')
            throw cloneError(value);

        return value;
    }

    if(seen.has(value))
        return seen.get(value);

    const tag = Object.prototype.toString.call(value);
    let copy;
    switch(tag)
    {
        case '[object Date]':
            return new Date(value.getTime());
        case '[object RegExp]':
            return new RegExp(value.source, value.flags);
        case '[object Array]':
            copy = [];
            seen.set(value, copy);
            for(const item of value) copy.push(fallbackClone(item, seen));
            return copy;
        case '[object Map]':
            copy = new Map();
            seen.set(value, copy);
            for(const [key, item] of value) copy.set(fallbackClone(key, seen), fallbackClone(item, seen));
            return copy;
        case '[object Set]':
            copy = new Set();
            seen.set(value, copy);
            for(const item of value) copy.add(fallbackClone(item, seen));
            return copy;
        case '[object Object]':
            copy = {};
            seen.set(value, copy);
            for(const key of Object.keys(value)) copy[key] = fallbackClone(value[key], seen);
            return copy;
    }

    throw cloneError(value);
}

function cloneError(value)
{
    const error = new Error(`${Object.prototype.toString.call(value)} could not be cloned`);
    error.name = 'DataCloneError';
    return error;
}

function clone(value)
{
    if(typeof structuredClone === 'function')
        return structuredClone(value);

    return fallbackClone(value);
}

module.exports = { clone, fallbackClone };

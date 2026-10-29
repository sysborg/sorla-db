/**
 * Document validation with a subset of JSON Schema.
 *
 *   {
 *     type: 'object',
 *     required: ['name', 'email'],
 *     additionalProperties: false,
 *     properties: {
 *       name: { type: 'string', minLength: 2, maxLength: 80 },
 *       email: { type: 'string', format: 'email' },
 *       age: { type: ['integer', 'null'], minimum: 0 },
 *       role: { enum: ['admin', 'user'], default: 'user' },
 *       tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
 *       address: { type: 'object', properties: { zip: { type: 'string', pattern: '^\\d{5}-\\d{3}$' } } }
 *     }
 *   }
 *
 * Extension: type 'date' accepts Date objects (like MongoDB's bsonType 'date').
 * A function schema is also accepted: doc => true | 'message' | ['message', ...] | false.
 */
const TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null', 'date'];
const FORMATS = ['email', 'date', 'date-time', 'uri'];
const KEYWORDS = new Set([
    'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'default',
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'pattern',
    'format', 'minItems', 'maxItems', 'uniqueItems', 'title', 'description', '$schema', '$id', 'examples'
]);

class ValidationError extends Error
{
    /**
     * @param array errors [{path, rule, message}]
     */
    constructor(errors)
    {
        const first = errors[0];
        super(errors.length === 1
            ? `Invalid document: ${first.message}`
            : `Invalid document: ${first.message} (and ${errors.length - 1} more)`);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

const isPlainObject = value => Object.prototype.toString.call(value) === '[object Object]';
const isDate = value => Object.prototype.toString.call(value) === '[object Date]';

function typeOf(value)
{
    if(value === null) return 'null';
    if(Array.isArray(value)) return 'array';
    if(isDate(value)) return 'date';
    if(typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if(isPlainObject(value)) return 'object';
    return typeof value;
}

function matchesType(value, type)
{
    const actual = typeOf(value);
    if(type === 'number') return actual === 'number' || actual === 'integer';
    return actual === type;
}

const FORMAT_TESTS = {
    email: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    date: value => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if(!match) return false;
        const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
        return date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3];
    },
    'date-time': value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value) && !isNaN(Date.parse(value)),
    uri: value => {
        try {
            return Boolean(new URL(value).protocol);
        } catch(error) {
            return false;
        }
    }
};

/**
 * Checks the schema itself, so typos fail when the schema is set instead of being ignored
 * @param object schema
 * @param string path
 * @return void
 */
function checkSchema(schema, path = 'schema')
{
    if(!isPlainObject(schema))
        throw new Error(`${path} must be an object`);

    for(const key of Object.keys(schema))
    {
        if(!KEYWORDS.has(key))
            throw new Error(`${path}: unknown keyword "${key}"`);
    }

    const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
    for(const type of types)
    {
        if(!TYPES.includes(type))
            throw new Error(`${path}: unknown type "${type}" (use ${TYPES.join(', ')})`);
    }

    if(schema.format !== undefined && !FORMATS.includes(schema.format))
        throw new Error(`${path}: unknown format "${schema.format}" (use ${FORMATS.join(', ')})`);

    if(schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some(name => typeof name !== 'string')))
        throw new Error(`${path}: required must be an array of field names`);

    if(schema.enum !== undefined && !Array.isArray(schema.enum))
        throw new Error(`${path}: enum must be an array`);

    if(schema.pattern !== undefined)
    {
        try {
            new RegExp(schema.pattern);
        } catch(error) {
            throw new Error(`${path}: invalid pattern (${error.message})`);
        }
    }

    for(const key of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems'])
    {
        if(schema[key] !== undefined && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key])))
            throw new Error(`${path}: ${key} must be a number`);
    }

    if(schema.properties !== undefined)
    {
        if(!isPlainObject(schema.properties))
            throw new Error(`${path}: properties must be an object`);

        for(const [name, child] of Object.entries(schema.properties))
            checkSchema(child, `${path}.properties.${name}`);
    }

    if(schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean')
        checkSchema(schema.additionalProperties, `${path}.additionalProperties`);

    if(schema.items !== undefined)
        checkSchema(schema.items, `${path}.items`);
}

const describe = value => {
    if(typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
    if(isDate(value)) return value.toISOString();
    return JSON.stringify(value);
};

const same = (a, b) => {
    if(isDate(a) && isDate(b)) return a.getTime() === b.getTime();
    return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Validates a value against a schema
 * @param mixed value
 * @param object schema
 * @param string path field path for error messages ('' for the document)
 * @param array errors collected errors
 * @return array errors
 */
function validateValue(value, schema, path = '', errors = [])
{
    const label = path || 'document';
    const add = (rule, message) => errors.push({ path, rule, message: `${label} ${message}` });

    if(schema.type !== undefined)
    {
        const types = Array.isArray(schema.type) ? schema.type : [schema.type];
        if(!types.some(type => matchesType(value, type)))
        {
            add('type', `must be ${types.join(' or ')} (got ${typeOf(value)})`);
            return errors;
        }
    }

    if(schema.enum !== undefined && !schema.enum.some(option => same(option, value)))
        add('enum', `must be one of ${schema.enum.map(describe).join(', ')}`);

    if(schema.const !== undefined && !same(schema.const, value))
        add('const', `must be ${describe(schema.const)}`);

    if(typeof value === 'number')
    {
        if(schema.minimum !== undefined && value < schema.minimum) add('minimum', `must be >= ${schema.minimum}`);
        if(schema.maximum !== undefined && value > schema.maximum) add('maximum', `must be <= ${schema.maximum}`);
        if(schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) add('exclusiveMinimum', `must be > ${schema.exclusiveMinimum}`);
        if(schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) add('exclusiveMaximum', `must be < ${schema.exclusiveMaximum}`);
    }

    if(typeof value === 'string')
    {
        // count characters, not UTF-16 units, so emoji and accents count once
        const length = [...value].length;
        if(schema.minLength !== undefined && length < schema.minLength) add('minLength', `must have at least ${schema.minLength} characters`);
        if(schema.maxLength !== undefined && length > schema.maxLength) add('maxLength', `must have at most ${schema.maxLength} characters`);
        if(schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) add('pattern', `must match ${schema.pattern}`);
        if(schema.format !== undefined && !FORMAT_TESTS[schema.format](value)) add('format', `must be a valid ${schema.format}`);
    }

    if(Array.isArray(value))
    {
        if(schema.minItems !== undefined && value.length < schema.minItems) add('minItems', `must have at least ${schema.minItems} items`);
        if(schema.maxItems !== undefined && value.length > schema.maxItems) add('maxItems', `must have at most ${schema.maxItems} items`);
        if(schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) add('uniqueItems', 'must not have repeated items');
        if(schema.items !== undefined)
            value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`, errors));
    }

    if(isPlainObject(value))
    {
        const properties = schema.properties ?? {};
        const child = name => path ? `${path}.${name}` : name;

        for(const name of schema.required ?? [])
        {
            if(value[name] === undefined)
                errors.push({ path: child(name), rule: 'required', message: `${child(name)} is required` });
        }

        for(const [name, fieldValue] of Object.entries(value))
        {
            if(fieldValue === undefined)
                continue;

            if(properties[name] !== undefined)
            {
                validateValue(fieldValue, properties[name], child(name), errors);
            }
            else if(!(path === '' && name === '_id'))
            {
                // _id is always allowed on documents
                if(schema.additionalProperties === false)
                    errors.push({ path: child(name), rule: 'additionalProperties', message: `${child(name)} is not allowed` });
                else if(isPlainObject(schema.additionalProperties))
                    validateValue(fieldValue, schema.additionalProperties, child(name), errors);
            }
        }
    }

    return errors;
}

/**
 * Fills missing fields that declare a default (recursively for objects present in the document)
 * @param mixed value
 * @param object schema
 * @param function copy
 * @return void
 */
function applyDefaults(value, schema, copy)
{
    if(!isPlainObject(value) || !isPlainObject(schema.properties))
        return;

    for(const [name, child] of Object.entries(schema.properties))
    {
        if(value[name] === undefined && child.default !== undefined)
            value[name] = copy(child.default);

        if(value[name] !== undefined)
            applyDefaults(value[name], child, copy);
    }
}

/**
 * Compiles a schema (JSON Schema subset or a function) into a validator
 * @param object|function schema
 * @return object {validate(doc): errors, applyDefaults(doc, copy), source}
 */
function compileSchema(schema)
{
    if(typeof schema === 'function')
    {
        return {
            source: schema,
            applyDefaults: () => {},
            validate: doc => {
                const result = schema(doc);
                if(result === true || result === undefined || result === null) return [];
                if(result === false) return [{ path: '', rule: 'custom', message: 'document is invalid' }];
                const messages = Array.isArray(result) ? result : [result];
                return messages.map(message => typeof message === 'string'
                    ? { path: '', rule: 'custom', message }
                    : { path: '', rule: 'custom', ...message });
            }
        };
    }

    const root = { type: 'object', ...schema };
    checkSchema(root);
    if(root.type !== 'object')
        throw new Error('schema: a document schema must be of type "object"');

    return {
        source: schema,
        validate: doc => validateValue(doc, root),
        applyDefaults: (doc, copy) => applyDefaults(doc, root, copy)
    };
}

module.exports = { compileSchema, ValidationError, validateValue, checkSchema };

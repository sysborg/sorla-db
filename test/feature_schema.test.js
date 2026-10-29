const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')
const { compileSchema } = require('../src/schema/schema.js')

const userSchema = {
    required: ['name', 'email'],
    additionalProperties: false,
    properties: {
        name: { type: 'string', minLength: 2, maxLength: 20 },
        email: { type: 'string', format: 'email' },
        age: { type: ['integer', 'null'], minimum: 0, maximum: 130 },
        role: { enum: ['admin', 'user'], default: 'user' },
        tags: { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 3, default: [] },
        born: { type: 'string', format: 'date' },
        site: { type: 'string', format: 'uri' },
        createdAt: { type: 'date' },
        address: {
            type: 'object',
            required: ['zip'],
            properties: {
                zip: { type: 'string', pattern: '^\\d{5}-\\d{3}$' },
                country: { type: 'string', default: 'BR' }
            }
        }
    }
};

let counter = 0;
function users(schema = userSchema) {
    const srla = new sorla();
    srla.useDb(`schema${++counter}`);
    srla.db.createCollection('users', schema);
    return srla.db.users;
}
const errorsOf = fn => {
    try {
        fn();
    } catch(error) {
        expect(error).to.be.instanceOf(sorla.ValidationError);
        return error.errors.map(e => `${e.path}:${e.rule}`);
    }
    throw new Error('expected a ValidationError');
};

describe('SORLA schema validation on insert', () => {
    it('accepts valid documents and fills defaults, also nested ones', () => {
        const c = users();
        const id = c.insertOne({ name: 'Ana', email: 'ana@mail.com', address: { zip: '14000-000' }, createdAt: new Date('2026-01-01') });
        expect(c.findOne({ _id: id })).to.deep.include({ role: 'user', tags: [] });
        expect(c.findOne({ _id: id }).address).to.deep.equal({ zip: '14000-000', country: 'BR' });
    });

    it('reports every problem with its field path', () => {
        const c = users();
        expect(errorsOf(() => c.insertOne({
            name: 'A', email: 'not-an-email', age: 1.5, role: 'root', tags: ['x', 'x', 2, 'y'],
            born: '2026-02-30', site: 'nota url', address: { zip: '123' }, extra: true
        }))).to.deep.equal([
            'name:minLength', 'email:format', 'age:type', 'role:enum', 'tags:maxItems', 'tags:uniqueItems',
            'tags[2]:type', 'born:format', 'site:format', 'address.zip:pattern', 'extra:additionalProperties'
        ]);
        expect(c.count()).to.equal(0);
    });

    it('required fields, also inside nested objects', () => {
        const c = users();
        expect(errorsOf(() => c.insertOne({ address: {} }))).to.deep.equal(['name:required', 'email:required', 'address.zip:required']);
    });

    it('messages are readable', () => {
        const c = users();
        try {
            c.insertOne({ name: 'Ana', email: 'ana@mail.com', age: -1 });
        } catch(error) {
            expect(error.message).to.equal('Invalid document: age must be >= 0');
            expect(error.errors).to.deep.equal([{ path: 'age', rule: 'minimum', message: 'age must be >= 0' }]);
        }
    });

    it('insertMany validates the whole batch first', () => {
        const c = users();
        expect(errorsOf(() => c.insertMany([
            { name: 'Ana', email: 'ana@mail.com' },
            { name: 'Bia', email: 'bad' }
        ]))).to.deep.equal(['email:format']);
        expect(c.count(), 'nothing inserted').to.equal(0);
        expect(c.insertMany([{ name: 'Ana', email: 'a@mail.com' }, { name: 'Bia', email: 'b@mail.com' }]).length).to.equal(2);
    });

    it('_id is always allowed, null matches the null type', () => {
        const c = users();
        expect(() => c.insertOne({ _id: 'u1', name: 'Ana', email: 'a@mail.com', age: null })).to.not.throw();
    });

    it('counts characters, not UTF-16 units', () => {
        const c = users({ properties: { emoji: { type: 'string', maxLength: 2 } } });
        expect(() => c.insertOne({ emoji: '😀😀' })).to.not.throw();
        expect(errorsOf(() => c.insertOne({ emoji: '😀😀😀' }))).to.deep.equal(['emoji:maxLength']);
    });
});

describe('SORLA schema validation on updates', () => {
    it('validates the updated document and leaves everything untouched on failure', () => {
        const c = users();
        c.insertMany([{ _id: 'a', name: 'Ana', email: 'a@mail.com', age: 20 }, { _id: 'b', name: 'Bia', email: 'b@mail.com', age: 130 }]);
        expect(errorsOf(() => c.updateMany({}, { $inc: { age: 1 } }))).to.deep.equal(['age:maximum']);
        expect(c.findOne({ _id: 'a' }).age, 'atomic: no document changed').to.equal(20);
        expect(errorsOf(() => c.updateOne({ _id: 'a' }, { $unset: { email: '' } }))).to.deep.equal(['email:required']);
        expect(errorsOf(() => c.updateOne({ _id: 'a' }, { $set: { nick: 'x' } }))).to.deep.equal(['nick:additionalProperties']);
        expect(c.updateOne({ _id: 'a' }, { $set: { age: 21 } }).modifiedCount).to.equal(1);
    });

    it('replaceOne and upserts are validated too', () => {
        const c = users();
        c.insertOne({ _id: 'a', name: 'Ana', email: 'a@mail.com' });
        expect(errorsOf(() => c.replaceOne({ _id: 'a' }, { name: 'Ana' }))).to.deep.equal(['email:required']);
        expect(errorsOf(() => c.updateOne({ email: 'new@mail.com' }, { $set: { name: 'X' } }, { upsert: true }))).to.deep.equal(['name:minLength']);
        const result = c.updateOne({ email: 'new@mail.com' }, { $set: { name: 'New' } }, { upsert: true });
        expect(c.findOne({ _id: result.upsertedId }).role, 'defaults apply to upserts').to.equal('user');
    });
});

describe('SORLA schema API', () => {
    it('validate() checks a document without storing it', () => {
        const c = users();
        expect(c.validate({ name: 'Ana', email: 'a@mail.com' })).to.deep.equal({ valid: true, errors: [] });
        const result = c.validate({ name: 'Ana' });
        expect(result.valid).to.equal(false);
        expect(result.errors[0]).to.deep.equal({ path: 'email', rule: 'required', message: 'email is required' });
        expect(c.count()).to.equal(0);
    });

    it('setSchema / getSchema; collections without schema accept anything', () => {
        const srla = new sorla();
        srla.useDb('noSchema');
        srla.db.createCollection('free');
        expect(srla.db.free.getSchema()).to.equal(null);
        expect(srla.db.free.validate({ anything: 1 }).valid).to.equal(true);
        srla.db.free.insertOne({ anything: 1 });
        srla.db.free.setSchema({ required: ['name'] });
        expect(srla.db.free.getSchema()).to.deep.equal({ required: ['name'] });
        expect(() => srla.db.free.insertOne({ anything: 2 })).to.throw(sorla.ValidationError);
        expect(srla.db.free.count(), 'existing documents are not revalidated').to.equal(1);
        srla.db.free.setSchema(null);
        expect(() => srla.db.free.insertOne({ anything: 3 })).to.not.throw();
    });

    it('function schemas return true, a message, a list or false', () => {
        const c = users(doc => doc.total >= 0 || 'total must not be negative');
        expect(() => c.insertOne({ total: 1 })).to.not.throw();
        expect(errorsOf(() => c.insertOne({ total: -1 }))).to.deep.equal([':custom']);
        const many = users(doc => ['a is wrong', { path: 'b', message: 'b is wrong' }]);
        expect(errorsOf(() => many.insertOne({}))).to.deep.equal([':custom', 'b:custom']);
        const no = users(() => false);
        expect(() => no.insertOne({})).to.throw('document is invalid');
    });

    it('invalid schemas fail when they are set', () => {
        const srla = new sorla();
        srla.useDb('badSchemas');
        expect(() => srla.db.createCollection('a', { properties: { name: { tpye: 'string' } } })).to.throw('unknown keyword "tpye"');
        expect(() => srla.db.createCollection('b', { properties: { name: { type: 'text' } } })).to.throw('unknown type "text"');
        expect(() => srla.db.createCollection('c', { properties: { name: { format: 'phone' } } })).to.throw('unknown format "phone"');
        expect(() => srla.db.createCollection('d', { required: 'name' })).to.throw('required must be an array');
        expect(() => srla.db.createCollection('e', { properties: { a: { pattern: '(' } } })).to.throw('invalid pattern');
        expect(() => srla.db.createCollection('f', { type: 'array' })).to.throw('must be of type "object"');
        expect(() => srla.db.createCollection('g', 'name')).to.throw('must be an object (JSON Schema) or a function');
        expect(() => srla.db.createCollection('h', { properties: { n: { minimum: '1' } } })).to.throw('minimum must be a number');
    });
});

describe('SORLA schema keywords', () => {
    const check = (schema, value) => compileSchema({ properties: { v: schema } }).validate({ v: value }).map(e => e.rule);

    it('number, integer and ranges', () => {
        expect(check({ type: 'number' }, 1.5)).to.deep.equal([]);
        expect(check({ type: 'number' }, 2)).to.deep.equal([], 'integers are numbers');
        expect(check({ type: 'integer' }, 1.5)).to.deep.equal(['type']);
        expect(check({ exclusiveMinimum: 0, exclusiveMaximum: 10 }, 0)).to.deep.equal(['exclusiveMinimum']);
        expect(check({ exclusiveMinimum: 0, exclusiveMaximum: 10 }, 10)).to.deep.equal(['exclusiveMaximum']);
    });

    it('const, enum with objects, booleans and dates', () => {
        expect(check({ const: 'x' }, 'y')).to.deep.equal(['const']);
        expect(check({ enum: [{ a: 1 }, 2] }, { a: 1 })).to.deep.equal([]);
        expect(check({ type: 'boolean' }, 'true')).to.deep.equal(['type']);
        expect(check({ type: 'date' }, '2026-01-01')).to.deep.equal(['type']);
        expect(check({ type: 'date' }, new Date())).to.deep.equal([]);
        expect(check({ type: 'string', format: 'date-time' }, '2026-10-29T10:30:00Z')).to.deep.equal([]);
        expect(check({ type: 'string', format: 'date-time' }, '2026-10-29 10:30')).to.deep.equal(['format']);
    });

    it('additionalProperties as a schema and minItems', () => {
        const schema = { type: 'object', additionalProperties: { type: 'number' } };
        expect(check(schema, { a: 1, b: 2 })).to.deep.equal([]);
        expect(check(schema, { a: 'x' })).to.deep.equal(['type']);
        expect(check({ type: 'array', minItems: 2 }, [1])).to.deep.equal(['minItems']);
    });

    it('annotations are allowed', () => {
        expect(() => compileSchema({ $schema: 'x', title: 'User', description: 'A user', properties: { a: { examples: [1] } } })).to.not.throw();
    });
});

/**
 * Compares find() against a straightforward reference implementation of the query semantics,
 * over hand written queries and hundreds of randomly generated nested ones (seeded, so a failure
 * always reproduces). This catches logic bugs, not just crashes.
 */
const chai = require('chai')
const expect = chai.expect
const sorla = require('../src/sorla.js')

// deterministic PRNG (mulberry32)
function prng(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const NAMES = ['Ana', 'Bruno', 'Carla', 'Davi', 'Eva', 'Fábio'];
const CITIES = ['A', 'B', 'C', 'D'];
const TAGS = ['admin', 'dev', 'ops'];

function buildDocuments(random, count) {
    const pick = list => list[Math.floor(random() * list.length)];
    return Array.from({ length: count }, (_, n) => {
        const doc = { n, name: pick(NAMES), city: pick(CITIES), score: Math.round(random() * 1000) / 10, active: random() > 0.5 };
        if(random() > 0.15) doc.age = 18 + Math.floor(random() * 50);          // sometimes missing
        if(random() > 0.3) doc.tags = TAGS.filter(() => random() > 0.5);       // array, sometimes missing
        // nickname is often missing; null values cannot be stored yet (see feature_insert.test.js)
        if(random() > 0.5) doc.nickname = pick(NAMES);
        return doc;
    });
}

// ---- reference semantics, written independently of src/
const compare = {
    $eq: (v, q) => !Array.isArray(q) && v === q,
    $ne: (v, q) => !Array.isArray(q) && v !== q,
    $gt: (v, q) => !Array.isArray(q) && v > q,
    $gte: (v, q) => !Array.isArray(q) && v >= q,
    $lt: (v, q) => !Array.isArray(q) && v < q,
    $lte: (v, q) => !Array.isArray(q) && v <= q,
    $in: (v, q) => Array.isArray(v) ? v.some(item => q.includes(item)) : q.includes(v),
    $nin: (v, q) => !(Array.isArray(v) ? v.some(item => q.includes(item)) : q.includes(v)),
    $exists: (v, q) => (v !== undefined) === q
};

function refRegex(value, pattern, options) {
    const regex = new RegExp(pattern, options);
    const test = item => typeof item === 'string' && regex.test(item);
    return Array.isArray(value) ? value.some(test) : test(value);
}

function refCondition(value, condition) {
    const isOps = condition !== null && typeof condition === 'object' && !Array.isArray(condition)
        && Object.keys(condition).length > 0 && Object.keys(condition).every(k => k.startsWith('$'));
    if(!isOps) return value === condition;
    return Object.entries(condition).every(([op, arg]) => {
        if(op === '$not') return !refCondition(value, arg);
        if(op === '$options') return true;
        if(op === '$regex') return refRegex(value, arg, condition.$options);
        return compare[op](value, arg);
    });
}

function refMatch(doc, query) {
    return Object.entries(query).every(([key, value]) => {
        if(key === '$and') return value.every(q => refMatch(doc, q));
        if(key === '$or') return value.some(q => refMatch(doc, q));
        if(key === '$nor') return !value.some(q => refMatch(doc, q));
        return refCondition(doc[key], value);
    });
}

// ---- random nested queries
function randomQueryGenerator(random) {
    const pick = list => list[Math.floor(random() * list.length)];
    const fields = {
        name: () => pick(NAMES),
        city: () => pick(CITIES),
        age: () => 18 + Math.floor(random() * 50),
        score: () => Math.round(random() * 1000) / 10,
        active: () => random() > 0.5,
        tags: () => pick(TAGS),
        nickname: () => random() > 0.3 ? pick(NAMES) : null
    };

    function condition(field) {
        const value = fields[field];
        const roll = random();
        if(roll < 0.2) return value();                                            // plain equality
        const ops = {};
        const count = 1 + Math.floor(random() * 2);
        for(let i = 0; i < count; i++) {
            const op = pick(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$exists', '$regex']);
            if(op === '$exists') ops.$exists = random() > 0.5;
            else if(op === '$regex') {
                ops.$regex = pick(['^a', 'n', 'o$', '^[b-d]', 'e', 'dm']);
                if(random() > 0.5) ops.$options = 'i';
            }
            else ops[op] = op === '$in' || op === '$nin' ? [value(), value()] : value();
        }
        return roll > 0.85 ? { $not: ops } : ops;
    }

    function node(depth) {
        const query = {};
        const fieldNames = Object.keys(fields).sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 2));
        for(const field of fieldNames) query[field] = condition(field);
        if(depth < 3 && random() > 0.4) {
            const logical = pick(['$and', '$or', '$nor']);
            query[logical] = Array.from({ length: 1 + Math.floor(random() * 3) }, () => node(depth + 1));
        }
        return query;
    }

    return () => node(0);
}

describe('SORLA find() matches the reference query semantics', () => {
    let collection;
    let documents;

    beforeAll(() => {
        documents = buildDocuments(prng(2026), 120);
        const srla = new sorla();
        srla.useDb('equivalence');
        srla.db.createCollection('people');
        // insertOne mutates the object (adds _id), keep the reference documents clean
        for(const doc of documents) srla.db.people.insertOne(structuredClone(doc));
        collection = srla.db.people;
    });

    const found = query => {
        const cursor = collection.find(query);
        const ids = [];
        while(cursor.hasNext()) ids.push(cursor.next()._data.n);
        return ids;
    };
    const expected = query => documents.filter(doc => refMatch(doc, query)).map(doc => doc.n);

    const handWritten = [
        {},
        { city: 'A' },
        { age: { $gte: 30, $lt: 40 } },
        { tags: { $in: ['ops'] } },
        { nickname: null },
        { nickname: { $ne: null } },
        { age: { $nin: [20, 21, 22] }, active: true },
        { $or: [{ city: 'A' }, { city: 'B', age: { $gt: 50 } }] },
        { $and: [{ age: { $gte: 30 } }, { $or: [{ name: 'Ana' }, { city: { $in: ['A', 'B'] } }] }] },
        { $nor: [{ active: true }, { score: { $lt: 50 } }] },
        { score: { $not: { $gte: 20, $lte: 80 } } },
        { $or: [{ $and: [{ city: 'C' }, { $nor: [{ age: { $lt: 30 } }] }] }, { tags: { $in: ['admin'] }, active: false }] },
        { name: { $regex: '^[a-c]', $options: 'i' } },
        { tags: { $regex: 'o' } },
        { age: { $exists: false } },
        { $or: [{ nickname: { $exists: true } }, { name: { $not: { $regex: 'a' } } }] }
    ];

    handWritten.forEach((query, i) => {
        it(`hand written query #${i + 1}: ${JSON.stringify(query)}`, () => {
            expect(found(query)).to.deep.equal(expected(query));
        });
    });

    it('500 random nested queries give the same documents as the reference', () => {
        const next = randomQueryGenerator(prng(42));
        let nonEmpty = 0;
        for(let i = 0; i < 500; i++) {
            const query = next();
            const want = expected(query);
            if(want.length) nonEmpty++;
            expect(found(query), JSON.stringify(query)).to.deep.equal(want);
        }
        // the generator must produce meaningful queries, not only empty results
        expect(nonEmpty).to.be.greaterThan(100);
    });

    it('findOne returns the first matching document', () => {
        const query = { $and: [{ city: 'B' }, { $or: [{ active: true }, { age: { $gt: 40 } }] }] };
        const first = expected(query)[0];
        expect(collection.findOne(query).n).to.equal(first);
    });
});

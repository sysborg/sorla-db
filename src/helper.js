//this file works only in dev mode, and is used to help with the development of the app
//and to debug bad behaviors and mistakes

const faker = require('faker');
const sorla = require('./sorla.js');
const { objects } = require('../test/feature_collection_queries.test.js');

const createFakeCollection = (srla, collectionName, number_objects) => {
    if(!(srla instanceof sorla))
        throw new Error('srla must be an instance of sorla');

    const objects = [];

    for(let i=0; i<number_objects; i++)
    {
        const obj = {
            name: faker.random.word(),
            email: faker.internet.email(),
            age: faker.datatype.number(),
            uuid: faker.datatype.uuid()
        };
        srla.db[collectionName].insertOne(obj);
        objects.push(obj);
    }

    return objects;
}

const getRandomComparisonData = (objects) => {
    const itemIndex1 = Math.floor(Math.random() * objects.length);
    let itemIndex2 = null;
    do {
        itemIndex2 = Math.floor(Math.random() * objects.length);
    } while(itemIndex1 === itemIndex2);

    return [objects[itemIndex1], objects[itemIndex2]];
}

module.exports = {
    createFakeCollection,
    getRandomComparisonData
}
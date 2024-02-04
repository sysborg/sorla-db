//this file works only in dev mode, and is used to help with the development of the app
//and to debug bad behaviors and mistakes

const faker = require('faker');
const sorla = require('./sorla.js');

const createFakeCollection = (srla, collectionName, number_objects) => {
    if(!(srla instanceof sorla))
        throw new Error('srla must be an instance of sorla');

    for(let i=0; i<number_objects; i++)
    {
        const obj = {
            name: faker.random.word(),
            email: faker.internet.email(),
            age: faker.datatype.number(),
            uuid: faker.datatype.uuid()
        };
        srla.db[collectionName].insertOne(obj);
    }
}

module.exports = {
    createFakeCollection
}
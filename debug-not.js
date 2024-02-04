const sorla = require('./src/sorla.js');
const helper = require('./src/helper.js');

const numberOfObjects = 20;
const sdb = new sorla();
sdb.createDb('test');
sdb.useDb('test');

sdb.db.createCollection('collection_test');

const objects = helper.createFakeCollection(sdb, 'collection_test', numberOfObjects);
const [itemIndex1, ] = helper.getRandomComparisonData(objects);

const finded = sdb.db.collection_test.findOne({
    uuid: {
        $not: {
            $eq: itemIndex1.uuid
        }
    }
 });

 console.log(finded.length, numberOfObjects);

 console.log(finded);
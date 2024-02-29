# sorla-db
A simple and temporary database focused to use in browser environment that will bring capabilities for other tools that will be launched as soon as possible.

This idea is from our founder #andmarruda that give this idea and alot of this idea are developed by him.

To create a minify file run
```
node index.js
```

To test the environment using jest run...
Don`t forget to install the dev dependecies before, using:

```
npm install --only=dev
```

```
npm test
```

Soon some documentations....

Prohibited characters $ and .,
$ because is used to call operators and . because uses to search key inside a object's object

## Registering and creating a collection example
```
window.sorla = new sorla();
window.sorla.createDb('tags');
window.sorla.useDb('tags');
window.sorla.db.createCollection('updatedTags');
window.sorla.db.updatedTags.insertMany([
  {
    name: 'Sonia',
    age: 53
  },
  {
    name: 'Anderson',
    age: 36
  }
]);
```

## Find Operators

### $and

The **$and** operator meticulously processes arrays, employing a loop chain mechanism. During this process, it's engineered for efficiency: if it encounters any comparison that yields **false**, it immediately halts the ongoing chain. This intelligent design is aimed at preventing unnecessary computation time, especially when dealing with documents that don't meet the specified condition. It's all about optimizing performance and ensuring swift, precise operations.

### Example

```
const results = window.sorla.db.updatedTags.find({
  $and: [
    {name: 'Anderson'},
    {age: 36}
  ]
});
```

### $or
The **$or** operator processes arrays, emploing a loop chain mechanism. During this process, it~s engineered for efficiency: if it enconters any comparison that yields **true**, it imediately halts
the ongoing chain. The intelligent design is aimed at preventing unnecessary computation time, especially when dealing with documents that the first condition matchs the needs. It's all about optimizing
performance and ensuring swift, precise operations.

### Example

```
const results = window.sorla.db.updatedTags.find({
  $or: [
    {name: 'Anderson'},
    {age: 53}
  ]
});
```

## Comparison operators

### $eq
$eq get all the documents that has exactly the same value as requested.
For example if we ask age: { $eq: 53 }, will return one document in this example,
but in general pourpose will return all documents that age is equal than 53.

```
const results = window.sorla.db.updatedTags.find({
  age: { $eq: 36 }
});
```

### $ne
$ne or not equal operator search all lines that doens't have the inputed value.
For example $ne:36, will return 1 line in this example, but for general pourpose will
return all lines that age isn't 36.

```
const results = window.sorla.db.updatedTags.find({
  age: { $ne: 36 }
});
```

### $gt
$gt compares values that is greater than, for example anyone who have age above 20, all the documents will return in this example.
```
const results = window.sorla.db.updatedTags.find({
  age: { $gt: 36 }
});
```

### $gte
$gte compares values that is greater or equal than, for example anyone who have age above 20, all the documents will return in this example.
But if we put there for example greater or equal than 53, will return only one document.
```
const results = window.sorla.db.updatedTags.find({
  age: { $gte: 36 }
});
```
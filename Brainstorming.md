For the first query version needs only to see if has some non logical operator or non logical comparison to resend to find as a recursive method.

- Preparing sort of data using new capabilities
- improving find behavior

For comparison operators and deny operator like not
adding nor https://www.mongodb.com/docs/manual/reference/operator/query/nor/
not https://www.mongodb.com/docs/manual/reference/operator/query/not/

https://www.mongodb.com/docs/manual/reference/operator/query-comparison/
https://www.mongodb.com/docs/manual/reference/operator/query/expr/
https://www.mongodb.com/docs/manual/reference/operator/query/regex/


Preparing a bunch of misc tests to search data, add sort data and create test sortable data.

//erros and improvements
The error is because the field is checked and discard before the not operation in the coding.
Other deal is that not operator needs a document to know how will compare.
Other deal that a field can have more than one expression inside of object with no problem
- Prohibted $ and . on updates
- Create a get that gets data from documents representing something like {teste: {testar: '123'}} that can be get using
  teste.testar using the get environment from proxy.
- Simplify the operators environment
- Preparing new deep search using all capabilities
- Preparing sort of data using new capabilities
- Need to improve dot getting value when using find

Fixing for browser user porpouse

For comparison operators and deny operator like not
adding nor https://www.mongodb.com/docs/manual/reference/operator/query/nor/
not https://www.mongodb.com/docs/manual/reference/operator/query/not/

https://www.mongodb.com/docs/manual/reference/operator/query-comparison/
https://www.mongodb.com/docs/manual/reference/operator/query/expr/
https://www.mongodb.com/docs/manual/reference/operator/query/regex/

some operators need to return bool and the calling function receives the information if goes on or 
add attach the documento to result.

improving $in and add $all
// Stable key of a query and its options: RegExp and Date survive (JSON.stringify turns them into {} and strings)
export function queryKey(...values) {
    return JSON.stringify(values, (key, value) => {
        if (Object.prototype.toString.call(value) === '[object RegExp]') return { $regex: value.source, $flags: value.flags };
        return value;
    });
}

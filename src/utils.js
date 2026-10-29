class utils
{
    /**
     * Get a uuid v4 string
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param 
     * @return string
    **/
    get uuid()
    {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c)
        {
            let r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);

            return v.toString(16);
        });
    }

    /**
     * Get data using dots to access subfields
     * @param object data
     * @param string field
     */
    getDotData(data, field)
    {
        let value = data;
        for(const part of field.split('.'))
        {
            // a missing step means the field does not exist (it used to return the parent object)
            if(value === null || typeof value !== 'object' || !(part in value))
                return undefined;

            value = value[part];
        }

        return value;
    }
}

module.exports = utils;
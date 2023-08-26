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
}

module.exports = utils;
const database = require('./dbs/database.js');
const { ValidationError } = require('./schema/schema.js');
const { connect } = require('./sync/socket.js');
const { readEventStream, stream } = require('./sync/sse.js');

class sorla{
    /**
     * Constructs class Sorla to manage databases
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param 
     * @return void
     */
    constructor()
    {
        this._dbs = [];
        this._selectedDb = null;
    }

    /**
     * Search a database`s position in the list of databases by its name and mark it as selected
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 
     * @param 
     * @return 
    **/
    _findDbIndex(name)
    {
        return this._dbs.findIndex(db => db.name == name);
    }

    /**
     * Verify if a database name already exists in the list of databases
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param  string name
     * @return boolean
     */
    dbExists(name)
    {
        return this._findDbIndex(name) > -1;
    }

    /**
     * Mark a database as selected
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param 
     * @return 
    **/
    _selectDb(pos)
    {
        if(!this._dbs.hasOwnProperty(pos))
        {
            throw new Error('Database does not exists');
        }
        this._selectedDb = this._dbs[pos];
    }

    /**
     * Creates a new database
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param string name
     * @return int "The position of the new database in the list of databases"
    **/
    createDb(name)
    {
        if(this.dbExists(name))
        {
            return false;
        }

        let pos = this._dbs.length;
        this._dbs.push(new database(name));
        return pos;
    }

    /**
     * Selects a database by its name or creates a new one if it does not exists and then selects it
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param string name
     * @return void
    **/
    useDb(name)
    {
        let pos = null;
        if(!this.dbExists(name))
        {
            pos = this.createDb(name);
        }

        this._selectDb(pos === null ? this._findDbIndex(name) : pos);
    }

    /**
     * Get the number of created databases
     * @author Anderson Arruda < andmarruda@gmail.com >
     * @version 1.0.0
     * @param 
     * @return int
    **/
    countDb()
    {
        return this._dbs.length;
    }

    /**
     * Names of the databases, in creation order
     * @return array
     */
    listDatabases()
    {
        return this._dbs.map(db => db.name);
    }

    /**
     * Removes a database and its collections; when it was selected, no database stays selected
     * @param string name
     * @return boolean false when it did not exist
     */
    dropDb(name)
    {
        const pos = this._findDbIndex(name);
        if(pos === -1)
            return false;

        if(this._selectedDb === this._dbs[pos])
            this._selectedDb = null;

        this._dbs.splice(pos, 1);
        return true;
    }

    /**
     * Return selected db
     * @author Anderson Arruda < anderson@sysborg.com.br >
     * @version 1.0.0
     * @param 
     * @return instanceof database
    **/
    get db()
    {
        return this._selectedDb;
    }
}

// thrown when a document does not satisfy the collection schema: error.errors = [{path, rule, message}]
sorla.ValidationError = ValidationError;
// WebSocket connection not tied to a collection (request / load replies only): sorla.connect(url, options)
sorla.connect = (url, options = {}) => connect(null, url, options);
// text/event-stream parser, for your own SSE handling
sorla.readEventStream = readEventStream;
// Server-Sent Events stream handled by your code: sorla.stream(url, {apply(type, data), ...})
sorla.stream = (url, options = {}) => stream(null, url, options);

module.exports = sorla;
if(typeof window !== 'undefined')
{
    window.sorla = sorla;
}
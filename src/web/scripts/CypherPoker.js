/**
* @file The main interface to CypherPoker.JS<br/>
* Automates peer-to-peer connectivity and instantiation of the cryptosystem,
* manages tables, launches games, and provides accesss to other shared
* functionality.
*
* @version 0.0.1
* @author Patrick Bay
* @copyright MIT License
*/

/**
* @class Main CypherPoker.JS lobby, table maker, and game launcher.
*
* @example
* var settingsObj = {
*    "p2p":{
*       "create":"return (new WSS())",
*       "connectURL":"ws://localhost:8090"
*    },
*    "crypto":{
*       "create":"return (new SRACrypto(4))"
*    },
*    "debug":false
* }
* var cypherpoker = new CypherPoker(settingsObj);
*
* @extends EventDispatcher
* @see {@link WSS}
* @see {@link SRACrypto}
*/
class CypherPoker extends EventDispatcher {

    //Event definitions:

    /**
    * The instance has successfully started.
    *
    * @event CypherPoker#start
    * @type {Event}
    */
    /**
    * An external peer is announcing a unique new table (within allowable limits).
    *
    * @event CypherPoker#tablenew
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the announcement.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {TableObject} data.result.data The table associated with the notification.
    */
    /**
    * An external peer is making a request to join one of our tables.
    *
    * @event CypherPoker#tablejoinrequest
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the request.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the request sender.
    * @property {TableObject} data.result.data The table associated with the notification.
    */
    /**
    * A notification that a new peer (possibly us), is joining another
    * owner's table.
    *
    * @event CypherPoker#tablejoin
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the table update.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {TableObject} data.result.data The table associated with the notification.
    */
    /**
    * The associated table's required private IDs have all joined and the table
    * is ready (e.g. to start a game)
    *
    * @event CypherPoker#tableready
    * @type {Event}
    * @property {TableObject} table The table associated with the notification.
    */
    /**
    * A table member is sending a message to other table members.
    *
    * @event CypherPoker#tablemsg
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the message information.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the message sender.
    * @property {TableObject} data.result.data The table associated with the message.
    * @property {*} data.result.data.message The message being sent.
    */
    /**
    * An external peer is leaving a table.
    *
    * @event CypherPoker#tableleave
    * @type {Event}
    * @property {Object} data The JSON-RPC 2.0 object containing the table being left.
    * @property {Object} data.result The standard JSON-RPC 2.0 notification result object.
    * @property {String} data.result.from The private ID of the notification sender.
    * @property {TableObject} data.result.data The table associated with the notification.
    */
    /**
    * A join request to another owner's table has timed out without a response.
    *
    * @event CypherPoker#tablejointimeout
    * @type {Object}
    * @property {TableObject} table The table that has timed out.
    */

   /**
   * An object containing properties and references required by CypherPoker.JS that
   * refer to a table or group of peers.
   * @typedef {Object} TableObject
   * @property {String} ownerPID The private ID of the owner / creator of the table.
   * @property {String} tableID The pseudo-randomly generated, unique table ID of the table.
   * @property {String} tableName The name given to the table by the owner.
   * @property {Array} requiredPID Indexed array of private IDs of peers required to join this room before it's
   * considered full or ready. The wildcard asterisk (<code>"*"</code>) can be used to signify any PID.
   * @property {Array} joinedPID Indexed array of private IDs that have been accepted by the owner, usually in a
   * <code>tablejoin</code> CypherPoker peer-to-peer message. This array should ONLY contain valid
   * private IDs (no wildcards).
   * @property {Object} tableInfo Additional information to be included with the table. Use this object rather than
   * a {@link TableObject} at the root level since it is dynamic (may cause unexpected behaviour).
   */

   /**
   * Creates a new CypherPoker.JS instance.
   *
   * @param {Object} settingsObject An external settings object specifying startup
   * and initialization options for the instance. This reference is set to the
   * {@link CypherPoker#settings} property.
   *
   */
   constructor (settingsObject) {
      super();
      this._connected = false;
      this._settings = settingsObject;
      this.initialize();
   }

   /**
   * Called to intialize the instance after all settings are created / loaded.
   * Sets the {@link CypherPoker#p2p} and {@link CypherPoker#crypto} references using settings functions.
   * Also adds an internal listener for <code>message</code> events on {@link CypherPoker#p2p},
   * in order to process some of them internally.
   * @private
   */
   initialize() {
      this.debug ("CypherPoker.initialize()");
      //create peer-to-peer networking
      this._p2p = Function(this.settings.p2p.create)();
      //create cryptosystem
      this._crypto = Function(this.settings.crypto.create)();
      this.p2p.addEventListener("message", this.handleP2PMessage, this);
   }

   /**
   * Creates a <code>console</code>-based output based on the type if the
   * <code>debug</code> property of {@link CypherPoker#settings} is <code>true</code>.
   *
   * @param {*} msg The message to send to the console output.
   * @param {String} [type="log"] The type of output that the <code>msg</code> should
   * be sent to. Valid values are "log"-send to the standard <code>log</code> output,
   * "err" or "error"-send to the <code>error</code> output, and "dir"-send to the
   * <code>dir</code> (object inspection) output.
   * @private
   */
   debug (msg, type="log") {
      if (this.settings.debug == true) {
         if ((type == "err") || (type == "error")) {
            console.error(msg);
         } else if (type == "dir") {
            console.dir(msg);
         } else {
            console.log(msg);
         }
      }
   }

   /**
   * Starts the instance once all internal and external initialization has been
   * completed. Usually this function can be invoked directly after a new
   * instance is created unless otherwise required.
   *
   * @fires CypherPoker#start
   * @async
   */
   async start() {
      this.debug ("CypherPoker.start()");
      try {
         var result = await this.p2p.connect(this.settings.p2p.connectURL);
         this._connected = true;
      } catch (err) {
         this.debug(err, "err");
         result = null;
         this._connected = false;
      }
      var event = new Event("start");
      this.dispatchEvent(event);
      return (result);
   }

   /**
   * @property {Object} settings The main settings object for the instance as provided
   * during instatiation time.
   * @readonly
   */
   get settings() {
      return (this._settings);
   }

   /**
   * @property {Object} p2p Reference to a peer-to-peer networking interface
   * supporting the property <code>privateID</code> and functions <code>connect(serverURL)</code>,
   * <code>broadcast(message)</code>, and <code>direct(message, [recipient,recipient...])</code>.
   * For example, {@link WSS.js}
   * @readonly
   */
   get p2p() {
      return (this._p2p);
   }

   /**
   * @property {SRACrypto} crypto An interface for asynchronous cryptographic operations.
   * @readonly
   */
   get crypto() {
      return (this._crypto);
   }

   /**
   * @property {Boolean} connected=false True if the instance is connected to the peer-to-peer
   * network and ready to accept requests.
   * @readonly
   */
   get connected() {
      return (this._connected);
   }

   /**
   * @property {Boolean} openTables Indicates whether the instance has any owned
   * and open tables (true), or if all owned and open tables are filled (false).
   * @readonly
   */
   get openTables () {
      if (this["_openTables"] == undefined) {
         this._openTables = false;
      }
      return (this._openTables);
   }

   /**
   * @property {Array} joinedTables A current copy of the list of the tables we've joined (owned
   * and others').
   * @readonly
   */
   get joinedTables() {
      if (this._joinedTables == undefined) {
         this._joinedTables = new Array();
      }
      return (Array.from(this._joinedTables));
   }

   /**
   * @property {Array} announcedTables A current copy of the list of tables announced by other owners.
   * @readonly
   */
   get announcedTables() {
      if (this._announcedTables == undefined) {
         this._announcedTables = new Array();
      }
      return (Array.from(this._announcedTables));
   }

   /**
   * @property {Array} games A list of references to {@link CypherPokerGame} instances
   * managed by this instance.
   * @readonly
   */
   get games() {
      if (this._games == undefined) {
         this._games = new Array();
      }
      return (this._games);
   }

   /**
   * @property {Boolean} captureNewTables=false If set to true, the instance begins to immediately
   * capture new table announcements made over the peer-to-peer network. The network
   * does not need to be connected for this setting to be changed.
   */
   set captureNewTables(captureSet) {
      this._newTableCapture = captureSet;
      this.debug("CypherPoker.captureNewTables="+captureSet);
   }

   get captureNewTables() {
      if (typeof(this["_newTableCapture"]) != "boolean") {
         this._newTableCapture = false;
      }
      return (this._newTableCapture);
   }

   /**
   * @property {Number} maxCapturedTables=99 The maximum number of tables that should be
   * captured to the {@link CypherPoker#announcedTables} array. Once this limit is reached,
   * items are shuffled so that new items always have the smallest index.
   */
   set maxCapturedTables(maxSet) {
      this._maxCapturedTables = maxSet;
      this.debug("CypherPoker.maxCapturedTables="+maxSet);
   }

   get maxCapturedTables() {
      if (isNaN(this["_maxCapturedTables"])) {
         this._maxCapturedTables = 99;
      }
      return (this._maxCapturedTables);
   }

   /**
   * @property {Number} maxCapturesPerPeer=5 The maximum number of tables that should be
   * captured to the {@link CypherPoker#announcedTables} array per peer. If this many tables
   * currently exist in {@link CypherPoker#announcedTables} array, new and/or unique announcements
   * by the same peer will be ignored.
   */
   set maxCapturesPerPeer(maxSet) {
      this._maxCapturesPerPeer = maxSet;
   }

   get maxCapturesPerPeer() {
      if (isNaN(this["_maxCapturesPerPeer"])) {
         this._maxCapturesPerPeer = 5;
      }
      return (this._maxCapturesPerPeer);
   }

   /**
   * @property {Number} beaconInterval=5000 The interval, in milliseconds, to activate the
   * internal table announcement beacon per table (owned tables only!)
   */
   set beaconInterval (intervalMS) {
      this._beaconInterval = intervalMS;
      this.debug("CypherPoker.beaconInterval="+intervalMS);
   }

   get beaconInterval() {
      if (typeof(this["_beaconInterval"]) != "number") {
         this._beaconInterval = 5000;
      }
      return (this._beaconInterval);
   }

   /**
   * Creates a new CypherPoker.JS table and optionally begins to advertise it on the
   * available peer-to-peer network. The table is automatically joined and added
   * to the {@link CypherPoker#joinedTables} array.
   *
   * @param {String} tableName The name of the table to create.
   * @param {Number|Array} players If this is a number it specifies that ANY other players
   * up to this numeric limit may join the table. When this parameter is an array it's assumed
   * to be an indexed list of private IDs to allow to the table
   * (may also be a mix of wildcards / any PIDs: <code>["*", "*", "a4ec890...]</code>).
   * This value does <b>not</b> include self (i.e. only other players).
   * @param {String} [tableID=null] The unique (per peer), table ID to generate the table with.
   * Omitting this parameter or setting it to <code>null</code> causes an ID to be
   * automatically generated.
   * @param {Boolean} [activateBeacon=true] If true, an internal beacon is automatically
   * started at a {@link CypherPoker#beaconInterval} interval to advertise the table on the peer-to-peer
   * network. If false, use the {@link CypherPoker#announceTable} function to manually announce the
   * returned table.
   *
   * @return {TableObject} A newly created CypherPoker.JS table as specified by
   * the parameters.
   */
   createTable(tableName, players, tableInfo=null, tableID=null, activateBeacon=true) {
      if (typeof(tableID) == "string") {
         this.debug("CypherPoker.createTable(\""+tableName+"\", "+players+", "+tableInfo+", \""+tableID+"\", "+activateBeacon+")");
      } else {
         this.debug("CypherPoker.createTable(\""+tableName+"\", "+players+", "+tableInfo+", "+tableID+", "+activateBeacon+")");
      }
      if (!this.connected) {
         throw(new Error("Peer-to-peer network connection not established."));
      }
      var newTableObj = new Object();
      if (tableID != null) {
         newTableObj.tableID = tableID;
      } else {
         newTableObj.tableID = String(Math.random()).split(".")[1];
      }
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
      }
      newTableObj.tableName = tableName;
      newTableObj.ownerPID = this.p2p.privateID;
      newTableObj.requiredPID = new Array();
      newTableObj.joinedPID = new Array();
      newTableObj.joinedPID.push (this.p2p.privateID);
      if (typeof(players) == "number") {
         for (var count=0; count < players; count++) {
            newTableObj.requiredPID.push("*");
         }
      } else {
         newTableObj.requiredPID = Array.from(players);
      }
      if (tableInfo == null) {
         tableInfo = new Object();
      }
      newTableObj.tableInfo = tableInfo;
      newTableObj.toString = function () {
        return ("[object TableObject]");
      }
      this._joinedTables.push(newTableObj);
      this._openTables = true;
      if (activateBeacon) {
         newTableObj.beaconID = setInterval(this.announceTable, this.beaconInterval, newTableObj, this);
         this.announceTable(newTableObj); //send first announcement right away
      }
      return (newTableObj);
   }

   /**
   * Announces a table on the currently connected peer-to-peer network. If an
   * associated beacon timer is found, it is automatically stopped when
   * the <code>requiredPID</code> list of the table is empty.
   *
   * @param {TableObject} tableObj The table to announce. If the table's
   * <code>requiredPID</code> array is empty, the request is rejected.
   * @param {CypherPoker} [context=null] The CypherPoker instance to execute the function
   * in (typically specified as part of a timer). If <code>null</code>, the current
   * <code>this</code> context is assumed.
   */
   announceTable(tableObj, context=null) {
      if (context == null) {
         context = this;
      }
      if (tableObj.requiredPID.length == 0) {
         try {
            clearInterval(tableObj.beaconID);
         } catch (err) {
         } finally {
            return;
         }
      }
      context.debug("CypherPoker.announceTable("+tableObj+")")
      var announceObj = context.buildCPMessage("tablenew");
      context.copyTable(tableObj, announceObj);
      context.p2p.broadcast(announceObj);
   }

   /**
   * Checks whether the supplied argument is a valid CypherPoker.JS table object.
   *
   * @param {TableObject} [tableObj=null] The object to examine.
   *
   * @return {Boolean} True if the supplied object appears to be a valid {@link TableObject}
   * suitable for use with CypherPoker.JS
   */
   isTableValid(tableObj=null) {
      if (tableObj == null) {
         return (false);
      }
      if ((tableObj["ownerPID"] == undefined) || (tableObj["ownerPID"] == null) || (tableObj["ownerPID"] == "")) {
         return (false);
      }
      if ((tableObj["tableID"] == undefined) || (tableObj["tableID"] == null) || (tableObj["tableID"] == "")) {
         return (false);
      }
      //table name can be an empty string:
      if ((tableObj["tableName"] == undefined) || (tableObj["tableName"] == null)) {
         return (false);
      }
      //don't compare an array to an empty string since this will return true (array's toString is used)
      if ((tableObj["requiredPID"] == undefined) || (tableObj["requiredPID"] == null)) {
         return (false);
      }
      if (typeof(tableObj.requiredPID.length) != "number") {
         return (false);
      }
      if ((tableObj["joinedPID"] == undefined) || (tableObj["joinedPID"] == null)) {
         return (false);
      }
      if (typeof(tableObj.joinedPID.length) != "number") {
         return (false);
      }
      if ((tableObj["tableInfo"] == undefined) || (tableObj["tableInfo"] == null) || (tableObj["tableInfo"] == "")) {
         return (false);
      }
      return (true);
   }

   /**
   * Evaluates whether a table is ready or not. A table is considered
   * ready if it is a valid {@link TableObject}, has one or more joined private
   * IDs and no required private IDs.
   *
   * @param {TableObject} tableObj The table to evaluate.
   *
   * @return {Boolean} True if the table is ready.
   */
   isTableReady(tableObj) {
      if (this.isTableValid(tableObj) == false) {
         return (false);
      }
      if ((tableObj.requiredPID.length == 0) && (tableObj.joinedPID.length > 0)) {
         return (true);
      }
      return (false);
   }

   /**
   * Requests to join another owner's table.
   *
   * @property {TableObject} A CypherPoker.JS table (object) to request to join.
   * @property {Number} [replyTimeout=20000] A time, in milliseconds, to wait for the reply
   * before considering the request as having timed out.
   *
   * @return {Promise} The promise will be resolved if the table was successfully
   * joined otherwise it will be rejected.
   * @throws {Error} A standard Error is thrown if peer to peer networking hasn't been
   * successfully negotiated.
   *
   */
   joinTable(tableObj=null, replyTimeout=20000) {
      this.debug("CypherPoker.joinTable("+tableObj+", "+replyTimeout+")");
      var promise = new Promise((resolve, reject) => {
         if (!this.connected) {
            throw(new Error("Peer-to-peer network connection not established."));
         }
         if (!this.isTableValid(tableObj)) {
            this.debug ("Not a valid table object.", "err");
            reject (null);
            return;
         }
         var slotAvailable = false
         for (var count=0; count < tableObj.requiredPID.length; count++) {
            var requiredPID = tableObj.requiredPID[count];
            if ((requiredPID == "*") || (requiredPID == this.p2p.privateID)) {
               //we're not allowed to join this table
               slotAvailable = true;
            }
         }
         if (!slotAvailable) {
            this.debug ("Not allowed to join group.", "err");
            reject (null);
            return;
         }
         if (this._joinTableRequests == undefined) {
            this._joinTableRequests = new Array();
         }
         for (count=0; count < this._joinTableRequests.length; count++) {
            var currentRequestTable = this._joinTableRequests[count];
            if ((currentRequestTable[count].ownerPID == tableObj.ownerPID) &&
               (currentRequestTable[count].tableID == tableObj.tableID)) {
               //already a join request active
               reject (null);
               return;
            }
         }
         tableObj.toString = function() {
           return ("[object TableObject]");
         }
         this._joinTableRequests.push(tableObj);
         this.sendJoinTableRequest(tableObj);
         tableObj._resolve = resolve;
         tableObj._reject = reject;
         tableObj.joinTimeoutID = setTimeout(this.onJoinTableRequestTimeout, replyTimeout, tableObj, this);
      });
      return (promise);
   }

   /**
   * Sends a message to the joined peers of a table.
   *
   * @param {TableObject} tableObj The table to send the message to.
   * @param {*} message The message to send. Cannot be null or undefined.
   *
   * @return {Boolean} True if the message was delivered to the peer-to-peer networking
   * interface, false if there was a problem processing the parameters.
   */
   sendToTable(tableObj, message) {
      if (typeof(message) == "string") {
         this.debug("CypherPoker.sendToTable("+tableObj+", \""+message+"\")");
      } else {
         this.debug("CypherPoker.sendToTable("+tableObj+", "+message+")");
      }
      if (!this.connected) {
         throw(new Error("Peer-to-peer network connection not established."));
      }
      if (!this.isTableValid(tableObj)) {
         this.debug ("Not a valid table object.", "err");
         return (false);
      }
      if ((message == null) || (message == undefined)) {
         this.debug ("No message to send to table.", "err");
         return (false);
      }
      var tablePIDs = this.createTablePIDList(tableObj.joinedPID, false);
      var tableMessageObj = this.buildCPMessage("tablemsg");
      tableMessageObj.message = message;
      tableMessageObj.tableName = tableObj.tableName;
      tableMessageObj.tableID = tableObj.tableID;
      tableMessageObj.ownerPID = tableObj.ownerPID;
      this.p2p.send(tableMessageObj, tablePIDs);
      return (true);
   }

   /**
   * Sends a "tablejoinrequest" message to a table's owner.
   *
   * @param {TableObject} tableObj The table of the owner to send a join request to.
   * @private
   */
   sendJoinTableRequest(tableObj) {
      this.debug("CypherPoker.sendJoinTableRequest("+tableObj+")");
      var joinRequestObj = this.buildCPMessage("tablejoinrequest");
      this.copyTable(tableObj, joinRequestObj);
      this.p2p.send(joinRequestObj, [tableObj.ownerPID])
   }

   /**
   * Responds to a timeout on a "tablejoinrequest" message, removing the
   * table from the <code>_joinTableRequests</code> array.
   *
   * @param {TableObject} tableObj The table reference for which a
   * @param {CypherPoker} context The CypherPoker instance to execute the function
   * in as specified in the calling timer.
   * @fires CypherPoker#tablejointimeout
   * @private
   */
   onJoinTableRequestTimeout(tableObj, context) {
      context.debug("CypherPoker.onJoinTableRequestTimeout("+tableObj+")");
      var requestsArray = context._joinTableRequests;
      for (var count=0; count < requestsArray.length; count++) {
         var requestObj = requestsArray[count];
         if ((tableObj.tableID == requestObj.tableID) &&
            (tableObj.tableName == requestObj.tableName) &&
            (tableObj.ownerPID == requestObj.ownerPID)) {
               requestsArray.splice(count, 1);
               var event = new Event("tablejointimeout");
               event.table = requestObj;
               context.dispatchEvent(event);
               requestObj._reject(null);
               return;
         }
      }
   }

   /**
   * Leaves a table that was joined. This table must be tracked internally
   * by this instance as having been joined.
   *
   * @param {TableObject} tableObj The table to leave.
   *
   * @return {Boolean} True if the leave notification was delievered to the
   * peer-to-peer networking interface, false if there was a problem
   * verifying the parameter.
   */
   leaveJoinedTable(tableObj) {
      this.debug("CypherPoker.leaveJoinedTable("+tableObj+")");
      if (!this.connected) {
         throw(new Error("Peer-to-peer network connection not established."));
      }
      if (!this.isTableValid(tableObj)) {
         this.debug ("Not a valid table object.", "err");
         return (false);
      }
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
      }
      var joined = false;
      for (var count=0; count < this._joinedTables.length; count++) {
         var currentTable = this._joinedTables[count];
         if ((currentTable.tableID == tableObj.tableID) &&
            (currentTable.tableName == tableObj.tableName) &&
            (currentTable.ownerPID == tableObj.ownerPID)) {
               this._joinedTables.splice(count, 1);
               joined = true;
               break;
            }
      }
      if (joined == false) {
         return (false);
      }
      var leaveNotificationObj = this.buildCPMessage("tableleave");
      this.copyTable(tableObj, leaveNotificationObj);
      var tablePIDs = this.createTablePIDList(tableObj.joinedPID);
      this.p2p.send(leaveNotificationObj, tablePIDs);
      return (true);
   }

   /**
   * Retrieves a list of tables we've joined using at least one of three search criteria.
   *
   * @param {String} [tableName=null] The name of the table(s) to search for. If null,
   * this parameter is ignored.
   * @param {String} [tableID=null] The ID of the table(s) to search for. If null,
   * this parameter is ignored.
   * @param {String} [ownerPID=null] The private ID of the table(s)' owner to search for. If null,
   * this parameter is ignored.
   *
   * @return {Array} A list of tables currently joined that matches one or more of the
   * search criteria specified in the parameters. If all parameters are null, the whole
   * list of joined tables is returned (same as {@link CypherPoker#joinedTables}).
   */
   getJoinedTables(tableName=null, tableID=null, ownerPID=null) {
      var returedTables = new Array();
      if (this["_joinedTables"] == undefined) {
         this._joinedTables = new Array();
         return (returedTables);
      }
      if ((tableName == null) && (tableID == null) && (ownerPID == null)) {
         return (Array.from(this._joinedTables));
      }
      var hits = 0;
      for (var count=0; count < this._joinedTables.length; count++) {
         if (tableName != null) {
            if (this._joinedTables[count].tableName == tableName) {
               hits++;
            } else {
               hits-=10;
            }
         }
         if (tableID != null) {
            if (this._joinedTables[count].tableID == tableID) {
               hits++;
            } else {
               hits-=10;
            }
         }
         if (ownerID != null) {
            if (this._joinedTables[count].ownerPID) {
               hits++;
            } else {
               hits-=10;
            }
         }
         if (hits > 0) {
            returedTables.push(this._joinedTables[count]);
         }
         hits = 0;
      }
      return (returedTables);
   }

   /**
   * Copies the core properties of a source table object to another object. The
   * target object will be identifiable as a {@link TableObject} after
   * the copy.
   *
   * @param {TableObject} sourceTable The table from which to copy from.
   * @param {Object} targetObject The target object to copy the core properties
   * of <code>sourceTable</code> to.
   */
   copyTable(sourceTable, targetObject) {
      targetObject.tableName = sourceTable.tableName;
      targetObject.tableID = sourceTable.tableID;
      targetObject.ownerPID = sourceTable.ownerPID;
      targetObject.requiredPID = sourceTable.requiredPID;
      targetObject.joinedPID = sourceTable.joinedPID;
      targetObject.tableInfo = sourceTable.tableInfo;
      targetObject.toString = function() {
         return ("[object TableObject]");
      }
   }

   /**
   * Creates a copy of a list of private IDs, omitting the self (<code>this.p2p.privateID</code>).
   *
   * @param {Array} PIDList An array of private IDs to create the return list from.
   *
   * @return {Array} A copy of <code>PIDList</code> excluding the self.
   * @private
   */
   createTablePIDList(PIDList) {
      var returnList = new Array();
      for (var count=0; count < PIDList.length; count++) {
         if (PIDList[count] != this.p2p.privateID) {
            returnList.push(PIDList[count]);
         }
      }
      return (returnList);
   }

   /**
   * Attempts to create a new {@link CypherPokerGame} instance from a table object.
   * All required private IDs must already have joined the table prior to calling
   * this function.
   *
   * @param {TableObject} tableObj The table from which to create a new game.
   * @param {Object} playerInfo Additional information about us to send
   * to other players at the table when they signal that their game is ready.
   *
   * @return {CypherPokerGame} A new game instance associated with the table
   * or <code>null</code> if one couldn't be created.
   * @fires CypherPoker#tablenew
   */
   createGame(tableObj, playerInfo=null) {
      this.debug("CypherPoker.createGame("+tableObj+")");
      if (this.isTableValid(tableObj) == false) {
         throw (new Error("Not a valid table object."));
      }
      if (tableObj.requiredPID.length > 0) {
         throw (new Error("All required PIDs not yet joined."));
      }
      var newGame = new CypherPokerGame(this, tableObj, playerInfo);
      return (newGame);
   }

   /**
   * Dispatches a "tableready" event when the associated table is considered
   * ready (see: {@link CypherPoker#isTableReady}).
   *
   * @param {TableObject} tableObj The table to evaluate and include with the
   * the event if ready.
   *
   * @return {Boolean} True if the table is ready and the event was dispatched.
   * @fires CypherPoker#tableready
   * @private
   */
   dispatchTableReadyEvent(tableObj) {
      if (this.isTableReady(tableObj)) {
         var event = new Event("tableready");
         event.table = tableObj;
         this.dispatchEvent(event);
         return (true);
      }
      return (false);
   }

   /**
   * Handles a peer-to-peer message event dispatched by the communication
   * interface.
   *
   * @param {Event} event A "message" event dispatched by the communication interface.
   * A <code>data</code> property is expected to contain the parsed JSON-RPC 2.0
   * message received.
   * @fires CypherPoker#tablenew
   * @fires CypherPoker#tablejoinrequest
   * @fires CypherPoker#tablejoin
   * @fires CypherPoker#tableready
   * @fires CypherPoker#tablemsg
   * @fires CypherPoker#tableleave
   * @private
   */
   handleP2PMessage(event) {
      if (this.isCPMsgEvent(event) == false) {
         //don't process any further
         return;
      }
      var message = event.data.result.data;
      var messageType = message.cpMsg;
      var ownEvent = new Event(messageType);
      ownEvent.data = event.data;
      this.debug("CypherPoker.handleP2PMessage("+event+")");
      this.debug("   Type: "+messageType);
      switch (messageType) {
         case "tablenew":
            if (this.captureNewTables) {
               if (this.captureTable(event.data.result)) {
                  this.dispatchEvent(ownEvent);
               }
            }
            break;
         case "tablejoinrequest":
            if (!this.openTables) {
               return;
            }
            this._openTables = false;
            var joined = false; //use flag to prevent multiple adds while evaluating all tables
            for (var count = 0; count < this._joinedTables.length; count++) {
               var currentTable = this._joinedTables[count];
               if ((currentTable.ownerPID == this.p2p.privateID) && (joined == false)) {
                  if ((currentTable.tableID == message.tableID) && (currentTable.tableName == message.tableName)) {
                     for (var count2 = 0; count2 < currentTable.requiredPID.length; count2++) {
                        var requiredPID = currentTable.requiredPID[count2];
                        if (((requiredPID == event.data.result.from) || (requiredPID == "*")) && (joined == false)) {
                           currentTable.requiredPID.splice(count2, 1);
                           currentTable.joinedPID.push(event.data.result.from);
                           var joinResponse = this.buildCPMessage("tablejoin");
                           this.copyTable(currentTable, joinResponse);
                           this.p2p.send(joinResponse, this.createTablePIDList(currentTable.joinedPID, false));
                           this.dispatchEvent(ownEvent);
                           this.dispatchTableReadyEvent(currentTable);
                           joined = true;
                        }
                     }
                  }
               }
               if (currentTable.requiredPID.length > 0) {
                  this._openTables = true;
               }
            }
            break;
         case "tablejoin":
            var newTable = new Object();
            if ((this._joinedTables == undefined) || (this._joinedTables == null)) {
               this._joinedTables = new Array();
            }
            this.copyTable(message, newTable);
            for (count = 0; count < this._joinedTables.length; count++) {
               currentTable = this._joinedTables[count];
               if ((currentTable.tableID == message.tableID) && (currentTable.tableName == message.tableName)) {
                  //someone else has joined the owner's table
                  this._joinedTables[count] = newTable;
                  newTable.toString = function() {
                     return ("[object TableObject]");
                  }
                  this.dispatchEvent(ownEvent);
                  this.dispatchTableReadyEvent(newTable);
                  return;
               }
            }
            for (var count = 0; count < this._joinTableRequests.length; count++) {
               var requestObj = this._joinTableRequests[count];
               if ((requestObj.ownerPID == event.data.result.from) &&
                   (requestObj.tableID == message.tableID) &&
                   (requestObj.tableName == message.tableName)) {
                      //we've just joined the owner's table
                      this._joinTableRequests.splice(count, 1);
                      clearTimeout(requestObj.joinTimeoutID);
                      delete requestObj.joinTimeoutID;
                      newTable.toString = function() {
                        return ("[object TableObject]");
                      }
                      this._joinedTables.push(newTable);
                      this.dispatchEvent(ownEvent);
                      requestObj._resolve(event);
                      this.dispatchTableReadyEvent(newTable);
                      return;
                   }
            }
            break;
         case "tablemsg":
            this.debug ("\nFrom: "+event.data.result.from);
            this.debug ("Table name / ID: "+event.data.result.data.tableName +" / "+event.data.result.data.tableID);
            this.debug ("Message: "+event.data.result.data.message);
            this.dispatchEvent(ownEvent);
            break;
         case "tableleave":
               var newTable = new Object();
               if ((this._joinedTables == undefined) || (this._joinedTables == null)) {
                  this._joinedTables = new Array();
               }
               this.copyTable(message, newTable);
               for (count = 0; count < this._joinedTables.length; count++) {
                  currentTable = this._joinedTables[count];
                  if ((currentTable.tableID == message.tableID) && (currentTable.tableName == message.tableName)) {
                     for (var count2=0; count2 < currentTable.joinedPID.length; count2++) {
                        if (currentTable.joinedPID[count2] == event.data.result.from) {
                           currentTable.joinedPID.splice(count2, 1);
                           this.dispatchEvent(ownEvent);
                           return;
                        }
                     }
                  }
               }
               break;
         default:
            //not a recognized CypherPoker.JS message type
            break;
      }
   }

   /**
   * Captures a new table announcement to the {@link CypherPoker#announcedTables} array if
   * the table is unique and falls within the peer limit {@link CypherPoker#maxCapturesPerPeer}.
   * When the {@link CypherPoker#announcedTables} array reaches the {@link CypherPoker#maxCapturedTables}
   * limit, the last table is <code>pop</code>ped off of the end of the array and
   * the new table is <code>unshift</code>ed into it. In this way the table announcements
   * are always in chronological order of receipt with the smallest index being
   * the newest.
   *
   * @param {Object} tableResult A JSON-RPC 2.0 <code>result</code> object containing
   * a valid {@link TableObject} in its <code>data</code> property.
   * @return {Boolean} True if the table was succesfully captured, false if it was
   * out of limit(s) or otherwise unqualified.
   * @private
   */
   captureTable(tableResult) {
      if (this._announcedTables == undefined) {
         this._announcedTables = new Array();
      }
      if (this.isTableValid(tableResult.data) == false) {
         return (false);
      }
      var numTables = 0;
      for (var count=0; count < this._announcedTables.length; count++) {
         if (this._announcedTables[count].ownerPID == tableResult.from) {
            numTables++;
            if (this._announcedTables[count].tableID == tableResult.data.tableID) {
               //table previously announced by this peer
               return (false);
            }
            if (numTables > this.maxCapturesPerPeer) {
               //too many table announcements from this peer
               return (false);
            }
         }
      }
      var newTable = new Object();
      this.copyTable(tableResult.data, newTable);
      newTable.toString = function() {
         return ("[object TableObject]");
      }
      this.debug("CypherPoker.captureTable("+newTable+")");
      newTable.ownerPID = tableResult.from; //make sure only owner can announce their own table
      this._announcedTables.unshift(tableResult.data); //add table to the beginning of array
      if (this._announcedTables.length > this.maxCapturedTables) {
         this._announcedTables.pop(); //remove the last table from end of array
      }
      return (true);
   }

   /**
   * Creates a CypherPoker.JS table message. Since the format of this message
   * may change, this is the preferred way to create a message rather than
   * creating your own object.
   *
   * @param {String} messageType The CypherPoker.JS table message type to create.
   *
   * @return {Object} A formatted CypherPoker.JS table message. Additional data
   * can be appended to this object before sending it over a peer-to-peer network.
   * @private
   */
   buildCPMessage(messageType) {
      var messageObj=new Object();
      messageObj.cpMsg = messageType;
      return (messageObj);
   }

   /**
   * Verifies if a supplied object is a valid CypherPoker.JS message.
   *
   * @param {Object} message The object to examine.
   *
   * @return {Boolean} True if the object seems to be a valid CypherPoker.JS message
   * (though it may not be supported).
   * @private
   */
   isCPMessage(message) {
      if ((message["cpMsg"] == undefined) || (message["cpMsg"] == null) || (message["cpMsg"] == "")) {
         //not a CypherPoker.JS message or it's blank (mo message type)
         return (false);
      }
      return (true);
   }

   /**
   * Verifies if a supplied message event object contains a valid CypherPoker.JS message.
   *
   * @param {Event} event The "message" event, as usually dispatched by the
   * peer-to-peer interface, to examine.
   *
   * @return {Boolean} True if the event contains a valid CypherPoker.JS message
   * (though its type may not be supported).
   * @private
   */
   isCPMsgEvent(event) {
      try {
         if (typeof(event["data"]) != "object") {
            //not sure what this is
            return (false);
         }
         if (typeof(event.data["result"]) != "object") {
            //may not be a JSON-RPC message
            return (false);
         }
         if (typeof(event.data.result["data"]) != "object") {
            //not a CypherPoker-formatted message
            return (false);
         }
         return (this.isCPMessage(event.data.result.data));
      } catch (err) {
         return (false);
      }
   }

   /**
   * @private
   */
   toString() {
      return ("[object CypherPoker]")
   }

}
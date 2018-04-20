const { events } = require('./util/constants');
const Message = require('./structures/Message');
const ipc = require('node-ipc');

const hasKey = Object.prototype.hasOwnProperty;

module.exports = class Server {

	constructor(name, options) {
		if (hasKey.call(options, 'ipc')) {
			// Assign the configs
			ipc.config = Object.assign(ipc.config, options.ipc);
		} else {
			ipc.config.id = name;
		}

		Object.defineProperties(this, {
			/**
			 * The connected sockets
			 * @name Server#_sockets
			 * @since 0.0.1
			 * @type {Set<string>}
			 * @readonly
			 * @private
			 */
			_sockets: { value: new Set() },

			/**
			 * The promises
			 * @name Server#_promises
			 * @since 0.0.1
			 * @type {Promise<string, { resolve: Function, reject: Function }>}
			 * @readonly
			 * @private
			 */
			_promises: { value: new Map() },

			/**
			 * Whether the IPC server is ready or not
			 * @name Server#_ready
			 * @since 0.0.1
			 * @type {boolean}
			 * @private
			 */
			_ready: { value: false, writable: true }
		});

		/**
		 * The IPC client that manages this instance
		 * @since 0.0.1
		 * @type {NodeIPC.IPC}
		 */
		this.ipc = ipc;

		// Initialize this server
		this._init(options.path);
	}

	/**
	 * The name of this Server instance
	 * @since 0.0.1
	 * @type {string}
	 * @readonly
	 */
	get name() {
		return ipc.config.id;
	}

	/**
	 * Send a message to a socket
	 * @since 0.0.1
	 * @param {string} name The name of the channel to send the message to
	 * @param {Object<string, *>} data The data to send to the socket
	 * @param {boolean} success Whether this action has been successful or not
	 * @returns {Promise<Object<string, *>>}
	 */
	async send(name, data = {}, success = true) {
		if (!this.hasSocket(name)) await this.connectTo(name);
		const requestID = hasKey.call(data, 'id') ? data.id : Server._generateID();
		return this._sendRequest(this.getSocket(name), {
			id: requestID,
			sentBy: this.name,
			success,
			data
		});
	}

	/**
	 * Get a socket by its name
	 * @since 0.0.1
	 * @param {string} name The name of the socket
	 * @returns {IPC.Socket}
	 */
	getSocket(name) {
		return ipc.of[name];
	}

	/**
	 * Check if this Server instance is connected to a socket by its name
	 * @since 0.0.1
	 * @param {string} name The name of the socket
	 * @returns {boolean}
	 */
	hasSocket(name) {
		return this._sockets.has(name);
	}

	/**
	 * Listen to an event.
	 * @since 0.0.1
	 * @param {string} event The arguments to pass to the server's emitter
	 * @param {Function} callback The callback to run in the server's emitter
	 * @returns {NodeIPC.Client}
	 */
	on(event, callback) {
		if (event === events.MESSAGE) {
			return ipc.server.on(event, (data) => {
				callback(new Message(JSON.parse(data)));
			});
		}
		if (event === events.RAW) event = events.MESSAGE;
		return ipc.server.on(event, callback);
	}

	/**
	 * Listen to an event only once.
	 * @since 0.0.1
	 * @param {string} event The arguments to pass to the server's emitter
	 * @param {Function} callback The callback to run in the server's emitter
	 * @returns {NodeIPC.Client}
	 */
	once(event, callback) {
		if (event === events.MESSAGE) {
			return ipc.server.once(event, (data) => {
				callback(new Message(JSON.parse(data)));
			});
		}
		if (event === events.RAW) event = events.MESSAGE;
		return ipc.server.once(event, callback);
	}

	/**
	 * Start this Server
	 * @since 0.0.1
	 * @param {string} reason The reason to start
	 */
	start(reason) {
		ipc.server.start();
		if (this.listenerCount(events.START)) this.emit(events.START, reason);
	}

	/**
	 * Stop this Server
	 * @since 0.0.1
	 * @param {string} reason The reason to stop
	 */
	stop(reason) {
		ipc.server.stop();
		if (this.listenerCount(events.STOP)) this.emit(events.STOP, reason);
	}

	/**
	 * Destroy this Server
	 * @since 0.0.1
	 */
	destroy() {
		// Clear the queue
		for (const promise of this._promises.values()) {
			promise.reject({ reason: 'Client destroyed.' });
		}
		this._promises.clear();

		// Disconnect from all channels
		for (const socket of this._sockets) {
			ipc.disconnect(socket);
		}
		this._sockets.clear();

		// Stop this server
		this.stop();
	}

	/**
	 * Connect to a socket
	 * @since 0.0.1
	 * @param {string} name The name of the socket to connect to
	 * @returns {Promise<void>}
	 */
	connectTo(name) {
		return new Promise((resolve, reject) => {
			ipc.connectTo(name, () => ipc.of[name]
				.on('message', (data) => {
					const parsed = JSON.parse(data);
					const promis = this._promises.get(parsed.id);
					if (promis) {
						this._promises.delete(parsed.id);
						promis[parsed.success ? 'resolve' : 'reject'](parsed);
					}
				})
				.once('connect', () => {
					this._sockets.add(name);
					resolve();
				})
				.once('destroy', () => {
					this._sockets.delete(name);
					reject();
				})
			);
		});
	}

	_sendRequest(socket, data) {
		this.client.server.emit(socket, 'message', JSON.stringify(data));
		this._replied = true;

		return new Promise((resolve, reject) => {
			this.promises.set(data.id, { resolve, reject });
		});
	}

	_init(path) {
		if (this._ready) return;

		ipc.serve(path);
		this.start();
	}

	static _generateID() {
		return Date.now().toString(36) + String.fromCharCode((1 % 26) + 97);
	}

};

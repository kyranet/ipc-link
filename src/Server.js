const { EventEmitter } = require('events');
const { events } = require('./util/constants');
const Message = require('./structures/Message');
const ipc = require('node-ipc');

module.exports = class Server extends EventEmitter {

	constructor(name, options) {
		super();

		// Assign the configs
		if (options) {
			ipc.config = { ...ipc.config, ...options, id: name };
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
			 * @type {Map<string, { resolve: Function, reject: Function }>}
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
		this._init(name);
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
	 * @returns {Promise<Object<string, *>>}
	 */
	async send(name, data = {}) {
		if (!this.hasSocket(name)) await this.connectTo(name);
		const requestID = 'id' in data ? data.id : Server._generateID();
		return this._sendRequest(this.getSocket(name), {
			id: requestID,
			sentBy: this.name,
			data
		});
	}

	/**
	 * Get a socket by its name
	 * @since 0.0.1
	 * @param {string} name The name of the socket
	 * @returns {Socket}
	 */
	getSocket(name) {
		return (ipc.of[name] && ipc.of[name].socket) || null;
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
	 * @returns {this}
	 */
	on(event, callback) {
		const eventName = event === events.MESSAGE ? event : event === events.RAW ? events.MESSAGE : event;
		const listener = event === events.MESSAGE ? (data, socket) => callback(new Message(this, socket, JSON.parse(data))) : callback;

		if (!this.listenerCount(eventName)) {
			super.on(eventName, listener);
			ipc.server.on(eventName, this.emit.bind(this, eventName));
		}

		return this;
	}

	/**
	 * Listen to an event only once.
	 * @since 0.0.1
	 * @param {string} event The arguments to pass to the server's emitter
	 * @param {Function} callback The callback to run in the server's emitter
	 * @returns {this}
	 */
	once(event, callback) {
		const eventName = event === events.MESSAGE ? event : event === events.RAW ? events.MESSAGE : event;
		const listener = event === events.MESSAGE ? (data, socket) => callback(new Message(this, socket, JSON.parse(data))) : callback;

		if (!this.listenerCount(eventName)) {
			super.once(eventName, listener);
			ipc.server.once(eventName, this.emit.bind(this, eventName));
		}

		return this;
	}

	/**
	 * Start this Server
	 * @since 0.0.1
	 * @param {string} [reason=''] The reason to start
	 * @returns {this}
	 */
	start(reason = '') {
		ipc.server.start();
		if (this.listenerCount(events.START)) this.emit(events.START, reason);

		return this;
	}

	/**
	 * Stop this Server
	 * @since 0.0.1
	 * @param {string} [reason=''] The reason to stop
	 * @returns {this}
	 */
	stop(reason = '') {
		ipc.server.stop();
		if (this.listenerCount(events.STOP)) this.emit(events.STOP, reason);

		return this;
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

		this.removeAllListeners();

		// Stop this server
		if (this._ready) this.stop();
	}

	/**
	 * Connect to a socket
	 * @since 0.0.1
	 * @param {string} name The name of the socket to connect to
	 * @returns {Promise<void>}
	 */
	connectTo(name) {
		return new Promise((resolve, reject) => {
			let ignore = false;
			ipc.connectTo(name, () => ipc.of[name]
				.on('message', (data) => {
					const parsed = JSON.parse(data);
					const promis = this._promises.get(parsed.id);
					if (promis) {
						this._promises.delete(parsed.id);
						promis[parsed.success ? 'resolve' : 'reject'](parsed);
					}
				})
				.once('disconnect', () => {
					if (!ignore) reject(`Could not connect to ${name}`);
				})
				.once('connect', () => {
					ignore = true;
					this._sockets.add(name);
					resolve();
				})
				.once('destroy', () => {
					ignore = true;
					this._sockets.delete(name);
					reject();
				})
			);
		});
	}

	_sendRequest(socket, data) {
		return new Promise((resolve, reject) => {
			ipc.server.emit(socket, 'message', JSON.stringify(data));
			this._promises.set(data.id, { resolve, reject });
		});
	}

	_init() {
		if (this._ready) return;

		ipc.serve();
	}

	static _generateID() {
		return Date.now().toString(36) + String.fromCharCode((1 % 26) + 97);
	}

};

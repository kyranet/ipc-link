class Message {

	constructor(client, socket, response) {
		Object.defineProperties(this, {
			/**
			 * The Client that manages this instance
			 * @name Message#client
			 * @since 0.0.1
			 * @type {Server}
			 * @readonly
			 */
			client: { value: client },

			/**
			 * The ID of this response
			 * @name Message#id
			 * @since 0.0.1
			 * @type {string}
			 * @readonly
			 */
			id: { value: response.id },

			/**
			 * The name of the socket that sent this message
			 * @name Message#sentBy
			 * @since 0.0.1
			 * @type {string}
			 * @readonly
			 */
			sentBy: { value: response.sentBy },

			/**
			 * The socket that sent this message
			 * @name Message#socket
			 * @since 0.0.1
			 * @type {IPC.Socket}
			 * @readonly
			 */
			socket: { value: socket },

			/**
			 * Whether this message has been replied or not
			 * @name Message#_replied
			 * @since 0.0.1
			 * @type {boolean}
			 * @private
			 */
			_replied: { value: false, configurable: true }
		});

		/**
		 * The data this Message instance contains
		 * @since 0.0.1
		 * @type {Object<string, *>}
		 */
		this.data = response.data;
	}

	/**
	 * Reply this message to the socket
	 * @since 0.0.1
	 * @param {Object<string, *>} data The data to send
	 * @param {boolean} [success] Whether the operation has been successful or not
	 * @returns {Promise<Object<string, *>>}
	 */
	reply(data, success = true) {
		if (this._replied) {
			return Promise.reject(`The request ${this.id} has already been replied and cannot be replied again.`);
		}
		this._replied = true;
		return this.client._sendRequest(this.socket, { success, ...data });
	}

}

module.exports = Message;

module.exports = {
	version: require('../package.json').version,

	// Server
	Server: require('./Server'),

	// Structures
	Message: require('./structures/Message'),

	// Utils
	constants: require('./util/constants')
};

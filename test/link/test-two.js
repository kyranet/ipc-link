const { Server } = require('../../src/index');

console.log('Spawned test-two!');
new Server('test-two', { retry: 1500, silent: true })
	.on('message', message => {
		console.log(message);
		console.log(message.id, message.sentBy);
		message.reply({ test: 'Hello! I got your response back!' }, false);
	})
	.on('error', console.error)
	.once('start', (reason) => console.log('Successfully started!', reason))
	.start('Login!');

const { Server } = require('../../src/index');

console.log('Spawned test-one!');

new Server('test-one', { retry: 1500, silent: true })
	.on('message', console.log)
	.on('error', console.error)
	.once('start', () => { console.log('Successfully started!'); })
	.start()
	.send('test-two', { test: 'Hello!' })
	.then(console.log)
	.catch(console.error);

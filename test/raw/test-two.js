const ipc = require('node-ipc');

ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.config.id = 'test-two';

ipc.serve(() => {
	ipc.server.on('message', console.log);
	ipc.server.on('error', console.error);
	ipc.server.on('disconnect', () => console.error('Disconnected!'));
	console.log('Successfully started!');
});

ipc.server.start();

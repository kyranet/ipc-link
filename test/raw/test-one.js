const ipc = require('node-ipc');

ipc.config.retry = 1500;
ipc.config.silent = true;
ipc.config.id = 'test-one';

const promises = new Map();

ipc.serve(() => {
	ipc.server.on('message', console.log);
	ipc.server.on('error', console.error);
	ipc.server.on('disconnect', () => console.error('Disconnected!'));
	console.log('Successfully started!');
});

ipc.connectTo('test-two', () => {
	ipc.of['test-two']
		.on('message', (data) => {
			const parsed = JSON.parse(data);
			const promis = promises.get(parsed.id);
			if (promis) {
				promises.delete(parsed.id);
				promis[parsed.success ? 'resolve' : 'reject'](parsed);
			}
		})
		.on('disconnect', () => console.error('Disconnected!'));

	ipc.server.emit(ipc.of['test-two'].socket, 'message', { test: 'Hello!' });
});

ipc.server.start();

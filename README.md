# IPC-Link

**IPC-Link** is a mini-framework for node-ipc that is fully compatible with TypeScript (and in a near future, ECMAScript Modules). It is designed to have "connection channels" where two processes send data back and forth.

This framework has a queue system that holds `Promise`s temporarily until the message has been replied back, and depending on the variable `success`, it may or may not reject said Promise.

## Usage

You can check examples [here](https://github.com/kyranet/ipc-link/tree/master/test/link).

**Process One**:

```javascript
const { Server } = require('../../src/index');

console.log('Spawned test-one!');
new Server('test-one', { retry: 1500, silent: true })
	.on('message', console.log)
	.on('error', console.error)
	.once('start', (reason) => { console.log('Successfully started!', reason); })
	.start('Login!');
	.send('test-two', { content: 'Hello' })
	.then(console.log)
	.catch(console.error);
```

**Process Two**:

```javascript
const { Server } = require('../../src/index');

console.log('Spawned test-two!');
new Server('test-two', { retry: 1500, silent: true })
	.on('message', message => { message.reply({ response: `${message.data.content} world!` }); })
	.on('error', console.error)
	.once('start', (reason) => { console.log('Successfully started!', reason); })
	.start('Login!');
```

**Process One** will send **Process Two** an object with content `Hello`, **Process Two** receives back and replies it with `Hello` (content sent by the first process) and sends another object with `response: 'Hello world!'` to **Process One**. Evaluating `.send('test-two', { content: 'Hello' })` to `Promise<{ id, success: true, response: 'Hello World' }>`, which is logged to console.

## Specification

It is important that you have a single `IPCLink.Server` instance because `node-ipc` is basically a singleton, and creating multiple instances of this may duplicate messages or corrupt the configuration. In a near future, `node-ipc` may get rewritten in a fork or in a `backends/` folder in this repository for further support with latest versions of Node.js (`new Buffer()` is being used, which is deprecated starting from Node.js 10).

**Process One**

1. Let `server` be the result of evaluating `new Server(name, options);`.
1. Consider there is a `message` event being listened in `server`.
1. Consider `server.start();` has already been called.
1. Let `socketName` be a string, e.g. `'world'`.
1. Let `data` be an object literal, e.g. `{ test: 'Hello ' }`.
1. Perform `server.send(socketName, data);`.
1. Let `senderSocket` be the *Socket* instance from this process.
1. Let `hasSocket` be the result of evaluating `server.hasSocket(name);`.
1. If `hasSocket` is `true`, skip to the next point. Otherwise,
	1. connect to the socket via `server.connectTo` and *await* its evaluation.
1. Let `socket` be the result of evaluating `server.getSocket(name);`.
	1. Let `IPCSocketCollection` be an object of `NodeIPC.Server`s.
	1. Let `IPCSocketServer` be the result of accessing to the property `name` of `IPCSocketCollection`.
	1. If `IPCSocketServer` is `undefined`, let `socket` be `null`. Otherwise
		1. Let `socket` be `IPCSocketServer.socket`, being this a *Socket* instance.
1. If `data` has a property of `id`, let `id` be `data.id`. Otherwise let `id` be a random base36 number generated automatically.
1. Let `preparedData` be an object where:
	- `id` refers to `id`.
	- `sentBy` refers to `server.name`.
	- `data` refers to `data`.
1. Let `stringifiedData` be the result of evaluating `JSON.stringify(preparedData);`.
1. Perform `socket.write`, sending `stringifiedData` to the *Socket*.
1. Let `temporalPromise` be a *Promise* evaluated with `new Promise();`.
1. Let `resolve` and `reject` be the first and second parameters from `temporalPromise`'s callbacks.
1. Let `queuePromise` be an object where:
	- `resolve` refers to `resolve`.
	- `reject` refers to `reject`.
1. Let `promiseCollection` be the *internal* Promise collection from IPC-Link of type `Map<string, { resolve: Function, reject: Function }>;`.
1. Perform `promiseCollection.set(id, queuePromise);`.
1. Return `queuePromise`.

**Process Two**

1. Let `receiverServer` be the result of evaluating `new Server(name, options);` in the target process.
1. Let `messagePayload` be the result of evaluating `JSON.parse(stringifiedData);`.
1. Let `message` be the result of evaluating `new Message(receiverServer, senderSocket, messagePayload);`.
1. Send `message` to `receiverServer`'s *EventEmitter* for its handling.
1. Let `responseData` be an object.
1. If `responseData` has a property of `success`, let `success` be `responseData.success`. Otherwise
	1. Let `successArgument` be the result of evaluating the third argument from `Server#send`.
	1. If `successArgument` is `undefined`, let `success` be `true`. Otherwise let `success` be `successArgument`.
1. Let `finalizedResponseData` be an object where:
	- `id` refers to `id`.
	- `success` refers to `success`.
	- All properties of `responseData` are applied over the properties of `id` and `success`.
1. Let `stringifiedResponseData` be the result of evaluating `JSON.stringify(finalizedResponseData);`.
1. Perform `senderSocket.write`, sending `stringifiedResponseData` to the *Socket*.

**Process One**

1. Let `parsedResponseData` be the result of evaluating `JSON.parse(stringifiedResponseData);`.
1. Let `responseID` be the result of evaluating `parsedResponseData.id`.
1. If `responseID` does not equals to `id` via *Strict Equality Comparison*,
	1. Ignore the request. Otherwise,
	1. Let `promise` be `queuePromise`.
		1. Let `successResponse` be the result of evaluating `parsedResponseData.success`.
		1. If `successResponse` is `true`, evaluate `promise.resolve(parsedResponseData);`, resolving `temporalPromise` with the value of `parsedResponseData`. Otherwise evaluate `promise.reject(parsedResponseData);`, rejecting `temporalPromise` with the value of `parsedResponseData`.

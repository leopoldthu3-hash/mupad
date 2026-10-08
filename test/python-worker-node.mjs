// Browser-worker transport adapter only. Python itself is the unchanged local WASM runtime.
import {parentPort, workerData} from 'node:worker_threads';
globalThis.self = globalThis;
globalThis.postMessage = data => parentPort.postMessage(data);
parentPort.on('message', data => globalThis.onmessage?.({data}));
await import(workerData.url);

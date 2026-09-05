// Preload for offline tests/builds only: fail before any Mongo connection can be attempted.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node loads this guard as a CommonJS preload.
const Module = require('node:module');
const original = Module._load;
const denied = () => { throw new Error('DATABASE_ACCESS_BLOCKED_IN_OFFLINE_VALIDATION'); };
Module._load = function (id, ...args) {
  const exported = original.call(this, id, ...args);
  if (id === 'mongoose') {
    exported.connect = denied;
    exported.createConnection = denied;
    exported.Connection.prototype.openUri = denied;
  }
  if (id === 'mongodb' && exported.MongoClient) {
    exported.MongoClient.connect = denied;
    exported.MongoClient.prototype.connect = denied;
  }
  return exported;
};

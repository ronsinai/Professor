const Redis = require('redis');
const { promisify } = require('util');

let client;

const connect = (url, index) => {
  if (!client) {
    client = Redis.createClient(`${url}/${index}`);

    client.sadd = promisify(client.sadd).bind(client);
    client.smembers = promisify(client.smembers).bind(client);
    client.flushdb = promisify(client.flushdb).bind(client);
    client.quit = promisify(client.quit).bind(client);
  }

  return client;
};

const initDB = async (config) => {
  await client.flushdb();

  const keys = Object.keys(config);
  await Promise.all(
    keys.map(async (key) => await client.sadd(key, config[key])),
  );
};

const close = async () => {
  await client.quit();
};

const getClient = () => client;

module.exports = {
  connect,
  initDB,
  close,
  getClient,
};

const Redis = require('../../app/utils/redis');

const flushDB = async () => {
  await Redis.flushDB();
};

async function readKey(key) {
  return await Redis.getClient().smembers(key);
}

const setKey = async (key, members) => {
  await Redis.getClient().sadd(key, members);
};

module.exports = {
  flushDB,
  readKey,
  setKey,
};

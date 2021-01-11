const Redis = require('../../app/utils/redis');

const initDB = async (config) => {
  await Redis.initDB(config);
};

async function readKey(key) {
  return await Redis.getClient().smembers(key);
}

const setKey = async (key, members) => {
  await Redis.getClient().sadd(key, members);
};

module.exports = {
  initDB,
  readKey,
  setKey,
};

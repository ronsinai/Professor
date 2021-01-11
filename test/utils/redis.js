const Redis = require('../../app/utils/redis');

const flushDB = async () => {
  await Redis.flushDB();
};

module.exports = {
  flushDB,
};

const { getClient } = require('.');

class RedisOperations {
  constructor() {
    this.client = getClient();
  }

  async getMembers(key) {
    return await this.client.smembers(key);
  }

  async setMembers(key, members) {
    return await this.client.sadd(key, members);
  }

  async remMembers(key, members) {
    return await this.client.srem(key, members);
  }
}

module.exports = RedisOperations;

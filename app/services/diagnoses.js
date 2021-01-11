const { getLogger } = require('../utils/logger');
const RedisOperations = require('../utils/redis/operations');

const logger = getLogger();

class DiagnosesService {
  constructor() {
    this.redis = new RedisOperations();
  }

  async get(imagingId) {
    try {
      const diagnoses = await this.redis.getMembers(imagingId);
      logger.info(`Current potential diagnoses of imaging ${imagingId} are: ['${diagnoses.join("', '")}']`);
      return diagnoses;
    }
    catch (err) {
      logger.error(`Failed to read current potential diagnoses of imaging ${imagingId}`);
      throw err;
    }
  }

  async empty(imagingId) {
    try {
      const diagnoses = await this.redis.delMembers(imagingId);
      logger.info(`Emptied current potential diagnoses of imaging ${imagingId}`);
      return diagnoses;
    }
    catch (err) {
      logger.error(`Failed to empty current potential diagnoses of imaging ${imagingId}`);
      throw err;
    }
  }
}

module.exports = DiagnosesService;

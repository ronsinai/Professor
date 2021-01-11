const { getLogger } = require('../utils/logger');
const RedisOperations = require('../utils/redis/operations');

const logger = getLogger();

class DiagnosesService {
  constructor() {
    this.redis = new RedisOperations();
  }

  async update(imagingId, diagnosis) {
    let diagnoses = [];

    try {
      await this.redis.remMembers(imagingId, diagnosis);
      logger.info(`Removing diagnosis ${diagnosis} of imaging ${imagingId}`);
    }
    catch (err) {
      logger.error(`Failed to remove diagnosis ${diagnosis} of imaging ${imagingId}`);
      throw err;
    }

    try {
      diagnoses = await this.redis.getMembers(imagingId);
      logger.info(`Current potential diagnoses of imaging ${imagingId} are: ['${diagnoses.join("', '")}']`);
      return diagnoses;
    }
    catch (err) {
      logger.error(`Failed to read current potential diagnoses of imaging ${imagingId}`);
      throw err;
    }
  }
}

module.exports = DiagnosesService;

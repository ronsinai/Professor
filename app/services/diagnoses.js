const { getLogger } = require('../utils/logger');
const RedisOperations = require('../utils/redis/operations');

const logger = getLogger();

class DiagnosesService {
  constructor() {
    this.redis = new RedisOperations();
  }

  async update(imagingId, imagingType) {
    let diagnoses = [];

    try {
      diagnoses = await this.redis.getMembers(imagingType);
      logger.info(`Potential diagnoses of imaging ${imagingId} of type ${imagingType} are: ['${diagnoses.join("', '")}']`);
    }
    catch (err) {
      logger.error(`Failed to read potential diagnoses of imaging ${imagingId} of type ${imagingType}`);
      throw err;
    }

    try {
      await this.redis.setMembers(imagingId, diagnoses);
      logger.info(`Initialized imaging ${imagingId} of type ${imagingType} with potential diagnoses: ['${diagnoses.join("', '")}']`);
    }
    catch (err) {
      logger.error(`Failed to initialize imaging ${imagingId} of type ${imagingType}`);
      throw err;
    }
  }
}

module.exports = DiagnosesService;

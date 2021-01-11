const { DiagnosesService } = require('../../services');
const { getLogger } = require('../logger');
const { getMQ } = require('.');

const logger = getLogger();

class MQOperations {
  constructor(inQueue, outExchange, options = {}) {
    this.channel = getMQ();
    this.diagnosesService = new DiagnosesService();

    this.inQueue = inQueue;
    this.outExchange = outExchange;

    this.NO_ACK = false;
    this.PERSISTENT = true;
    this.REQUEUE_ON_MSG_ERR = false;
    this.REQUEUE_ON_PUB_ERR = true;

    this.options = options;
    this.options.persistent = this.PERSISTENT;
  }

  async publish(key, content) {
    // eslint-disable-next-line max-len
    await this.channel.publish(this.outExchange, key, Buffer.from(JSON.stringify(content)), this.options);
  }

  async _msgHandler(msg) {
    let imagingId;

    try {
      imagingId = JSON.parse(msg.content.toString());
      logger.info(`Consumed discharge of imaging ${imagingId}`);
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_MSG_ERR);
      return logger.error(`Rejected discharge of imaging ${imagingId} with requeue=${this.REQUEUE_ON_MSG_ERR}`);
    }

    try {
      const diagnoses = await this.diagnosesService.get(imagingId);
      if (diagnoses.length) {
        await this.publish(msg.fields.routingKey, imagingId);
        logger.info(`Published discharge of imaging ${imagingId} to ${this.outExchange} exchange`);

        try {
          await this.diagnosesService.empty(imagingId);
        }
        catch (err) {
          logger.error(err);
        }
      }
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_PUB_ERR);
      return logger.error(`Rejected discharge of imaging ${imagingId} with requeue=${this.REQUEUE_ON_PUB_ERR}`);
    }

    this.channel.ack(msg);
    return logger.info(`Acked discharge of imaging ${imagingId}`);
  }

  async consume() {
    await this.channel.consume(
      this.inQueue,
      this._msgHandler.bind(this),
      { noAck: this.NO_ACK },
    );
  }
}

module.exports = MQOperations;

const Joi = require('joi');

const { DiagnosesService } = require('../../services');
const { imagingSchema } = require('../../schemas');
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
    let imaging = {};

    try {
      imaging = JSON.parse(msg.content.toString());
      Joi.assert(imaging, imagingSchema);
      logger.info(`Consumed imaging ${imaging._id}`);
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_MSG_ERR);
      return logger.error(`Rejected imaging ${imaging._id} with requeue=${this.REQUEUE_ON_MSG_ERR}`);
    }

    try {
      await this.diagnosesService.update(imaging._id, imaging.type);
      await this.publish(msg.fields.routingKey, imaging._id);
      logger.info(`Published delayed discharge of imaging ${imaging._id} to ${this.outExchange} exchange`);
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_PUB_ERR);
      return logger.error(`Rejected imaging ${imaging._id} with requeue=${this.REQUEUE_ON_PUB_ERR}`);
    }

    this.channel.ack(msg);
    return logger.info(`Acked imaging ${imaging._id}`);
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

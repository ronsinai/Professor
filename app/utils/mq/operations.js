const Joi = require('joi');

const { DiagnosesService } = require('../../services');
const { diagnosisSchema } = require('../../schemas');
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
    let diagnosis = {};
    let imagingId;

    try {
      diagnosis = JSON.parse(msg.content.toString());
      Joi.assert(diagnosis, diagnosisSchema);
      imagingId = diagnosis.imagingId;
      diagnosis = diagnosis.diagnosis;
      logger.info(`Consumed ${diagnosis} diagnosis of imaging ${imagingId}`);
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_MSG_ERR);
      return logger.error(`Rejected ${diagnosis} diagnosis of imaging ${imagingId} with requeue=${this.REQUEUE_ON_MSG_ERR}`);
    }

    try {
      const diagnoses = await this.diagnosesService.update(imagingId, diagnosis);
      if (!diagnoses.length) {
        await this.publish(msg.fields.routingKey, imagingId);
        logger.info(`Published discharge of imaging ${imagingId} to ${this.outExchange} exchange`);
      }
    }
    catch (err) {
      logger.error(err);
      this.channel.reject(msg, this.REQUEUE_ON_PUB_ERR);
      return logger.error(`Rejected ${diagnosis} diagnosis of imaging ${imagingId} with requeue=${this.REQUEUE_ON_PUB_ERR}`);
    }

    this.channel.ack(msg);
    return logger.info(`Acked ${diagnosis} diagnosis of imaging ${imagingId}`);
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

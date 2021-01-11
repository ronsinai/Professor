const Nconf = require('nconf');

const { getLogger } = require('./utils/logger');
const MQ = require('./utils/mq');
const MQOperations = require('./utils/mq/operations');
const Redis = require('./utils/redis');

const logger = getLogger();

class App {
  async start() {
    try {
      this._connectToRedis();
      await this._connectToMQ();
    }
    catch (err) {
      logger.error(err);
      throw err;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async _connectToMQ() {
    await MQ.connect(Nconf.get('AMQP_URI'));
    logger.info(`Professor-Diagnoses : connected to rabbitmq at ${Nconf.get('AMQP_URI')}`);

    await MQ.setUp(
      Nconf.get('AMQP_IN_EXCHANGE'),
      Nconf.get('AMQP_IN_EXCHANGE_TYPE'),
      Nconf.get('AMQP_IN_QUEUE'),
      Nconf.get('AMQP_IN_PATTERNS').split(' '),
    );
    await MQ.setUp(
      Nconf.get('AMQP_OUT_EXCHANGE'),
      Nconf.get('AMQP_OUT_EXCHANGE_TYPE'),
      Nconf.get('AMQP_OUT_QUEUE'),
      Nconf.get('AMQP_OUT_PATTERNS').split(' '),
    );

    this.mq = new MQOperations(
      Nconf.get('AMQP_IN_QUEUE'),
      Nconf.get('AMQP_OUT_EXCHANGE'),
    );

    logger.info(
      `Professor-Diagnoses : `
      + `consuming from ${Nconf.get('AMQP_IN_EXCHANGE')} exchange through ${Nconf.get('AMQP_IN_QUEUE')} queue `
      + `with patterns: ['${Nconf.get('AMQP_IN_PATTERNS').split(' ').join("', '")}']`,
    );
    await this.mq.consume();
  }

  // eslint-disable-next-line class-methods-use-this
  async _closeMQConnection() {
    await MQ.close();
    logger.info(`Professor-Diagnoses : disconnected from rabbitmq at ${Nconf.get('AMQP_URI')}`);
  }

  // eslint-disable-next-line class-methods-use-this
  _connectToRedis() {
    Redis.connect(Nconf.get('REDIS_URI'), Nconf.get('REDIS_INDEX'));
    logger.info(`Professor-Diagnoses : connected to redis at ${Nconf.get('REDIS_URI')}/${Nconf.get('REDIS_INDEX')}`);
  }

  // eslint-disable-next-line class-methods-use-this
  async _closeRedisConnection() {
    await Redis.close();
    logger.info(`Professor-Diagnoses : disconnected from redis at ${Nconf.get('REDIS_URI')}/${Nconf.get('REDIS_INDEX')}`);
  }

  async stop() {
    try {
      await this._closeMQConnection();
      await this._closeRedisConnection();
    }
    catch (err) {
      logger.error(err);
      throw err;
    }
    logger.info(`Professor-Diagnoses : shutting down`);
  }
}

module.exports = App;

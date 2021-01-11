const Nconf = require('nconf');

const { getLogger } = require('./utils/logger');
const MQ = require('./utils/mq');
const MQOperations = require('./utils/mq/operations');
const Redis = require('./utils/redis');

const logger = getLogger();

class App {
  async start() {
    try {
      await this._connectToRedis();
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
    logger.info(`Professor-Imagings : connected to rabbitmq at ${Nconf.get('AMQP_URI')}`);

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
      { arguments: { 'x-delayed-type': Nconf.get('AMQP_OUT_DELAYED_EXCHANGE_TYPE') } },
    );

    this.mq = new MQOperations(
      Nconf.get('AMQP_IN_QUEUE'),
      Nconf.get('AMQP_OUT_EXCHANGE'),
      { headers: { 'x-delay': Nconf.get('DELAY') } },
    );

    logger.info(
      `Professor-Imagings : `
      + `consuming from ${Nconf.get('AMQP_IN_EXCHANGE')} exchange through ${Nconf.get('AMQP_IN_QUEUE')} queue `
      + `with patterns: ['${Nconf.get('AMQP_IN_PATTERNS').split(' ').join("', '")}']`,
    );
    await this.mq.consume();
  }

  // eslint-disable-next-line class-methods-use-this
  async _closeMQConnection() {
    await MQ.close();
    logger.info(`Professor-Imagings : disconnected from rabbitmq at ${Nconf.get('AMQP_URI')}`);
  }

  // eslint-disable-next-line class-methods-use-this
  async _connectToRedis() {
    Redis.connect(Nconf.get('REDIS_URI'), Nconf.get('REDIS_INDEX'));
    await Redis.initDB(Nconf.get('diagnoses'));
    logger.info(`Professor-Imagings : connected to redis at ${Nconf.get('REDIS_URI')}/${Nconf.get('REDIS_INDEX')}`);
  }

  // eslint-disable-next-line class-methods-use-this
  async _closeRedisConnection() {
    await Redis.close();
    logger.info(`Professor-Imagings : disconnected from redis at ${Nconf.get('REDIS_URI')}/${Nconf.get('REDIS_INDEX')}`);
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
    logger.info(`Professor-Imagings : shutting down`);
  }
}

module.exports = App;

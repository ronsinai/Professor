const Nconf = require('nconf');

Nconf.use('memory');
Nconf.argv().env().defaults({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  REDIS_URI: 'redis://localhost:6379',
  REDIS_INDEX: 1,
  AMQP_URI: 'amqp://localhost:5672',
  AMQP_IN_EXCHANGE: 'test_imagings',
  AMQP_IN_EXCHANGE_TYPE: 'topic',
  AMQP_IN_QUEUE: 'test_imagings-delayed',
  AMQP_IN_PATTERNS: '#',
  AMQP_OUT_EXCHANGE: 'test_discharges-delayed',
  AMQP_OUT_EXCHANGE_TYPE: 'x-delayed-message',
  AMQP_OUT_DELAYED_EXCHANGE_TYPE: 'fanout',
  DELAY: 300000,
}).file({ file: './config.json' });

const Consumer = require('../app');
const { initDB } = require('./utils/redis');

before(async () => {
  global.consumerInstance = new Consumer();
  await global.consumerInstance.start();
});

beforeEach(async () => await initDB(Nconf.get('diagnoses')));

after(async () => await global.consumerInstance.stop());

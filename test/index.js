const Nconf = require('nconf');

Nconf.use('memory');
Nconf.argv().env().defaults({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  REDIS_URI: 'redis://localhost:6379',
  REDIS_INDEX: 1,
  AMQP_URI: 'amqp://localhost:5672',
  AMQP_IN_EXCHANGE: 'test_diagnoses',
  AMQP_IN_EXCHANGE_TYPE: 'direct',
  AMQP_IN_QUEUE: 'test_diagnoses-critical',
  AMQP_IN_PATTERNS: 'fracture infection pneumonia multiple_sclerosis syringomyelia stroke tumor gallbladder_disease prostate_problem synovitis',
  AMQP_OUT_EXCHANGE: 'test_discharges',
  AMQP_OUT_EXCHANGE_TYPE: 'fanout',
});

const Consumer = require('../app');
const { flushDB } = require('./utils/redis');

before(async () => {
  global.consumerInstance = new Consumer();
  await global.consumerInstance.start();
});

beforeEach(async () => await flushDB());

after(async () => await global.consumerInstance.stop());

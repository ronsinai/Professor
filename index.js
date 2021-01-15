const Nconf = require('nconf');
const Process = require('process');

Nconf.use('memory');
Nconf.argv().env().defaults({
  NODE_ENV: 'dev',
  LOG_LEVEL: 'info',
  REDIS_URI: 'redis://localhost:6379',
  REDIS_INDEX: 0,
  AMQP_URI: 'amqp://localhost:5672',
  AMQP_IN_EXCHANGE: 'imagings',
  AMQP_IN_EXCHANGE_TYPE: 'topic',
  AMQP_IN_QUEUE: 'imagings-delayed',
  AMQP_IN_PATTERNS: '#',
  AMQP_OUT_EXCHANGE: 'discharges-delayed',
  AMQP_OUT_EXCHANGE_TYPE: 'x-delayed-message',
  AMQP_OUT_DELAYED_EXCHANGE_TYPE: 'fanout',
  DELAY: 300000,
}).file({ file: './config.json' });

const App = require('./app');

const appInstance = new App();
appInstance.shutdown = async () => {
  await appInstance.stop();
};

Process.on('SIGINT', appInstance.shutdown);
Process.on('SIGTERM', appInstance.shutdown);

(async () => {
  try {
    await appInstance.start();
  }
  catch (err) {
    await appInstance.stop();
  }
})();

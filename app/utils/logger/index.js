const Nconf = require('nconf');
const Pino = require('pino');

const formatters = {
  level(label, number) {
    return { level: label };
  },
};

const logger = Pino({
  formatters,
  level: Nconf.get('LOG_LEVEL'),
  timestamp: Pino.stdTimeFunctions.isoTime,
  prettyPrint: Nconf.get('NODE_ENV') !== 'production',
});

const getLogger = () => logger;

module.exports = {
  getLogger,
};

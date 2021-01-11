const Amqp = require('amqplib');

const DURABLE = true;

let connection;
let channel;

const connect = async (url) => {
  if (!channel) {
    connection = await Amqp.connect(url);
    channel = await connection.createChannel();
  }

  return channel;
};

const assertExchange = async (exchange, exchangeType, options = {}) => {
  // eslint-disable-next-line no-param-reassign
  options.durable = DURABLE;
  await channel.assertExchange(exchange, exchangeType, options);
};

const assertQueue = async (queue, options = {}) => {
  // eslint-disable-next-line no-param-reassign
  options.durable = DURABLE;
  await channel.assertQueue(queue, options);
};

const bindQueue = async (queue, exchange, patterns) => {
  await Promise.all(
    patterns.map(async (pattern) => await channel.bindQueue(queue, exchange, pattern)),
  );
};

// eslint-disable-next-line max-len
const setUp = async (exchange, exchangeType, queue, patterns, exchangeOptions = {}, queueOptions = {}) => {
  await assertExchange(exchange, exchangeType, exchangeOptions);
  await assertQueue(queue, queueOptions);
  await bindQueue(queue, exchange, patterns);
};

const close = async () => {
  await channel.close();
  await connection.close();
};

const getMQ = () => channel;

module.exports = {
  connect,
  assertExchange,
  assertQueue,
  bindQueue,
  setUp,
  close,
  getMQ,
};

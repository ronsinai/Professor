// eslint-disable-next-line max-len
const getMessage = (imaging, routingKey) => ({ content: JSON.stringify(imaging), fields: { routingKey } });

module.exports = {
  getMessage,
};

// eslint-disable-next-line max-len
const getMessage = (content, routingKey) => ({ content: JSON.stringify(content), fields: { routingKey } });

module.exports = {
  getMessage,
};

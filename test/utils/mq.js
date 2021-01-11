const getMessage = (content) => ({ content: JSON.stringify(content), fields: { routingKey: '' } });

module.exports = {
  getMessage,
};

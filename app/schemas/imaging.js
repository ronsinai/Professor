const Joi = require('joi');

module.exports = Joi.object().keys({
  _id: Joi.string().required(),
  type: Joi.string().required(),
  bodyPart: Joi.string().required(),
  metadata: Joi.object().keys({
    age: Joi.number().required(),
    sex: Joi.string().required(),
  }).required().unknown(),
  path: Joi.string().required(),
});

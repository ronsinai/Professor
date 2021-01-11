const Joi = require('joi');

module.exports = Joi.object().keys({
  imagingId: Joi.string().required(),
  imagingType: Joi.string().required(),
  diagnosis: Joi.string().required(),
});

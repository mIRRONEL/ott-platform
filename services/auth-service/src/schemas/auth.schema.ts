import Joi from 'joi';

export const registerSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  confirm_password: Joi.string().required().valid(Joi.ref('password')),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  country: Joi.string().optional()
});

export const loginSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshTokenSchema = Joi.object().keys({
  refresh_token: Joi.string().required()
});

export const resetPasswordSchema = Joi.object().keys({
  password: Joi.string().min(8).required(),
  confirm_password: Joi.string().required().valid(Joi.ref('password'))
});

export const forgotPasswordSchema = Joi.object().keys({
  email: Joi.string().email().required()
});

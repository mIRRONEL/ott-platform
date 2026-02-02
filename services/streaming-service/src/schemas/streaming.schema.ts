import Joi from 'joi';

export const streamSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    videoId: Joi.string().uuid().required(),
    deviceId: Joi.string().required(),
    quality: Joi.string()
      .valid('360p', '480p', '720p', '1080p', '4k')
      .required(),
    userAgent: Joi.string().optional()
  })
};

export const playbackSchema = {
  body: Joi.object({
    position: Joi.number().required().min(0),
    duration: Joi.number().required().positive(),
    quality: Joi.string()
      .valid('360p', '480p', '720p', '1080p', '4k')
      .optional(),
    paused: Joi.boolean().optional(),
    buffering: Joi.boolean().optional(),
    bandwidth: Joi.number().optional(),
    currentTime: Joi.number().optional()
  }).min(1)
};

export const segmentSchema = {
  query: Joi.object({
    quality: Joi.string()
      .valid('360p', '480p', '720p', '1080p', '4k')
      .required(),
    format: Joi.string()
      .valid('hls', 'dash')
      .required()
  })
};

export const qualitySchema = {
  query: Joi.object({
    deviceType: Joi.string()
      .valid('mobile', 'tablet', 'desktop', 'tv')
      .optional(),
    bandwidth: Joi.number().optional()
  })
};

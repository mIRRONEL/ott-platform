import Joi from 'joi';

export const updateProfileSchema = {
  body: Joi.object({
    firstName: Joi.string().max(50).optional(),
    lastName: Joi.string().max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    bio: Joi.string().max(500).optional(),
    profileImage: Joi.string().uri().optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    country: Joi.string().max(50).optional(),
    city: Joi.string().max(50).optional()
  }).min(1)
};

export const watchlistSchema = {
  body: Joi.object({
    videoId: Joi.string().required().max(255),
    title: Joi.string().max(255).optional().allow('', null),
    thumbnail: Joi.string().optional().allow('', null),
    category: Joi.string().max(100).optional().allow('', null)
  })
};

export const preferencesSchema = {
  body: Joi.object({
    language: Joi.string().length(2).optional(), // ISO 639-1 codes like 'en', 'es'
    subtitles: Joi.boolean().optional(),
    subtitleLanguage: Joi.string().length(2).optional(),
    defaultQuality: Joi.string()
      .valid('360p', '480p', '720p', '1080p', '4k')
      .optional(),
    autoPlay: Joi.boolean().optional(),
    autoPlayNextEpisode: Joi.boolean().optional(),
    parentalControl: Joi.object({
      enabled: Joi.boolean().optional(),
      maturityRating: Joi.string()
        .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
        .optional(),
      pin: Joi.string().length(4).optional()
    }).optional(),
    notifications: Joi.object({
      newRelease: Joi.boolean().optional(),
      subscription: Joi.boolean().optional(),
      recommendations: Joi.boolean().optional(),
      newsletter: Joi.boolean().optional()
    }).optional(),
    theme: Joi.string().valid('light', 'dark').optional(),
    dataUsage: Joi.string()
      .valid('low', 'medium', 'high')
      .optional()
  }).min(1)
};

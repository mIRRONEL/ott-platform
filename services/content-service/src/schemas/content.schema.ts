import Joi from 'joi';

export const createVideoSchema = {
  body: Joi.object({
    title: Joi.string().required().max(255),
    description: Joi.string().required().max(2000),
    thumbnail: Joi.string().optional().allow('', null),
    posterImage: Joi.string().optional().allow('', null),
    duration: Joi.number().required().positive(),
    category: Joi.string().required().max(50),
    subCategory: Joi.string().optional().max(50),
    releaseDate: Joi.date().required(),
    director: Joi.string().required().max(255),
    cast: Joi.array().items(Joi.string()).required(),
    language: Joi.array().items(Joi.string()).required(),
    subtitle: Joi.array().items(Joi.string()).optional(),
    contentRating: Joi.string()
      .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
      .required(),
    imdbRating: Joi.number().min(0).max(10).optional(),
    videoUrl: Joi.string().uri().required(),
    videoQuality: Joi.array()
      .items(Joi.string().valid('360p', '480p', '720p', '1080p', '4k'))
      .required(),
    isActive: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).optional()
  })
};

export const updateVideoSchema = {
  body: Joi.object({
    title: Joi.string().max(255).optional(),
    description: Joi.string().max(2000).optional(),
    thumbnail: Joi.string().optional().allow('', null),
    posterImage: Joi.string().optional().allow('', null),
    category: Joi.string().max(50).optional(),
    subCategory: Joi.string().max(50).optional(),
    director: Joi.string().max(255).optional(),
    cast: Joi.array().items(Joi.string()).optional(),
    language: Joi.array().items(Joi.string()).optional(),
    subtitle: Joi.array().items(Joi.string()).optional(),
    contentRating: Joi.string()
      .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
      .optional(),
    imdbRating: Joi.number().min(0).max(10).optional(),
    videoUrl: Joi.string().uri().optional(),
    videoQuality: Joi.array()
      .items(Joi.string().valid('360p', '480p', '720p', '1080p', '4k'))
      .optional(),
    isActive: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).optional()
  }).min(1)
};

export const searchSchema = {
  query: Joi.object({
    q: Joi.string().required().min(1).max(255),
    category: Joi.string().optional(),
    page: Joi.number().optional().default(1),
    limit: Joi.number().optional().default(20),
    sortBy: Joi.string()
      .optional()
      .valid('relevance', 'rating', 'newest', 'trending')
  })
};

export const ratingSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    rating: Joi.number().required().min(1).max(5),
    review: Joi.string().optional().max(1000)
  })
};

export const commentSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    content: Joi.string().required().max(500),
    rating: Joi.number().optional().min(1).max(5)
  })
};

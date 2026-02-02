"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentSchema = exports.ratingSchema = exports.searchSchema = exports.updateVideoSchema = exports.createVideoSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createVideoSchema = {
    body: joi_1.default.object({
        title: joi_1.default.string().required().max(255),
        description: joi_1.default.string().required().max(2000),
        thumbnail: joi_1.default.string().uri().required(),
        posterImage: joi_1.default.string().uri().optional(),
        duration: joi_1.default.number().required().positive(),
        category: joi_1.default.string().required().max(50),
        subCategory: joi_1.default.string().optional().max(50),
        releaseDate: joi_1.default.date().required(),
        director: joi_1.default.string().required().max(255),
        cast: joi_1.default.array().items(joi_1.default.string()).required(),
        language: joi_1.default.array().items(joi_1.default.string()).required(),
        subtitle: joi_1.default.array().items(joi_1.default.string()).optional(),
        contentRating: joi_1.default.string()
            .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
            .required(),
        imdbRating: joi_1.default.number().min(0).max(10).optional(),
        videoUrl: joi_1.default.string().uri().required(),
        videoQuality: joi_1.default.array()
            .items(joi_1.default.string().valid('360p', '480p', '720p', '1080p', '4k'))
            .required(),
        isActive: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional()
    })
};
exports.updateVideoSchema = {
    body: joi_1.default.object({
        title: joi_1.default.string().max(255).optional(),
        description: joi_1.default.string().max(2000).optional(),
        thumbnail: joi_1.default.string().uri().optional(),
        posterImage: joi_1.default.string().uri().optional(),
        category: joi_1.default.string().max(50).optional(),
        subCategory: joi_1.default.string().max(50).optional(),
        director: joi_1.default.string().max(255).optional(),
        cast: joi_1.default.array().items(joi_1.default.string()).optional(),
        language: joi_1.default.array().items(joi_1.default.string()).optional(),
        subtitle: joi_1.default.array().items(joi_1.default.string()).optional(),
        contentRating: joi_1.default.string()
            .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
            .optional(),
        imdbRating: joi_1.default.number().min(0).max(10).optional(),
        videoUrl: joi_1.default.string().uri().optional(),
        videoQuality: joi_1.default.array()
            .items(joi_1.default.string().valid('360p', '480p', '720p', '1080p', '4k'))
            .optional(),
        isActive: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional()
    }).min(1)
};
exports.searchSchema = {
    query: joi_1.default.object({
        q: joi_1.default.string().required().min(1).max(255),
        category: joi_1.default.string().optional(),
        page: joi_1.default.number().optional().default(1),
        limit: joi_1.default.number().optional().default(20),
        sortBy: joi_1.default.string()
            .optional()
            .valid('relevance', 'rating', 'newest', 'trending')
    })
};
exports.ratingSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        rating: joi_1.default.number().required().min(1).max(5),
        review: joi_1.default.string().optional().max(1000)
    })
};
exports.commentSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        content: joi_1.default.string().required().max(500),
        rating: joi_1.default.number().optional().min(1).max(5)
    })
};
//# sourceMappingURL=content.schema.js.map
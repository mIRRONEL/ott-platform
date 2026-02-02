"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preferencesSchema = exports.watchlistSchema = exports.updateProfileSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.updateProfileSchema = {
    body: joi_1.default.object({
        firstName: joi_1.default.string().max(50).optional(),
        lastName: joi_1.default.string().max(50).optional(),
        email: joi_1.default.string().email().optional(),
        phone: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
        bio: joi_1.default.string().max(500).optional(),
        profileImage: joi_1.default.string().uri().optional(),
        dateOfBirth: joi_1.default.date().max('now').optional(),
        country: joi_1.default.string().max(50).optional(),
        city: joi_1.default.string().max(50).optional()
    }).min(1)
};
exports.watchlistSchema = {
    body: joi_1.default.object({
        videoId: joi_1.default.string().uuid().required(),
        title: joi_1.default.string().max(255).optional(),
        thumbnail: joi_1.default.string().uri().optional(),
        category: joi_1.default.string().max(50).optional()
    })
};
exports.preferencesSchema = {
    body: joi_1.default.object({
        language: joi_1.default.string().length(2).optional(), // ISO 639-1 codes like 'en', 'es'
        subtitles: joi_1.default.boolean().optional(),
        subtitleLanguage: joi_1.default.string().length(2).optional(),
        defaultQuality: joi_1.default.string()
            .valid('360p', '480p', '720p', '1080p', '4k')
            .optional(),
        autoPlay: joi_1.default.boolean().optional(),
        autoPlayNextEpisode: joi_1.default.boolean().optional(),
        parentalControl: joi_1.default.object({
            enabled: joi_1.default.boolean().optional(),
            maturityRating: joi_1.default.string()
                .valid('G', 'PG', 'PG-13', 'R', 'NC-17')
                .optional(),
            pin: joi_1.default.string().length(4).optional()
        }).optional(),
        notifications: joi_1.default.object({
            newRelease: joi_1.default.boolean().optional(),
            subscription: joi_1.default.boolean().optional(),
            recommendations: joi_1.default.boolean().optional(),
            newsletter: joi_1.default.boolean().optional()
        }).optional(),
        theme: joi_1.default.string().valid('light', 'dark').optional(),
        dataUsage: joi_1.default.string()
            .valid('low', 'medium', 'high')
            .optional()
    }).min(1)
};
//# sourceMappingURL=user.schema.js.map
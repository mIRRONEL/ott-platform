"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualitySchema = exports.segmentSchema = exports.playbackSchema = exports.streamSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.streamSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        videoId: joi_1.default.string().uuid().required(),
        deviceId: joi_1.default.string().required(),
        quality: joi_1.default.string()
            .valid('360p', '480p', '720p', '1080p', '4k')
            .required(),
        userAgent: joi_1.default.string().optional()
    })
};
exports.playbackSchema = {
    body: joi_1.default.object({
        position: joi_1.default.number().required().min(0),
        duration: joi_1.default.number().required().positive(),
        quality: joi_1.default.string()
            .valid('360p', '480p', '720p', '1080p', '4k')
            .optional(),
        paused: joi_1.default.boolean().optional(),
        buffering: joi_1.default.boolean().optional(),
        bandwidth: joi_1.default.number().optional(),
        currentTime: joi_1.default.number().optional()
    }).min(1)
};
exports.segmentSchema = {
    query: joi_1.default.object({
        quality: joi_1.default.string()
            .valid('360p', '480p', '720p', '1080p', '4k')
            .required(),
        format: joi_1.default.string()
            .valid('hls', 'dash')
            .required()
    })
};
exports.qualitySchema = {
    query: joi_1.default.object({
        deviceType: joi_1.default.string()
            .valid('mobile', 'tablet', 'desktop', 'tv')
            .optional(),
        bandwidth: joi_1.default.number().optional()
    })
};
//# sourceMappingURL=streaming.schema.js.map
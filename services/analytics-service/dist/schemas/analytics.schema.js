"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.engagementSchema = exports.contentPerformanceSchema = exports.recommendationsSchema = exports.trendingSchema = exports.dashboardSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.dashboardSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    startDate: joi_1.default.date().optional(),
    endDate: joi_1.default.date().optional(),
    period: joi_1.default.string().valid('day', 'week', 'month').default('month')
});
exports.trendingSchema = joi_1.default.object({
    category: joi_1.default.string().optional(),
    limit: joi_1.default.number().min(1).max(100).default(20),
    period: joi_1.default.string().valid('day', 'week', 'month').default('week'),
    sortBy: joi_1.default.string().valid('views', 'rating', 'engagement').default('views')
});
exports.recommendationsSchema = joi_1.default.object({
    userId: joi_1.default.string().required(),
    limit: joi_1.default.number().min(1).max(50).default(10),
    category: joi_1.default.string().optional(),
    algorithm: joi_1.default.string().valid('collaborative', 'content-based', 'hybrid').default('hybrid')
});
exports.contentPerformanceSchema = joi_1.default.object({
    contentId: joi_1.default.string().required(),
    startDate: joi_1.default.date().optional(),
    endDate: joi_1.default.date().optional()
});
exports.engagementSchema = joi_1.default.object({
    contentId: joi_1.default.string().required(),
    metric: joi_1.default.string().valid('views', 'completion_rate', 'rating', 'reviews').optional()
});
//# sourceMappingURL=analytics.schema.js.map
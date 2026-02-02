"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validation_1 = require("../middleware/validation");
const analytics_schema_1 = require("../schemas/analytics.schema");
const analyticsController = __importStar(require("../controllers/analytics.controller"));
const router = (0, express_1.Router)();
// GET /dashboard - Get user analytics dashboard
router.get('/dashboard', (0, validation_1.validateRequest)(analytics_schema_1.dashboardSchema, 'query'), analyticsController.getDashboard);
// GET /trending - Get trending content
router.get('/trending', (0, validation_1.validateRequest)(analytics_schema_1.trendingSchema, 'query'), analyticsController.getTrendingContent);
// GET /recommendations/:userId - Get personalized recommendations
router.get('/recommendations/:userId', (0, validation_1.validateRequest)(analytics_schema_1.recommendationsSchema, 'params'), analyticsController.getRecommendations);
// GET /performance/:contentId - Get content performance metrics
router.get('/performance/:contentId', (0, validation_1.validateRequest)(analytics_schema_1.contentPerformanceSchema, 'params'), analyticsController.getContentPerformance);
// GET /engagement/:contentId - Get engagement metrics
router.get('/engagement/:contentId', (0, validation_1.validateRequest)(analytics_schema_1.engagementSchema, 'params'), analyticsController.getEngagementMetrics);
// POST /events - Track user events (internal endpoint)
router.post('/events', analyticsController.trackEvent);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map
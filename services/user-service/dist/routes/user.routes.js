"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const validation_1 = require("../middleware/validation");
const user_schema_1 = require("../schemas/user.schema");
const router = (0, express_1.Router)();
// Middleware to verify JWT token would go here
// For now, we'll add it as an auth guard function
/**
 * @route GET /api/users/:userId
 * @description Get user profile
 * @access Private
 */
router.get('/:userId', user_controller_1.getUserProfile);
/**
 * @route PUT /api/users/:userId
 * @description Update user profile
 * @access Private
 */
router.put('/:userId', (0, validation_1.validateRequest)(user_schema_1.updateProfileSchema), user_controller_1.updateUserProfile);
/**
 * @route DELETE /api/users/:userId
 * @description Delete user account
 * @access Private
 */
router.delete('/:userId', user_controller_1.deleteUser);
/**
 * @route POST /api/users/:userId/watchlist
 * @description Add video to watchlist
 * @access Private
 */
router.post('/:userId/watchlist', (0, validation_1.validateRequest)(user_schema_1.watchlistSchema), user_controller_1.addToWatchlist);
/**
 * @route DELETE /api/users/:userId/watchlist/:videoId
 * @description Remove video from watchlist
 * @access Private
 */
router.delete('/:userId/watchlist/:videoId', user_controller_1.removeFromWatchlist);
/**
 * @route GET /api/users/:userId/watchlist
 * @description Get user watchlist
 * @access Private
 */
router.get('/:userId/watchlist', user_controller_1.getWatchlist);
/**
 * @route PUT /api/users/:userId/preferences
 * @description Update user preferences
 * @access Private
 */
router.put('/:userId/preferences', (0, validation_1.validateRequest)(user_schema_1.preferencesSchema), user_controller_1.updatePreferences);
/**
 * @route GET /api/users/:userId/preferences
 * @description Get user preferences
 * @access Private
 */
router.get('/:userId/preferences', user_controller_1.getPreferences);
exports.default = router;
//# sourceMappingURL=user.routes.js.map
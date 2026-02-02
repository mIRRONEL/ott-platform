"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validation_1 = require("../middleware/validation");
const auth_schema_1 = require("../schemas/auth.schema");
const auth_controller_1 = require("../controllers/auth.controller");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// Wrapper to catch async errors
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// Register endpoint
router.post('/register', (0, validation_1.validateRequest)(auth_schema_1.registerSchema), asyncHandler((req, res, next) => authController.register(req, res, next)));
// Login endpoint - renamed to signin
router.post('/login', (0, validation_1.validateRequest)(auth_schema_1.loginSchema), asyncHandler((req, res, next) => authController.login(req, res, next)));
// Refresh token endpoint
router.post('/refresh-token', asyncHandler((req, res, next) => authController.refreshToken(req, res, next)));
// Logout endpoint
router.post('/logout', asyncHandler((req, res, next) => authController.logout(req, res, next)));
// Verify email endpoint
router.get('/verify-email/:token', asyncHandler((req, res, next) => authController.verifyEmail(req, res, next)));
// Forgot password endpoint
router.post('/forgot-password', asyncHandler((req, res, next) => authController.forgotPassword(req, res, next)));
// Reset password endpoint
router.post('/reset-password/:token', asyncHandler((req, res, next) => authController.resetPassword(req, res, next)));
// Validate JWT endpoint
router.get('/validate', asyncHandler((req, res, next) => authController.validateToken(req, res, next)));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map
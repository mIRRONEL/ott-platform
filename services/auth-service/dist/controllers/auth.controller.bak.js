"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const connection_1 = require("../database/connection");
const producer_1 = require("../kafka/producer");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const redis_1 = __importDefault(require("../config/redis"));
class AuthController {
    /**
     * Register new user
     */
    async register(req, res, next) {
        try {
            const { email, password, first_name, last_name, country } = req.body;
            // Check if user already exists
            const existingUser = await connection_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                throw new errors_1.AppError('Email already registered', 400);
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const userId = (0, uuid_1.v4)();
            // Create user
            const result = await connection_1.pool.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, country)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name`, [userId, email, hashedPassword, first_name, last_name, country]);
            const user = result.rows[0];
            // Publish user.registered event to Kafka
            await producer_1.producer.send({
                topic: 'user.registered',
                messages: [
                    {
                        key: userId,
                        value: JSON.stringify({
                            event_id: (0, uuid_1.v4)(),
                            event_type: 'user.registered',
                            timestamp: new Date().toISOString(),
                            user_id: userId,
                            email: user.email,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            country: country || null,
                            signup_source: 'web'
                        })
                    }
                ]
            });
            logger_1.logger.info(`New user registered: ${email}`);
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user_id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Login user
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            logger_1.logger.info(`Login attempt for email: ${email}`);
            // Find user
            let result;
            try {
                result = await connection_1.pool.query('SELECT id, email, password_hash, status FROM users WHERE email = $1', [email]);
            }
            catch (dbError) {
                console.error(`Database query error:`, dbError);
                logger_1.logger.error(`Database query error: ${dbError.message}`, dbError);
                throw dbError;
            }
            if (result.rows.length === 0) {
                throw new errors_1.AppError('Invalid email or password', 401);
            }
            const user = result.rows[0];
            // Check status
            if (user.status !== 'active') {
                throw new errors_1.AppError('User account is not active', 403);
            }
            // TEST: Return response immediately
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    access_token: 'test_token_12345',
                    refresh_token: 'test_refresh_token_12345',
                    expires_in: 3600
                }
            });
        }
        catch (error) {
            logger_1.logger.error(`Login error: ${error}`, error);
            next(error);
        }
    }
    async loginOld(req, res, next) {
        try {
            const { email, password } = req.body;
            logger_1.logger.info(`Login attempt for email: ${email}`);
            // Find user
            let result;
            try {
                result = await connection_1.pool.query('SELECT id, email, password_hash, status FROM users WHERE email = $1', [email]);
            }
            catch (dbError) {
                console.error(`Database query error:`, dbError);
                logger_1.logger.error(`Database query error: ${dbError.message}`, dbError);
                throw dbError;
            }
            if (result.rows.length === 0) {
                throw new errors_1.AppError('Invalid email or password', 401);
            }
            const user = result.rows[0];
            // Check status
            if (user.status !== 'active') {
                throw new errors_1.AppError('User account is not active', 403);
            }
            // Verify password
            let isValidPassword = false;
            const storedHash = user.password_hash;
            const plainPassword = password;
            try {
                console.log('About to call bcrypt.compareSync');
                isValidPassword = bcryptjs_1.default.compareSync(plainPassword, storedHash);
                console.log('Bcrypt.compareSync completed successfully with result:', isValidPassword);
            }
            catch (bcryptError) {
                console.error('Bcrypt compareSync error:', bcryptError.message, bcryptError);
                throw new errors_1.AppError('Authentication error', 500);
            }
            if (!isValidPassword) {
                throw new errors_1.AppError('Invalid email or password', 401);
            }
            // Generate tokens
            const accessToken = jsonwebtoken_1.default.sign({ user_id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
            const refreshToken = jsonwebtoken_1.default.sign({ user_id: user.id }, process.env.JWT_REFRESH_SECRET || 'refresh-secret', { expiresIn: '7d' });
            logger_1.logger.info(`User logged in: ${email}`);
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    expires_in: 3600
                }
            });
        }
        catch (error) {
            logger_1.logger.error(`Login error: ${error}`, error);
            next(error);
        }
    }
    /**
     * Refresh access token
     */
    async refreshToken(req, res, next) {
        try {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                throw new errors_1.AppError('Refresh token required', 400);
            }
            // Verify refresh token
            const decoded = jsonwebtoken_1.default.verify(refresh_token, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
            // Check if token is in Redis (optional - cache layer)
            if (redis_1.default.isConnected()) {
                try {
                    const redisClient = redis_1.default.getClient();
                    if (redisClient) {
                        const storedToken = await redisClient.get(`refresh_token:${decoded.user_id}`);
                        if (storedToken !== refresh_token) {
                            throw new errors_1.AppError('Invalid refresh token', 401);
                        }
                    }
                }
                catch (redisError) {
                    // If Redis fails, we'll still validate the JWT signature which is sufficient
                    if (!redisError.message?.includes('Invalid refresh token')) {
                        logger_1.logger.warn(`Redis cache check failed: ${redisError}`);
                        // Continue - JWT validation is sufficient
                    }
                    else {
                        throw redisError;
                    }
                }
            }
            // Generate new access token
            const accessToken = jsonwebtoken_1.default.sign({ user_id: decoded.user_id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
            res.json({
                success: true,
                data: {
                    access_token: accessToken,
                    expires_in: 3600
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Logout user
     */
    async logout(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && redis_1.default.isConnected()) {
                const token = authHeader.split(' ')[1];
                const decoded = jsonwebtoken_1.default.decode(token);
                if (decoded) {
                    try {
                        const redisClient = redis_1.default.getClient();
                        if (redisClient) {
                            // Add token to blacklist
                            const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
                            if (expiresIn > 0) {
                                await redisClient.set(`token:blacklist:${token}`, '1', { EX: expiresIn });
                            }
                            // Remove refresh token
                            await redisClient.del(`refresh_token:${decoded.user_id}`);
                        }
                    }
                    catch (redisError) {
                        logger_1.logger.warn(`Redis logout operations failed: ${redisError}`);
                        // Continue - logout still succeeds even if Redis fails
                    }
                }
            }
            res.json({
                success: true,
                message: 'Logout successful'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Verify email
     */
    async verifyEmail(req, res, next) {
        try {
            // Implementation for email verification
            res.json({ success: true, message: 'Email verified' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Forgot password
     */
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            // Check if user exists
            const result = await connection_1.pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (result.rows.length === 0) {
                // Don't reveal if email exists
                return res.json({
                    success: true,
                    message: 'If email exists, a password reset link will be sent'
                });
            }
            // Generate reset token
            const resetToken = jsonwebtoken_1.default.sign({ user_id: result.rows[0].id, type: 'password_reset' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
            // Store reset token in Redis (if available)
            if (redis_1.default.isConnected()) {
                try {
                    const redisClient = redis_1.default.getClient();
                    if (redisClient) {
                        await redisClient.set(`password_reset:${result.rows[0].id}`, resetToken, { EX: 3600 });
                    }
                }
                catch (redisError) {
                    logger_1.logger.warn(`Failed to store reset token in Redis: ${redisError}`);
                    // Continue - token can still be validated via JWT
                }
            }
            // TODO: Send email with reset link
            logger_1.logger.info(`Password reset requested for: ${email}`);
            res.json({
                success: true,
                message: 'Password reset link sent to email'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Reset password
     */
    async resetPassword(req, res, next) {
        try {
            const { token } = req.params;
            const { password } = req.body;
            // Verify token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            if (decoded.type !== 'password_reset') {
                throw new errors_1.AppError('Invalid reset token', 400);
            }
            // Hash new password
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            // Update password
            await connection_1.pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, decoded.user_id]);
            // Invalidate reset token in Redis (if available)
            if (redis_1.default.isConnected()) {
                try {
                    const redisClient = redis_1.default.getClient();
                    if (redisClient) {
                        await redisClient.del(`password_reset:${decoded.user_id}`);
                    }
                }
                catch (redisError) {
                    logger_1.logger.warn(`Failed to delete reset token from Redis: ${redisError}`);
                    // Continue - token is still invalidated via JWT expiration
                }
            }
            logger_1.logger.info(`Password reset successful for user: ${decoded.user_id}`);
            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Validate JWT token
     */
    async validateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                throw new errors_1.AppError('No authorization header', 401);
            }
            const token = authHeader.split(' ')[1];
            // Check if token is blacklisted (if Redis is available)
            if (redis_1.default.isConnected()) {
                try {
                    const redisClient = redis_1.default.getClient();
                    if (redisClient) {
                        const isBlacklisted = await redisClient.get(`token:blacklist:${token}`);
                        if (isBlacklisted) {
                            throw new errors_1.AppError('Token has been revoked', 401);
                        }
                    }
                }
                catch (redisError) {
                    if (redisError.message?.includes('revoked')) {
                        throw redisError;
                    }
                    logger_1.logger.warn(`Redis blacklist check failed: ${redisError}`);
                    // Continue - we'll validate with JWT signature
                }
            }
            // Verify token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            res.json({
                success: true,
                data: decoded
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.bak.js.map
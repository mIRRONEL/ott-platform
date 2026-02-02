"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        logger_1.logger.info(`Login attempt for email: ${email}`);
        // Find user - This is where "The client is closed" error comes from
        const result = await connection_1.pool.query('SELECT id, email, password_hash, status FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            throw new errors_1.AppError('Invalid email or password', 401);
        }
        const user = result.rows[0];
        // Check status
        if (user.status !== 'active') {
            throw new errors_1.AppError('User account is not active', 403);
        }
        // Verify password
        const isValidPassword = bcryptjs_1.default.compareSync(password, user.password_hash);
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
        logger_1.logger.error(`Login error:`, error);
        next(error);
    }
}
//# sourceMappingURL=auth-login-simple.js.map
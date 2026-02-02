"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const authMiddleware = (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            // Some endpoints allow public access, let the service decide
            return next();
        }
        const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = {
            userId: decoded.userId || decoded.sub,
            email: decoded.email,
            role: decoded.role || 'user'
        };
        logger_1.logger.info(`Authenticated user: ${req.user.userId}`);
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            logger_1.logger.warn('Token expired');
            return res.status(401).json({
                status: 'error',
                message: 'Token expired',
                statusCode: 401
            });
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.logger.warn('Invalid token:', error.message);
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token',
                statusCode: 401
            });
        }
        logger_1.logger.error('Auth middleware error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            statusCode: 500
        });
    }
};
exports.authMiddleware = authMiddleware;
const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return null;
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    return parts[1];
};
//# sourceMappingURL=auth.middleware.js.map
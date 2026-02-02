"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ServiceUnavailableError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(400, message);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(401, message);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ServiceUnavailableError extends AppError {
    constructor(serviceName) {
        super(503, `Service ${serviceName} is unavailable`);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        logger_1.logger.error(`[${err.statusCode}] ${err.message}`, { url: req.url });
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            statusCode: err.statusCode
        });
    }
    logger_1.logger.error('Unexpected error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        statusCode: 500
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.handler.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    if (err instanceof errors_1.AppError) {
        logger_1.logger.error(`${err.code}: ${err.message}`, {
            path: req.path,
            method: req.method,
            statusCode: err.statusCode
        });
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
            code: err.code
        });
    }
    logger_1.logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack
    });
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error.handler.js.map
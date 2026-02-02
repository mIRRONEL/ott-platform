"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const errorHandler = (err, req, res, next) => {
    if (err instanceof errors_1.AppError) {
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
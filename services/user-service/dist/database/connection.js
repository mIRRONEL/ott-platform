"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.pool = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
exports.pool = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ott_platform'
});
// Connection pool error handling
exports.pool.on('error', (err) => {
    logger_1.logger.error('Unexpected error on idle client', err);
});
// Check connection on startup
exports.pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        logger_1.logger.error('PostgreSQL connection error:', err);
    }
    else {
        logger_1.logger.info('PostgreSQL connected successfully');
    }
});
const closeConnection = async () => {
    await exports.pool.end();
    logger_1.logger.info('PostgreSQL connection closed');
};
exports.closeConnection = closeConnection;
//# sourceMappingURL=connection.js.map
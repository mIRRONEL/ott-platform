"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const errors_1 = require("../utils/errors");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = (schema.body || schema).validate(req.body || req.query, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const messages = error.details.map(detail => detail.message).join(', ');
                throw new errors_1.ValidationError(messages);
            }
            if (schema.body) {
                req.body = value;
            }
            else {
                req.query = value;
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validation.js.map
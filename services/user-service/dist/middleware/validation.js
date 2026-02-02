"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const errors_1 = require("../utils/errors");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const toValidate = {
                body: req.body,
                params: req.params,
                query: req.query
            };
            const { error, value } = (schema.body || schema).validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const messages = error.details.map(detail => detail.message).join(', ');
                throw new errors_1.ValidationError(messages);
            }
            req.body = value;
            next();
        }
        catch (err) {
            next(err);
        }
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validation.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const errors_1 = require("../utils/errors");
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const message = error.details
                    .map((detail) => detail.message)
                    .join(', ');
                throw new errors_1.ValidationError(message);
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
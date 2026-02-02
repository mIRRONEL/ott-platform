"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const errors_1 = require("../utils/errors");
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const dataToValidate = req[source];
            const { error, value } = schema.validate(dataToValidate, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const errorMessages = error.details.map(detail => detail.message).join(', ');
                throw new errors_1.ValidationError(errorMessages);
            }
            if (source === 'body')
                req.body = value;
            if (source === 'query')
                req.query = value;
            if (source === 'params')
                req.params = value;
            next();
        }
        catch (error) {
            if (error instanceof errors_1.ValidationError) {
                return res.status(400).json({
                    status: 'error',
                    message: error.message,
                    statusCode: 400
                });
            }
            next(error);
        }
    };
};
exports.validateRequest = validateRequest;
//# sourceMappingURL=validation.js.map
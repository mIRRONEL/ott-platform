"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPasswordSchema = exports.resetPasswordSchema = exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object().keys({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    confirm_password: joi_1.default.string().required().valid(joi_1.default.ref('password')),
    first_name: joi_1.default.string().required(),
    last_name: joi_1.default.string().required(),
    country: joi_1.default.string().optional()
});
exports.loginSchema = joi_1.default.object().keys({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
exports.refreshTokenSchema = joi_1.default.object().keys({
    refresh_token: joi_1.default.string().required()
});
exports.resetPasswordSchema = joi_1.default.object().keys({
    password: joi_1.default.string().min(8).required(),
    confirm_password: joi_1.default.string().required().valid(joi_1.default.ref('password'))
});
exports.forgotPasswordSchema = joi_1.default.object().keys({
    email: joi_1.default.string().email().required()
});
//# sourceMappingURL=auth.schema.js.map
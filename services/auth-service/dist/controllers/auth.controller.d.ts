import { Request, Response, NextFunction } from 'express';
export declare class AuthController {
    /**
     * Register new user
     */
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Login user
     */
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Refresh access token
     */
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Logout user
     */
    logout(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Verify email
     */
    verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Forgot password
     */
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Reset password
     */
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Validate JWT token
     */
    validateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map
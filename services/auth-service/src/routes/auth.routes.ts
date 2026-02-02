import { Router, Request, Response, NextFunction } from 'express';
import { validateRequest } from '../middleware/validation';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { AuthController } from '../controllers/auth.controller';
import { AdminController } from '../controllers/admin.controller';
import { verifyAuth, requireAdmin } from '../middleware/admin.middleware';

const router = Router();
const authController = new AuthController();
const adminController = new AdminController();

// Wrapper to catch async errors
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Register endpoint
router.post('/register', 
  validateRequest(registerSchema),
  asyncHandler((req: Request, res: Response, next: NextFunction) => 
    authController.register(req, res, next)
  )
);

// Login endpoint - renamed to signin
router.post('/login',
  validateRequest(loginSchema),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.login(req, res, next)
  )
);

// Refresh token endpoint
router.post('/refresh-token',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.refreshToken(req, res, next)
  )
);

// Logout endpoint
router.post('/logout',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.logout(req, res, next)
  )
);

// Verify email endpoint
router.get('/verify-email/:token',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.verifyEmail(req, res, next)
  )
);

// Forgot password endpoint
router.post('/forgot-password',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.forgotPassword(req, res, next)
  )
);

// Reset password endpoint
router.post('/reset-password/:token',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.resetPassword(req, res, next)
  )
);

// Validate JWT endpoint
router.get('/validate',
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    authController.validateToken(req, res, next)
  )
);

// =============================================
// ADMIN ROUTES (require authentication + admin role)
// =============================================

// Get all users (admin only)
router.get('/admin/users',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.getAllUsers(req as any, res, next)
  )
);

// Get user by ID (admin only)
router.get('/admin/users/:userId',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.getUserById(req as any, res, next)
  )
);

// Ban/Unban user (admin only)
router.put('/admin/users/:userId/ban',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.banUser(req as any, res, next)
  )
);

// Delete user (admin only)
router.delete('/admin/users/:userId',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.deleteUser(req as any, res, next)
  )
);

// Change user role (admin only)
router.put('/admin/users/:userId/role',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.changeUserRole(req as any, res, next)
  )
);

// Get admin statistics
router.get('/admin/stats',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.getStats(req as any, res, next)
  )
);

// Create new user (admin only)
router.post('/admin/users',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.createUser(req as any, res, next)
  )
);

// Reset user password (admin only)
router.post('/admin/users/:userId/reset-password',
  asyncHandler(verifyAuth),
  asyncHandler(requireAdmin),
  asyncHandler((req: Request, res: Response, next: NextFunction) =>
    adminController.resetUserPassword(req as any, res, next)
  )
);

export default router;

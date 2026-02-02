import { Router, Request, Response, NextFunction } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  deleteUser,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  updatePreferences,
  getPreferences
} from '../controllers/user.controller';
import { validateRequest } from '../middleware/validation';
import {
  updateProfileSchema,
  watchlistSchema,
  preferencesSchema
} from '../schemas/user.schema';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

const router = Router();

// Middleware to verify JWT token would go here
// For now, we'll add it as an auth guard function

/**
 * @route GET /api/users/profile
 * @description Get current user profile (reads userId from x-user-id header)
 * @access Private
 */
router.get('/profile', (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
  req.params.userId = String(userId);
  getUserProfile(req, res, next);
});

/**
 * @route PUT /api/users/profile
 * @description Update current user profile (reads userId from x-user-id header)
 * @access Private
 */
router.put('/profile', validateRequest(updateProfileSchema), (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
  req.params.userId = String(userId);
  updateUserProfile(req, res, next);
});

/**
 * @route GET /api/users/:userId
 * @description Get user profile
 * @access Private
 */
router.get('/:userId', getUserProfile);

/**
 * @route PUT /api/users/:userId
 * @description Update user profile
 * @access Private
 */
router.put('/:userId', validateRequest(updateProfileSchema), updateUserProfile);

/**
 * @route DELETE /api/users/:userId
 * @description Delete user account
 * @access Private
 */
router.delete('/:userId', deleteUser);

/**
 * @route POST /api/users/:userId/watchlist
 * @description Add video to watchlist
 * @access Private
 */
router.post('/:userId/watchlist', validateRequest(watchlistSchema), addToWatchlist);

/**
 * @route DELETE /api/users/:userId/watchlist/:videoId
 * @description Remove video from watchlist
 * @access Private
 */
router.delete('/:userId/watchlist/:videoId', removeFromWatchlist);

/**
 * @route GET /api/users/:userId/watchlist
 * @description Get user watchlist
 * @access Private
 */
router.get('/:userId/watchlist', getWatchlist);

/**
 * @route PUT /api/users/:userId/preferences
 * @description Update user preferences
 * @access Private
 */
router.put('/:userId/preferences', validateRequest(preferencesSchema), updatePreferences);

/**
 * @route GET /api/users/:userId/preferences
 * @description Get user preferences
 * @access Private
 */
router.get('/:userId/preferences', getPreferences);

export default router;

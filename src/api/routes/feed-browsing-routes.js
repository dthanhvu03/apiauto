/**
 * Feed Browsing Routes
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * Routes for feed browsing and automated commenting
 */

import express from 'express';
import { CONFIG } from '../../config.js';
import {
  browseFeedAndComment,
  selectUserAndComment,
  commentOnUserPosts
} from '../../interactions/post-interactions.js';
import { parseFilterCriteria } from '../utils/query-parser.js';
import { extractAccountId, extractProfilePath } from '../utils/account-extractor.js';
import { wrapRouteWithTimeout, OPERATION_TYPES } from '../utils/timeout-handler.js';
import { TimeoutError } from '../../interactions/errors.js';

const router = express.Router();

/**
 * Middleware to check if interactions are enabled
 */
function checkInteractionsEnabled(req, res, next) {
  if (!CONFIG.interactions.enabled) {
    return res.status(403).json({
      success: false,
      error: 'Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.',
      warning: '⚠️ This feature violates the read-only principle of this tool. Use at your own risk.'
    });
  }
  next();
}

/**
 * POST /api/feed/browse-and-comment
 * Browse feed, filter posts, and comment on them
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "filterCriteria": {
 *     "min_likes": 10,
 *     "has_media": true,
 *     "min_replies": 5
 *   },
 *   "maxPostsToComment": 5,
 *   "randomSelection": true,
 *   "commentTemplates": ["Nice post!", "Great content!"],
 *   "commentDelayMin": 5000,
 *   "commentDelayMax": 15000,
 *   "targetUrl": "https://www.threads.net",
 *   "maxItems": 50
 * }
 * 
 * Query Parameters (alternative to body):
 * - min_likes, max_likes, has_media, min_replies, etc. - Filter criteria
 * - maxPostsToComment (number) - Maximum posts to comment on
 * - randomSelection (boolean) - Select posts randomly
 * - commentDelayMin (number) - Minimum delay between comments (ms)
 * - commentDelayMax (number) - Maximum delay between comments (ms)
 * - maxItems (number) - Maximum items to extract from feed
 */
router.post('/feed/browse-and-comment', checkInteractionsEnabled, async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    // Parse filter criteria from query params or body
    const filterCriteria = req.body.filterCriteria || parseFilterCriteria(req.query);
    
    // Parse other options
    const maxPostsToComment = req.body.maxPostsToComment !== undefined
      ? parseInt(req.body.maxPostsToComment, 10)
      : (req.query.maxPostsToComment ? parseInt(req.query.maxPostsToComment, 10) : null);
    
    const randomSelection = req.body.randomSelection !== undefined
      ? req.body.randomSelection
      : (req.query.randomSelection === 'true' || req.query.randomSelection === true);
    
    const commentTemplates = req.body.commentTemplates || null;
    
    const commentDelayMin = req.body.commentDelayMin !== undefined
      ? parseInt(req.body.commentDelayMin, 10)
      : (req.query.commentDelayMin ? parseInt(req.query.commentDelayMin, 10) : null);
    
    const commentDelayMax = req.body.commentDelayMax !== undefined
      ? parseInt(req.body.commentDelayMax, 10)
      : (req.query.commentDelayMax ? parseInt(req.query.commentDelayMax, 10) : null);
    
    const targetUrl = req.body.targetUrl || req.query.targetUrl || null;
    const maxItems = req.body.maxItems !== undefined
      ? parseInt(req.body.maxItems, 10)
      : (req.query.maxItems ? parseInt(req.query.maxItems, 10) : null);

    const result = await browseFeedAndComment({
      accountId,
      profilePath,
      filterCriteria,
      maxPostsToComment,
      randomSelection,
      commentTemplates,
      commentDelayMin,
      commentDelayMax,
      targetUrl,
      maxItems
    });

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Browse and comment operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'browse_and_comment',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/user/:username/comment-posts
 * Comment on posts from a specific user
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "filterCriteria": {
 *     "min_likes": 10,
 *     "has_media": true
 *   },
 *   "maxPostsToComment": 3,
 *   "randomSelection": true,
 *   "commentTemplates": ["Nice post!", "Great content!"],
 *   "commentDelayMin": 5000,
 *   "commentDelayMax": 15000,
 *   "maxItems": 20
 * }
 * 
 * Query Parameters (alternative to body):
 * - min_likes, has_media, etc. - Filter criteria
 * - maxPostsToComment (number) - Maximum posts to comment on
 * - randomSelection (boolean) - Select posts randomly
 * - commentDelayMin, commentDelayMax (number) - Delays between comments
 * - maxItems (number) - Maximum items to extract from user profile
 */
router.post('/user/:username/comment-posts', checkInteractionsEnabled, async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const { username } = req.params;
    
    // Parse filter criteria
    const filterCriteria = req.body.filterCriteria || parseFilterCriteria(req.query);
    
    // Parse other options
    const maxPostsToComment = req.body.maxPostsToComment !== undefined
      ? parseInt(req.body.maxPostsToComment, 10)
      : (req.query.maxPostsToComment ? parseInt(req.query.maxPostsToComment, 10) : null);
    
    const randomSelection = req.body.randomSelection !== undefined
      ? req.body.randomSelection
      : (req.query.randomSelection === 'true' || req.query.randomSelection === true);
    
    const commentTemplates = req.body.commentTemplates || null;
    
    const commentDelayMin = req.body.commentDelayMin !== undefined
      ? parseInt(req.body.commentDelayMin, 10)
      : (req.query.commentDelayMin ? parseInt(req.query.commentDelayMin, 10) : null);
    
    const commentDelayMax = req.body.commentDelayMax !== undefined
      ? parseInt(req.body.commentDelayMax, 10)
      : (req.query.commentDelayMax ? parseInt(req.query.commentDelayMax, 10) : null);
    
    const maxItems = req.body.maxItems !== undefined
      ? parseInt(req.body.maxItems, 10)
      : (req.query.maxItems ? parseInt(req.query.maxItems, 10) : null);

    const result = await commentOnUserPosts(username, {
      accountId,
      profilePath,
      filterCriteria,
      maxPostsToComment,
      randomSelection,
      commentTemplates,
      commentDelayMin,
      commentDelayMax,
      maxItems
    });

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/feed/select-user-and-comment
 * Select a user from feed and comment on their posts
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "username": "may__lily", // Optional: specific username, null = random
 *   "filterCriteria": {
 *     "min_likes": 10
 *   },
 *   "maxPostsToComment": 3,
 *   "randomSelection": true,
 *   "targetUrl": "https://www.threads.net",
 *   "maxItems": 50
 * }
 * 
 * Query Parameters (alternative to body):
 * - username (string) - Specific username to select (optional)
 * - min_likes, has_media, etc. - Filter criteria
 * - maxPostsToComment (number) - Maximum posts to comment on
 * - randomSelection (boolean) - Select posts randomly
 * - targetUrl (string) - Target URL for feed extraction
 * - maxItems (number) - Maximum items to extract from feed
 */
router.post('/feed/select-user-and-comment', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    // Parse options
    const username = req.body.username || req.query.username || null;
    const filterCriteria = req.body.filterCriteria || parseFilterCriteria(req.query);
    
    const maxPostsToComment = req.body.maxPostsToComment !== undefined
      ? parseInt(req.body.maxPostsToComment, 10)
      : (req.query.maxPostsToComment ? parseInt(req.query.maxPostsToComment, 10) : null);
    
    const randomSelection = req.body.randomSelection !== undefined
      ? req.body.randomSelection
      : (req.query.randomSelection === 'true' || req.query.randomSelection === true);
    
    const commentTemplates = req.body.commentTemplates || null;
    
    const commentDelayMin = req.body.commentDelayMin !== undefined
      ? parseInt(req.body.commentDelayMin, 10)
      : (req.query.commentDelayMin ? parseInt(req.query.commentDelayMin, 10) : null);
    
    const commentDelayMax = req.body.commentDelayMax !== undefined
      ? parseInt(req.body.commentDelayMax, 10)
      : (req.query.commentDelayMax ? parseInt(req.query.commentDelayMax, 10) : null);
    
    const targetUrl = req.body.targetUrl || req.query.targetUrl || null;
    const maxItems = req.body.maxItems !== undefined
      ? parseInt(req.body.maxItems, 10)
      : (req.query.maxItems ? parseInt(req.query.maxItems, 10) : null);
    
    const userMaxItems = req.body.userMaxItems !== undefined
      ? parseInt(req.body.userMaxItems, 10)
      : (req.query.userMaxItems ? parseInt(req.query.userMaxItems, 10) : null);

    const result = await selectUserAndComment({
      accountId,
      profilePath,
      username,
      filterCriteria,
      maxPostsToComment,
      randomSelection,
      commentTemplates,
      commentDelayMin,
      commentDelayMax,
      targetUrl,
      maxItems,
      userMaxItems
    });

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Select user and comment operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'select_user_and_comment',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'select_user_and_comment'));

export default router;

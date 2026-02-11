/**
 * Post Interaction Routes
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * Routes for post interactions (like, comment, repost, quote, share)
 */

import express from 'express';
import { CONFIG } from '../../config.js';
import { launchBrowser } from '../../browser/browser-manager.js';
import { 
  likePost, 
  unlikePost, 
  commentOnPost, 
  getPostInteractionStatus, 
  loginToThreads,
  repostPost,
  quotePost,
  unrepostPost,
  sharePost,
  getRepostStatus
} from '../../interactions/post-interactions.js';
import { extractAccountId, extractProfilePath } from '../utils/account-extractor.js';
import { normalizeAccountId, findAccountByUsername, extractBaseDirectory, createProfilePath } from '../../config.js';
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
 * POST /api/post/:postId/like
 * Like a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Query Parameters:
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.post('/post/:postId/like', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await likePost(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Like operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'like_post',
        postId: req.params.postId,
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'like_post'));

/**
 * DELETE /api/post/:postId/like
 * Unlike a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Query Parameters:
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.delete('/post/:postId/like', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await unlikePost(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Unlike operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'unlike_post',
        postId: req.params.postId,
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'unlike_post'));

/**
 * POST /api/post/:postId/comment
 * Comment on a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "comment": "Comment text here",
 *   "username": "username", (optional)
 *   "shortcode": "shortcode", (optional)
 *   "postUrl": "https://..." (optional, overrides other params)
 * }
 * 
 * Query Parameters (alternative to body):
 * - comment (string, required) - Comment text
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.post('/post/:postId/comment', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const commentText = req.body.comment || req.query.comment;
    const { username, shortcode, postUrl } = { ...req.query, ...req.body };

    if (!commentText || commentText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
    }

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await commentOnPost(page, postId, commentText, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Comment operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'comment_post',
        postId: req.params.postId,
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'comment_post'));

/**
 * GET /api/post/:postId/interactions
 * Get interaction status for a post (check if liked, etc.)
 * 
 * Query Parameters:
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.get('/post/:postId/interactions', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await getPostInteractionStatus(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'get_interactions'));

/**
 * POST /api/login
 * Login to Threads
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "username": "your_username",
 *   "password": "your_password"
 * }
 * 
 * Query Parameters (alternative to body):
 * - username (string, required) - Username or email
 * - password (string, required) - Password
 */
router.post('/login', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    let accountId = extractAccountId(req);
    const username = req.body.username || req.query.username;
    const password = req.body.password || req.query.password;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Auto-extract account ID from username if not provided
    if (!accountId && username) {
      // Try to find in config first
      const foundAccountId = findAccountByUsername(username);
      if (foundAccountId) {
        accountId = foundAccountId;
        console.log(`[LOGIN] Found account ID in config: ${accountId}`);
      } else {
        // Normalize username to create account ID
        accountId = normalizeAccountId(username);
        console.log(`[LOGIN] Auto-extracted account ID from username: ${accountId}`);
      }
    }

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await loginToThreads(page, username, password, accountId);
      
      // Session is automatically saved in loginToThreads function
      
      res.json({
        success: result.success,
        data: {
          ...result,
          accountId: accountId // Include account ID in response
        },
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Login operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'login',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'login'));

/**
 * POST /api/login/bulk
 * Bulk login to Threads for multiple accounts
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "base_directory": "/home/user/profiles",
 *   "accounts": [
 *     {
 *       "username": "user1",
 *       "password": "pass1",
 *       "account_id": "account_01"
 *     },
 *     {
 *       "username": "user2",
 *       "password": "pass2",
 *       "account_id": "account_02"
 *     }
 *   ],
 *   "options": {
 *     "continue_on_error": true,
 *     "delay_between_logins": 5000
 *   }
 * }
 * 
 * Query Parameters (alternative):
 * - base_directory (string) - Can be passed via query param instead of body
 */
router.post('/login/bulk', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const baseDirectory = extractBaseDirectory(req);
    
    if (!baseDirectory) {
      return res.status(400).json({
        success: false,
        error: 'base_directory is required. Provide it via query parameter, request body, or X-Base-Directory header.'
      });
    }
    
    const accounts = req.body.accounts || [];
    
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'accounts array is required and must not be empty'
      });
    }
    
    // Validate accounts
    const accountIds = new Set();
    for (const account of accounts) {
      if (!account.username || !account.password) {
        return res.status(400).json({
          success: false,
          error: 'Each account must have username and password'
        });
      }
      
      // Auto-generate account_id if not provided
      if (!account.account_id) {
        account.account_id = normalizeAccountId(account.username);
      }
      
      // Check for duplicate account_ids
      if (accountIds.has(account.account_id)) {
        return res.status(400).json({
          success: false,
          error: `Duplicate account_id found: ${account.account_id}`
        });
      }
      accountIds.add(account.account_id);
    }
    
    // Parse options
    const options = req.body.options || {};
    const continueOnError = options.continue_on_error !== false; // Default: true
    const delayBetweenLogins = options.delay_between_logins || 5000; // Default: 5 seconds
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Process each account sequentially
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const accountId = account.account_id;
      
      // Create profile path
      let profilePath;
      try {
        profilePath = createProfilePath(baseDirectory, accountId);
      } catch (error) {
        const errorResult = {
          account_id: accountId,
          username: account.username,
          success: false,
          error: error.message,
          profile_path: null
        };
        results.push(errorResult);
        failed++;
        
        if (!continueOnError) {
          return res.status(400).json({
            success: false,
            error: `Failed to create profile path for account ${accountId}: ${error.message}`,
            data: {
              total: accounts.length,
              successful: successful,
              failed: failed,
              results: results
            }
          });
        }
        continue;
      }
      
      // Login to Threads
      let browser, context, page;
      try {
        console.log(`[BULK LOGIN] Processing account ${i + 1}/${accounts.length}: ${account.username} (${accountId})`);
        
        browser = null;
        context = null;
        page = null;
        
        const browserData = await launchBrowser(accountId, profilePath);
        browser = browserData.browser;
        context = browserData.context;
        page = await context.newPage();
        
        const loginResult = await loginToThreads(page, account.username, account.password, accountId);
        
        if (loginResult.success) {
          successful++;
          results.push({
            account_id: accountId,
            username: account.username,
            success: true,
            message: loginResult.message || 'Login successful',
            already_logged_in: loginResult.alreadyLoggedIn || false,
            profile_path: profilePath
          });
        } else {
          failed++;
          results.push({
            account_id: accountId,
            username: account.username,
            success: false,
            error: loginResult.error || 'Login failed',
            profile_path: profilePath
          });
          
          if (!continueOnError) {
            throw new Error(`Login failed for account ${accountId}: ${loginResult.error}`);
          }
        }
        
      } catch (error) {
        failed++;
        console.error(`[BULK LOGIN] Error processing account ${accountId}:`, error.message);
        results.push({
          account_id: accountId,
          username: account.username,
          success: false,
          error: error.message || 'Unknown error',
          profile_path: profilePath
        });
        
        if (!continueOnError) {
          return res.status(500).json({
            success: false,
            error: `Bulk login failed at account ${accountId}: ${error.message}`,
            data: {
              total: accounts.length,
              successful: successful,
              failed: failed,
              base_directory: baseDirectory,
              results: results
            }
          });
        }
      } finally {
        // Close browser if opened
        if (browser || context) {
          try {
            if (browser) {
              await browser.close();
            } else if (context) {
              await context.close();
            }
          } catch (closeError) {
            console.warn(`[BULK LOGIN] Error closing browser for ${accountId}:`, closeError.message);
          }
        }
      }
      
      // Delay between logins (except for the last one)
      if (i < accounts.length - 1 && delayBetweenLogins > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenLogins));
      }
    }
    
    res.json({
      success: true,
      data: {
        total: accounts.length,
        successful: successful,
        failed: failed,
        base_directory: baseDirectory,
        results: results
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'bulk_login'));

/**
 * POST /api/post/:postId/repost
 * Repost a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Query Parameters:
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.post('/post/:postId/repost', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await repostPost(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Repost operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'repost_post',
        postId: req.params.postId,
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'repost_post'));

/**
 * POST /api/post/:postId/quote
 * Quote a post with comment
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "quote": "Quote text here",
 *   "username": "username", (optional)
 *   "shortcode": "shortcode", (optional)
 *   "postUrl": "https://..." (optional)
 * }
 * 
 * Query Parameters (alternative to body):
 * - quote (string, required) - Quote text
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.post('/post/:postId/quote', checkInteractionsEnabled, async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const quoteText = req.body.quote || req.query.quote;
    const { username, shortcode, postUrl } = { ...req.query, ...req.body };

    if (!quoteText || quoteText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quote text is required'
      });
    }

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await quotePost(page, postId, quoteText, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * DELETE /api/post/:postId/repost
 * Unrepost a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 */
router.delete('/post/:postId/repost', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await unrepostPost(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'unrepost_post'));

/**
 * POST /api/post/:postId/share
 * Share a post
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Query Parameters:
 * - platform (string, optional) - Platform to share to (default: 'copy')
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.post('/post/:postId/share', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const platform = req.query.platform || req.body.platform || 'copy';
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await sharePost(page, postId, platform, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'share_post'));

/**
 * GET /api/post/:postId/repost-status
 * Get repost status for a post (check if reposted)
 * 
 * Query Parameters:
 * - username (string, optional) - Username for constructing post URL
 * - shortcode (string, optional) - Shortcode for constructing post URL
 * - postUrl (string, optional) - Direct post URL (overrides other params)
 */
router.get('/post/:postId/repost-status', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const postId = req.params.postId;
    const { username, shortcode, postUrl } = req.query;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await getRepostStatus(page, postId, { username, shortcode, postUrl, accountId });
      
      res.json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString()
      });
    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'get_repost_status'));

/**
 * POST /api/posts/bulk-like
 * Like hàng loạt nhiều posts từ danh sách post IDs
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "posts": [
 *     {
 *       "postId": "3817952812169631580",
 *       "username": "may__lily",
 *       "shortcode": "DT8F9qykxdc",
 *       "postUrl": "https://www.threads.net/@may__lily/post/DT8F9qykxdc"
 *     },
 *     {
 *       "postId": "3817952812169631581",
 *       "username": "another_user"
 *     }
 *   ],
 *   "options": {
 *     "continue_on_error": true,
 *     "delay_between_likes": 3000
 *   }
 * }
 */
router.post('/posts/bulk-like', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const posts = req.body.posts || [];
    
    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'posts array is required and must not be empty'
      });
    }
    
    // Validate posts
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (!post.postId) {
        return res.status(400).json({
          success: false,
          error: `Post at index ${i} is missing required field: postId`
        });
      }
    }
    
    // Parse options
    const options = req.body.options || {};
    const continueOnError = options.continue_on_error !== false; // Default: true
    const delayBetweenLikes = options.delay_between_likes || 3000; // Default: 3 seconds
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Launch browser once for all operations
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();
    
    try {
      // Process each post sequentially
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postId = post.postId;
        const { username, shortcode, postUrl } = post;
        
        try {
          console.log(`[BULK LIKE] Processing post ${i + 1}/${posts.length}: ${postId}`);
          
          const result = await likePost(page, postId, { username, shortcode, postUrl, accountId });
          
          if (result.success) {
            successful++;
            results.push({
              postId: postId,
              success: true,
              alreadyLiked: result.alreadyLiked || false,
              message: result.message || 'Post liked successfully'
            });
          } else {
            failed++;
            results.push({
              postId: postId,
              success: false,
              error: result.error || 'Like failed',
              message: result.message || null
            });
            
            if (!continueOnError) {
              throw new Error(`Like failed for post ${postId}: ${result.error}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`[BULK LIKE] Error processing post ${postId}:`, error.message);
          results.push({
            postId: postId,
            success: false,
            error: error.message || 'Unknown error'
          });
          
          if (!continueOnError) {
            throw error;
          }
        }
        
        // Delay between likes (except for the last one)
        if (i < posts.length - 1 && delayBetweenLikes > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenLikes));
        }
      }
    } finally {
      await browser.close();
    }
    
    res.json({
      success: true,
      data: {
        total: posts.length,
        successful: successful,
        failed: failed,
        results: results
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Bulk like operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.bulkOperation,
        operation: 'bulk_like',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.BULK_OPERATION, 'bulk_like'));

/**
 * POST /api/posts/bulk-comment
 * Comment hàng loạt trên nhiều posts từ danh sách post IDs
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 * 
 * Request Body:
 * {
 *   "posts": [
 *     {
 *       "postId": "3817952812169631580",
 *       "username": "may__lily",
 *       "shortcode": "DT8F9qykxdc",
 *       "comment": "Great post! 👍"
 *     },
 *     {
 *       "postId": "3817952812169631581",
 *       "comment": "Nice content!"
 *     }
 *   ],
 *   "options": {
 *     "continue_on_error": true,
 *     "delay_between_comments": 5000,
 *     "commentTemplates": ["Nice post!", "Great content!"]
 *   }
 * }
 */
router.post('/posts/bulk-comment', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const posts = req.body.posts || [];
    
    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'posts array is required and must not be empty'
      });
    }
    
    // Parse options
    const options = req.body.options || {};
    const commentTemplates = options.commentTemplates || null;
    
    // Validate posts and check for comment text
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      if (!post.postId) {
        return res.status(400).json({
          success: false,
          error: `Post at index ${i} is missing required field: postId`
        });
      }
      
      // Check if post has comment or if templates are provided
      if (!post.comment && (!commentTemplates || !Array.isArray(commentTemplates) || commentTemplates.length === 0)) {
        return res.status(400).json({
          success: false,
          error: `Post at index ${i} is missing comment text and no commentTemplates provided`
        });
      }
    }
    
    const continueOnError = options.continue_on_error !== false; // Default: true
    const delayBetweenComments = options.delay_between_comments || 5000; // Default: 5 seconds
    
    // Helper function to get comment text
    const getCommentText = (post) => {
      if (post.comment) {
        return post.comment;
      }
      if (commentTemplates && Array.isArray(commentTemplates) && commentTemplates.length > 0) {
        const randomIndex = Math.floor(Math.random() * commentTemplates.length);
        return commentTemplates[randomIndex];
      }
      return null;
    };
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Launch browser once for all operations
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();
    
    try {
      // Process each post sequentially
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postId = post.postId;
        const { username, shortcode, postUrl } = post;
        const commentText = getCommentText(post);
        
        if (!commentText || commentText.trim().length === 0) {
          failed++;
          results.push({
            postId: postId,
            success: false,
            error: 'Comment text is required',
            comment: null
          });
          
          if (!continueOnError) {
            throw new Error(`Comment text is required for post ${postId}`);
          }
          continue;
        }
        
        try {
          console.log(`[BULK COMMENT] Processing post ${i + 1}/${posts.length}: ${postId}`);
          console.log(`   Comment: "${commentText}"`);
          
          const result = await commentOnPost(page, postId, commentText, { username, shortcode, postUrl, accountId });
          
          if (result.success) {
            successful++;
            results.push({
              postId: postId,
              success: true,
              comment: commentText,
              message: result.message || 'Comment posted successfully'
            });
          } else {
            failed++;
            results.push({
              postId: postId,
              success: false,
              error: result.error || 'Comment failed',
              comment: commentText,
              message: result.message || null
            });
            
            if (!continueOnError) {
              throw new Error(`Comment failed for post ${postId}: ${result.error}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`[BULK COMMENT] Error processing post ${postId}:`, error.message);
          results.push({
            postId: postId,
            success: false,
            error: error.message || 'Unknown error',
            comment: commentText
          });
          
          if (!continueOnError) {
            throw error;
          }
        }
        
        // Delay between comments (except for the last one)
        if (i < posts.length - 1 && delayBetweenComments > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenComments));
        }
      }
    } finally {
      await browser.close();
    }
    
    res.json({
      success: true,
      data: {
        total: posts.length,
        successful: successful,
        failed: failed,
        results: results
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Bulk comment operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.bulkOperation,
        operation: 'bulk_comment',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.BULK_OPERATION, 'bulk_comment'));

export default router;

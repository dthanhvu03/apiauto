/**
 * User Interaction Routes
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * Routes for user interactions (follow, unfollow)
 */

import express from 'express';
import { CONFIG } from '../../config.js';
import { launchBrowser } from '../../browser/browser-manager.js';
import {
  followUser,
  unfollowUser,
  getUserFollowStatus
} from '../../interactions/user-interactions.js';
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
 * POST /api/user/:username/follow
 * Follow a user
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 */
router.post('/user/:username/follow', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const username = req.params.username;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await followUser(page, username, accountId);
      
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
        error: error.message || 'Follow operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.interaction,
        operation: 'follow_user',
        username: req.params.username,
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.INTERACTION, 'follow_user'));

/**
 * DELETE /api/user/:username/follow
 * Unfollow a user
 * 
 * ⚠️ EXPERIMENTAL: This endpoint violates the read-only principle
 */
router.delete('/user/:username/follow', checkInteractionsEnabled, wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const username = req.params.username;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await unfollowUser(page, username, accountId);
      
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
}, OPERATION_TYPES.INTERACTION, 'unfollow_user'));

/**
 * GET /api/user/:username/follow-status
 * Get follow status for a user
 */
router.get('/user/:username/follow-status', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const username = req.params.username;

    const profilePath = extractProfilePath(req);
    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const result = await getUserFollowStatus(page, username);
      
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
}, OPERATION_TYPES.INTERACTION, 'get_follow_status'));

export default router;

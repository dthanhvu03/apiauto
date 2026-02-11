/**
 * Feed Routes
 * 
 * Routes for feed extraction and user posts
 */

import express from 'express';
import { extractFeedData, extractUserPosts, CONFIG, filterPosts } from '../../../threads_feed_extractor.js';
import { 
  isCacheValid, 
  updateCache, 
  isUserCacheValid, 
  getUserCache, 
  updateUserCache,
  getCache,
  clearCache
} from '../utils/cache-utils.js';
import { parseFilterCriteria, parseLimit } from '../utils/query-parser.js';
import { extractAccountId, extractProfilePath } from '../utils/account-extractor.js';
import { wrapRouteWithTimeout, OPERATION_TYPES, formatTimeoutError } from '../utils/timeout-handler.js';
import { TimeoutError } from '../../interactions/errors.js';

const router = express.Router();

/**
 * GET /api/feed
 * Get feed items with optional filtering
 */
router.get('/feed', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const filterCriteria = parseFilterCriteria(req.query);
    const limit = parseLimit(req.query);
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === true;

    // Check cache if not forcing refresh
    if (!forceRefresh && isCacheValid(filterCriteria)) {
      const cache = getCache();
      let cachedData = [...cache.data];
      
      // Apply limit if specified
      if (limit && cachedData.length > limit) {
        cachedData = cachedData.slice(0, limit);
      }

      return res.json({
        success: true,
        data: cachedData,
        meta: {
          total: cache.data.length,
          filtered: cachedData.length,
          cached: true,
          lastUpdated: new Date(cache.timestamp).toISOString(),
          cacheExpiresAt: new Date(cache.timestamp + CONFIG.api.cache.ttl).toISOString()
        }
      });
    }

    // Extract feed data
    console.log(`[API] Extracting feed data... (account: ${accountId || 'default'})`);
    const allItems = await extractFeedData({
      accountId,
      profilePath,
      maxItems: limit || CONFIG.extraction.maxItems
    });

    // Apply filters
    const filteredItems = filterPosts(allItems, filterCriteria);

    // Update cache
    updateCache(filteredItems, filterCriteria);

    // Apply limit if specified (after filtering)
    let resultItems = filteredItems;
    if (limit && resultItems.length > limit) {
      resultItems = resultItems.slice(0, limit);
    }

    res.json({
      success: true,
      data: resultItems,
      meta: {
        total: allItems.length,
        filtered: filteredItems.length,
        cached: false,
        lastUpdated: new Date().toISOString(),
        cacheExpiresAt: new Date(Date.now() + CONFIG.api.cache.ttl).toISOString()
      }
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Feed extraction timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'feed_extraction',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.FEED_EXTRACTION, 'feed_extraction'));

/**
 * GET /api/feed/:postId
 * Get a specific post by ID
 */
router.get('/feed/:postId', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const postId = req.params.postId;
    const cache = getCache();
    
    // Check cache first
    if (cache.data) {
      const post = cache.data.find(item => item.post_id === postId);
      if (post) {
        return res.json({
          success: true,
          data: post,
          meta: {
            cached: true
          }
        });
      }
    }

    // If not in cache, extract fresh data
    console.log(`[API] Extracting feed data to find post ${postId}... (account: ${accountId || 'default'})`);
    const allItems = await extractFeedData({
      accountId,
      profilePath,
      maxItems: CONFIG.extraction.maxItems
    });

    const post = allItems.find(item => item.post_id === postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: `Post with ID ${postId} not found`
      });
    }

    res.json({
      success: true,
      data: post,
      meta: {
        cached: false
      }
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Post extraction timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'post_extraction',
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
}, OPERATION_TYPES.FEED_EXTRACTION, 'post_extraction'));

/**
 * GET /api/user/:username/posts
 * Get posts from a specific user's profile
 */
router.get('/user/:username/posts', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    const { username } = req.params;
    const filterCriteria = parseFilterCriteria(req.query);
    const limit = parseLimit(req.query);
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === true;

    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '');

    // Check cache if not forcing refresh
    if (!forceRefresh && isUserCacheValid(cleanUsername, filterCriteria)) {
      const cached = getUserCache(cleanUsername, filterCriteria);
      let cachedData = [...cached.data];
      
      // Apply limit if specified
      if (limit && cachedData.length > limit) {
        cachedData = cachedData.slice(0, limit);
      }

      return res.json({
        success: true,
        data: cachedData,
        meta: {
          username: cleanUsername,
          total: cached.data.length,
          filtered: cachedData.length,
          cached: true,
          lastUpdated: new Date(cached.timestamp).toISOString(),
          cacheExpiresAt: new Date(cached.timestamp + CONFIG.api.cache.ttl).toISOString()
        }
      });
    }

    // Extract user posts
    console.log(`[API] Extracting posts from user @${cleanUsername}... (account: ${accountId || 'default'})`);
    const allItems = await extractUserPosts(cleanUsername, {
      accountId,
      profilePath,
      maxItems: limit || CONFIG.extraction.maxItems
    });

    // Apply filters
    const filteredItems = filterPosts(allItems, filterCriteria);

    // Update cache
    updateUserCache(cleanUsername, filteredItems, filterCriteria);

    // Apply limit if specified (after filtering)
    let resultItems = filteredItems;
    if (limit && resultItems.length > limit) {
      resultItems = resultItems.slice(0, limit);
    }

    res.json({
      success: true,
      data: resultItems,
      meta: {
        username: cleanUsername,
        total: allItems.length,
        filtered: filteredItems.length,
        cached: false,
        lastUpdated: new Date().toISOString(),
        cacheExpiresAt: new Date(Date.now() + CONFIG.api.cache.ttl).toISOString()
      }
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle specific errors
    if (error.message && error.message.includes('Username is required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message && error.message.includes('Invalid username format')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'User posts extraction timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'user_posts_extraction',
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
}, OPERATION_TYPES.FEED_EXTRACTION, 'user_posts_extraction'));

/**
 * POST /api/feed/refresh
 * Force refresh feed data with optional filter criteria
 */
router.post('/feed/refresh', wrapRouteWithTimeout(async (req, res) => {
  try {
    const accountId = extractAccountId(req);
    const profilePath = extractProfilePath(req);
    // Parse filter from body or query
    const filterCriteria = parseFilterCriteria({ ...req.query, ...req.body });
    const limit = parseLimit({ ...req.query, ...req.body });

    // Clear cache to force refresh
    clearCache();

    // Extract feed data
    console.log(`[API] Force refreshing feed data... (account: ${accountId || 'default'})`);
    const allItems = await extractFeedData({
      accountId,
      profilePath,
      maxItems: limit || CONFIG.extraction.maxItems
    });

    // Apply filters
    const filteredItems = filterPosts(allItems, filterCriteria);

    // Update cache
    updateCache(filteredItems, filterCriteria);

    // Apply limit if specified
    let resultItems = filteredItems;
    if (limit && resultItems.length > limit) {
      resultItems = resultItems.slice(0, limit);
    }

    res.json({
      success: true,
      data: resultItems,
      meta: {
        total: allItems.length,
        filtered: filteredItems.length,
        cached: false,
        lastUpdated: new Date().toISOString(),
        cacheExpiresAt: new Date(Date.now() + CONFIG.api.cache.ttl).toISOString()
      }
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Feed refresh timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.feedExtraction,
        operation: 'feed_refresh',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.FEED_EXTRACTION, 'feed_refresh'));

export default router;

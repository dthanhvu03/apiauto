/**
 * Cache Routes
 * 
 * Routes for cache management, health check, stats, and config
 */

import express from 'express';
import { CONFIG } from '../../config.js';
import { 
  getCache, 
  getUserCacheMap, 
  clearCache, 
  clearUserCache 
} from '../utils/cache-utils.js';
import { wrapRouteWithTimeout, OPERATION_TYPES } from '../utils/timeout-handler.js';
import { TimeoutError } from '../../interactions/errors.js';

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const cache = getCache();
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: {
      enabled: CONFIG.api.cache.enabled,
      hasData: cache.data !== null,
      age: cache.timestamp ? Date.now() - cache.timestamp : null
    }
  });
});

/**
 * DELETE /api/cache
 * Clear cache manually (home feed and optionally user cache)
 */
router.delete('/cache', (req, res) => {
  try {
    const cache = getCache();
    const userCache = getUserCacheMap();
    const hadData = cache.data !== null;
    const cacheSize = cache.data ? cache.data.length : 0;
    const username = req.query.username; // Optional: clear cache for specific user
    
    // Clear home feed cache
    clearCache();
    
    // Clear user cache (all or specific user)
    const userCacheSize = userCache.size;
    clearUserCache(username || null);
    
    res.json({
      success: true,
      message: username ? `Cache cleared for user @${username}` : 'Cache cleared successfully',
      cache: {
        homeFeed: {
          hadData: hadData,
          itemsCleared: cacheSize
        },
        userCache: {
          usersCleared: username ? 1 : userCacheSize,
          totalEntriesCleared: username ? userCacheSize : userCacheSize
        }
      }
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
 * GET /api/stats
 * Get statistics about feed data and cache
 */
router.get('/stats', wrapRouteWithTimeout(async (req, res) => {
  try {
    const cache = getCache();
    const userCache = getUserCacheMap();
    
    // Calculate user cache stats
    let totalUserCacheItems = 0;
    const userCacheEntries = [];
    for (const [key, value] of userCache.entries()) {
      const itemCount = value.data ? value.data.length : 0;
      totalUserCacheItems += itemCount;
      const username = key.split(':')[1];
      userCacheEntries.push({
        username: username,
        itemCount: itemCount,
        age: Date.now() - value.timestamp,
        ageFormatted: `${Math.floor((Date.now() - value.timestamp) / 1000)}s`
      });
    }

    const stats = {
      cache: {
        enabled: CONFIG.api.cache.enabled,
        homeFeed: {
          hasData: cache.data !== null,
          itemCount: cache.data ? cache.data.length : 0,
          age: cache.timestamp ? Date.now() - cache.timestamp : null,
          ageFormatted: cache.timestamp ? `${Math.floor((Date.now() - cache.timestamp) / 1000)}s` : null,
          expiresAt: cache.timestamp ? new Date(cache.timestamp + CONFIG.api.cache.ttl).toISOString() : null
        },
        userCache: {
          enabled: CONFIG.api.cache.enabled,
          totalUsers: userCache.size,
          totalItems: totalUserCacheItems,
          entries: userCacheEntries
        },
        ttl: CONFIG.api.cache.ttl,
        ttlFormatted: `${CONFIG.api.cache.ttl / 1000}s`
      },
      extraction: {
        maxItems: CONFIG.extraction.maxItems,
        extractMediaUrls: CONFIG.extraction.extractMediaUrls,
        extractTimestamps: CONFIG.extraction.extractTimestamps
      },
      server: {
        uptime: process.uptime(),
        uptimeFormatted: `${Math.floor(process.uptime())}s`,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        }
      }
    };

    // Add feed statistics if cache has data
    if (cache.data && cache.data.length > 0) {
      const itemsWithMedia = cache.data.filter(item => item.media_urls && item.media_urls.length > 0);
      const itemsWithTimestamps = cache.data.filter(item => item.timestamp);
      const totalLikes = cache.data.reduce((sum, item) => sum + (item.like_count || 0), 0);
      const totalReplies = cache.data.reduce((sum, item) => sum + (item.reply_count || 0), 0);
      const totalReposts = cache.data.reduce((sum, item) => sum + (item.repost_count || 0), 0);
      const uniqueUsernames = new Set(cache.data.map(item => item.username).filter(Boolean));

      stats.feed = {
        totalItems: cache.data.length,
        itemsWithMedia: itemsWithMedia.length,
        itemsWithTimestamps: itemsWithTimestamps.length,
        uniqueUsernames: uniqueUsernames.size,
        engagement: {
          totalLikes: totalLikes,
          totalReplies: totalReplies,
          totalReposts: totalReposts,
          averageLikes: Math.round(totalLikes / cache.data.length),
          averageReplies: Math.round(totalReplies / cache.data.length),
          averageReposts: Math.round(totalReposts / cache.data.length)
        }
      };
    }

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Stats retrieval timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.quickOperation,
        operation: 'stats_retrieval',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.QUICK_OPERATION, 'stats_retrieval'));

/**
 * GET /api/config
 * Get current API configuration (non-sensitive)
 */
router.get('/config', wrapRouteWithTimeout((req, res) => {
  try {
    // Only return non-sensitive configuration
    const config = {
      api: {
        port: CONFIG.api.port,
        host: CONFIG.api.host,
        cache: {
          enabled: CONFIG.api.cache.enabled,
          ttl: CONFIG.api.cache.ttl,
          ttlFormatted: `${CONFIG.api.cache.ttl / 1000}s`
        },
        cors: {
          enabled: CONFIG.api.cors.enabled,
          origin: CONFIG.api.cors.origin === '*' ? '*' : 'configured'
        }
      },
      threads: {
        url: CONFIG.threads.url
      },
      extraction: {
        maxItems: CONFIG.extraction.maxItems,
        enableDebugLogging: CONFIG.extraction.enableDebugLogging,
        extractMediaUrls: CONFIG.extraction.extractMediaUrls,
        extractTimestamps: CONFIG.extraction.extractTimestamps
      },
      browser: {
        headless: CONFIG.browser.headless,
        navigationTimeout: CONFIG.browser.navigationTimeout,
        waitForSelectorTimeout: CONFIG.browser.waitForSelectorTimeout
      },
      scroll: {
        delayMinMs: CONFIG.scroll.delayMinMs,
        delayMaxMs: CONFIG.scroll.delayMaxMs,
        incrementPx: CONFIG.scroll.incrementPx,
        maxAttempts: CONFIG.scroll.maxAttempts
      },
      interactions: {
        enabled: CONFIG.interactions.enabled
      },
      timeout: {
        default: CONFIG.api.timeout.default,
        feedExtraction: CONFIG.api.timeout.feedExtraction,
        quickOperation: CONFIG.api.timeout.quickOperation,
        interaction: CONFIG.api.timeout.interaction,
        bulkOperation: CONFIG.api.timeout.bulkOperation
      }
    };

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'Config retrieval timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.quickOperation,
        operation: 'config_retrieval',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.QUICK_OPERATION, 'config_retrieval'));

export default router;

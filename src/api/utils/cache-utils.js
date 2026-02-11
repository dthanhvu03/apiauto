/**
 * Cache Utilities
 * 
 * Cache management functions for API server
 */

import { CONFIG } from '../../config.js';

// Home feed cache (backward compatible)
const cache = {
  data: null,
  timestamp: null,
  filterHash: null
};

// User posts cache (per-user with filter hash)
const userCache = new Map();

/**
 * Generate hash from filter criteria for cache key
 * @param {Object} filter - Filter criteria
 * @returns {string} Hash string
 */
export function hashFilters(filter) {
  return JSON.stringify(filter);
}

/**
 * Generate cache key for user posts
 * @param {string} username - Username
 * @param {Object} filter - Filter criteria
 * @returns {string} Cache key
 */
export function getUserCacheKey(username, filter) {
  const filterHash = hashFilters(filter);
  return `user:${username}:${filterHash}`;
}

/**
 * Check if cache is valid (for home feed)
 * @param {Object} filter - Filter criteria
 * @returns {boolean} True if cache is valid
 */
export function isCacheValid(filter) {
  if (!CONFIG.api.cache.enabled || !cache.data) {
    return false;
  }

  const now = Date.now();
  const age = now - cache.timestamp;
  
  // Check TTL
  if (age > CONFIG.api.cache.ttl) {
    return false;
  }

  // Check if filter criteria matches
  const currentFilterHash = hashFilters(filter);
  if (cache.filterHash !== currentFilterHash) {
    return false;
  }

  return true;
}

/**
 * Check if user cache is valid
 * @param {string} username - Username
 * @param {Object} filter - Filter criteria
 * @returns {boolean} True if cache is valid
 */
export function isUserCacheValid(username, filter) {
  if (!CONFIG.api.cache.enabled) {
    return false;
  }

  const cacheKey = getUserCacheKey(username, filter);
  const cached = userCache.get(cacheKey);
  
  if (!cached || !cached.data) {
    return false;
  }

  const now = Date.now();
  const age = now - cached.timestamp;
  
  // Check TTL
  if (age > CONFIG.api.cache.ttl) {
    userCache.delete(cacheKey);
    return false;
  }

  return true;
}

/**
 * Update cache (for home feed)
 * @param {Array} data - Cache data
 * @param {Object} filter - Filter criteria
 */
export function updateCache(data, filter) {
  cache.data = data;
  cache.timestamp = Date.now();
  cache.filterHash = hashFilters(filter);
}

/**
 * Update user cache
 * @param {string} username - Username
 * @param {Array} data - Cache data
 * @param {Object} filter - Filter criteria
 */
export function updateUserCache(username, data, filter) {
  const cacheKey = getUserCacheKey(username, filter);
  userCache.set(cacheKey, {
    data: data,
    timestamp: Date.now(),
    filterHash: hashFilters(filter)
  });
}

/**
 * Get user cache
 * @param {string} username - Username
 * @param {Object} filter - Filter criteria
 * @returns {Object|null} Cached data or null
 */
export function getUserCache(username, filter) {
  const cacheKey = getUserCacheKey(username, filter);
  return userCache.get(cacheKey);
}

/**
 * Clear cache (home feed)
 */
export function clearCache() {
  cache.data = null;
  cache.timestamp = null;
  cache.filterHash = null;
}

/**
 * Clear user cache (all users or specific user)
 * @param {string|null} username - Username to clear cache for, or null for all
 */
export function clearUserCache(username = null) {
  if (username) {
    // Clear cache for specific user
    const keysToDelete = [];
    for (const key of userCache.keys()) {
      if (key.startsWith(`user:${username}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => userCache.delete(key));
  } else {
    // Clear all user caches
    userCache.clear();
  }
}

/**
 * Get cache object (for stats endpoint)
 * @returns {Object} Cache object
 */
export function getCache() {
  return cache;
}

/**
 * Get user cache map (for stats endpoint)
 * @returns {Map} User cache map
 */
export function getUserCacheMap() {
  return userCache;
}

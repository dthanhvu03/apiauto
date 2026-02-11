/**
 * Account ID Extraction Utility
 * 
 * Extracts account_id from request with flexible source support
 * Supports query params, body, headers, JWT tokens, and custom headers
 */

import { CONFIG } from '../../config.js';
import { extractBaseDirectory, createProfilePath } from '../../config.js';

/**
 * Validate account_id format
 * @param {string} accountId - Account ID to validate
 * @returns {boolean} True if valid
 */
function isValidAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    return false;
  }
  
  // Basic validation: alphanumeric, underscore, hyphen
  // Adjust pattern based on your account_id format
  const pattern = /^[a-zA-Z0-9_-]+$/;
  return pattern.test(accountId) && accountId.length > 0 && accountId.length <= 100;
}

/**
 * Extract account_id from request with flexible source support
 * 
 * Priority order:
 * 1. Query parameter (req.query.account_id)
 * 2. Request body (req.body.account_id)
 * 3. Standard headers (X-Account-ID, account-id)
 * 4. JWT token (if enabled in config)
 * 5. Custom headers (if configured)
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Account ID or null if not found
 */
export function extractAccountId(req) {
  let accountId = null;
  let source = null;

  // Priority 1: Query parameter (most common for GET requests)
  // Use case: Simple REST APIs, testing, backward compatibility
  if (req.query?.account_id) {
    accountId = String(req.query.account_id).trim();
    source = 'query';
  }
  
  // Priority 2: Request body (common for POST requests)
  // Use case: Complex payloads, mobile apps, POST-only APIs
  if (!accountId && req.body?.account_id) {
    accountId = String(req.body.account_id).trim();
    source = 'body';
  }
  
  // Priority 3: Standard headers (microservice pattern)
  // Support multiple header name variations (case-insensitive)
  if (!accountId) {
    const headerNames = [
      'x-account-id',
      'X-Account-ID',
      'account-id',
      'Account-Id',
      'ACCOUNT_ID'
    ];
    
    for (const headerName of headerNames) {
      const value = req.headers[headerName.toLowerCase()] || 
                    req.headers[headerName];
      if (value) {
        accountId = String(value).trim();
        source = 'header';
        break;
      }
    }
  }
  
  // Priority 4: JWT Token parsing (optional, requires config)
  // Only if CONFIG.api.accountId.parseJWT is enabled
  if (!accountId && CONFIG.api?.accountId?.parseJWT) {
    const authHeader = req.headers.authorization || 
                      req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // Try to require jsonwebtoken (optional dependency)
        // Note: jsonwebtoken must be installed if JWT parsing is enabled
        let jwt;
        try {
          // Use require for synchronous loading (Node.js)
          jwt = require('jsonwebtoken');
        } catch (requireError) {
          if (CONFIG.api?.accountId?.logExtraction) {
            console.log('[ACCOUNT_ID] jsonwebtoken not installed, skipping JWT parsing. Install with: npm install jsonwebtoken');
          }
          // Continue to next priority if jsonwebtoken is not available
        }
        
        if (jwt) {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, CONFIG.api.accountId.jwtSecret);
          if (decoded.account_id || decoded.accountId || decoded.sub) {
            accountId = String(decoded.account_id || decoded.accountId || decoded.sub).trim();
            source = 'jwt';
          }
        }
      } catch (error) {
        // JWT parsing failed, continue to next priority
        if (CONFIG.api?.accountId?.logExtraction) {
          console.log('[ACCOUNT_ID] JWT parsing failed:', error.message);
        }
      }
    }
  }
  
  // Priority 5: Custom headers (configurable)
  // Check CONFIG.api.accountId.customHeaders array
  if (!accountId && CONFIG.api?.accountId?.customHeaders) {
    for (const customHeader of CONFIG.api.accountId.customHeaders) {
      const value = req.headers[customHeader.toLowerCase()] || 
                    req.headers[customHeader];
      if (value) {
        accountId = String(value).trim();
        source = 'custom-header';
        break;
      }
    }
  }
  
  // Validate and return
  if (accountId) {
    if (isValidAccountId(accountId)) {
      // Log extraction source for debugging (if enabled)
      if (CONFIG.api?.accountId?.logExtraction) {
        console.log(`[ACCOUNT_ID] Extracted from: ${source}, value: ${accountId}`);
      }
      return accountId;
    } else {
      // Invalid format
      if (CONFIG.api?.accountId?.logExtraction) {
        console.warn(`[ACCOUNT_ID] Invalid format: ${accountId}`);
      }
      return null;
    }
  }
  
  // Fallback: không tìm thấy account_id
  return null;
}

/**
 * Validate profile path format
 * @param {string} path - Profile path to validate
 * @returns {boolean} True if valid
 */
function isValidProfilePath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // Reject dangerous paths (path traversal attacks)
  if (path.includes('..') || path.includes('//')) {
    return false;
  }
  
  // Reject paths that are too long
  if (path.length > 500) {
    return false;
  }
  
  // Allow absolute paths (starting with /) or relative paths
  // Relative paths should not start with . (except ./)
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return false;
  }
  
  return true;
}

/**
 * Extract profile_path from request with flexible source support
 * 
 * Priority order:
 * 1. Query parameter (req.query.profile_path or profile_dir) - Full path
 * 2. Request body (req.body.profile_path or profile_dir) - Full path
 * 3. Standard headers (X-Profile-Path, profile-path) - Full path
 * 4. Profile ID with base_directory (req.query.profile_id or req.body.profile_id) - Resolve from base_directory
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Profile path or null if not found
 */
export function extractProfilePath(req) {
  let profilePath = null;
  let source = null;
  let isProfileId = false;

  // Priority 1: Query parameter (most common for GET requests)
  // Support both profile_path and profile_dir (full paths)
  if (req.query?.profile_path) {
    profilePath = String(req.query.profile_path).trim();
    source = 'query';
  } else if (req.query?.profile_dir) {
    profilePath = String(req.query.profile_dir).trim();
    source = 'query';
  } else if (req.query?.profile_id) {
    // Profile ID - need to resolve with base_directory
    profilePath = String(req.query.profile_id).trim();
    source = 'query';
    isProfileId = true;
  }
  
  // Priority 2: Request body (common for POST requests)
  if (!profilePath && req.body?.profile_path) {
    profilePath = String(req.body.profile_path).trim();
    source = 'body';
  } else if (!profilePath && req.body?.profile_dir) {
    profilePath = String(req.body.profile_dir).trim();
    source = 'body';
  } else if (!profilePath && req.body?.profile_id) {
    // Profile ID - need to resolve with base_directory
    profilePath = String(req.body.profile_id).trim();
    source = 'body';
    isProfileId = true;
  }
  
  // Priority 3: Standard headers (microservice pattern)
  // Support multiple header name variations (case-insensitive)
  if (!profilePath) {
    const headerNames = [
      'x-profile-path',
      'X-Profile-Path',
      'profile-path',
      'Profile-Path',
      'PROFILE_PATH',
      'x-profile-dir',
      'X-Profile-Dir',
      'profile-dir',
      'Profile-Dir',
      'x-profile-id',
      'X-Profile-Id',
      'profile-id',
      'Profile-Id'
    ];
    
    for (const headerName of headerNames) {
      const value = req.headers[headerName.toLowerCase()] || 
                    req.headers[headerName];
      if (value) {
        profilePath = String(value).trim();
        source = 'header';
        // Check if it's a profile_id header
        if (headerName.toLowerCase().includes('profile-id') || headerName.toLowerCase().includes('profile_id')) {
          isProfileId = true;
        }
        break;
      }
    }
  }
  
  // If profilePath is a profile_id, resolve it with base_directory
  if (profilePath && isProfileId) {
    const baseDirectory = extractBaseDirectory(req);
    if (baseDirectory) {
      try {
        profilePath = createProfilePath(baseDirectory, profilePath);
        source = `${source} (resolved from profile_id)`;
      } catch (error) {
        if (CONFIG.api?.accountId?.logExtraction) {
          console.warn(`[PROFILE_PATH] Failed to resolve profile_id ${profilePath} with base_directory: ${error.message}`);
        }
        return null;
      }
    } else {
      // Profile ID provided but no base_directory
      if (CONFIG.api?.accountId?.logExtraction) {
        console.warn(`[PROFILE_PATH] profile_id provided but base_directory is missing`);
      }
      return null;
    }
  }
  
  // Validate and return
  if (profilePath) {
    if (isValidProfilePath(profilePath)) {
      // Log extraction source for debugging (if enabled)
      if (CONFIG.api?.accountId?.logExtraction) {
        console.log(`[PROFILE_PATH] Extracted from: ${source}, value: ${profilePath}`);
      }
      return profilePath;
    } else {
      // Invalid format
      if (CONFIG.api?.accountId?.logExtraction) {
        console.warn(`[PROFILE_PATH] Invalid format: ${profilePath}`);
      }
      return null;
    }
  }
  
  // Fallback: không tìm thấy profile_path
  return null;
}
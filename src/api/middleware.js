/**
 * API Middleware
 * 
 * CORS, request logging, and timeout middleware for Express
 */

import { CONFIG } from '../config.js';
import { getTimeoutForOperation, OPERATION_TYPES } from './utils/timeout-handler.js';

/**
 * Setup CORS middleware
 * @param {Express} app - Express app instance
 */
export function setupCORS(app) {
  if (CONFIG.api.cors.enabled) {
    app.use((req, res, next) => {
      const origin = CONFIG.api.cors.origin === '*' ? '*' : CONFIG.api.cors.origin;
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }
}

/**
 * Setup request logging middleware
 * @param {Express} app - Express app instance
 */
export function setupRequestLogging(app) {
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}${req.query && Object.keys(req.query).length > 0 ? '?' + new URLSearchParams(req.query).toString() : ''}`);
    next();
  });
}

/**
 * Setup request timeout middleware
 * Sets a default timeout for all API requests
 * @param {Express} app - Express app instance
 */
export function setupRequestTimeout(app) {
  const defaultTimeout = getTimeoutForOperation(OPERATION_TYPES.DEFAULT);
  
  app.use((req, res, next) => {
    // Set timeout for this request
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: `Request timed out after ${defaultTimeout}ms`,
          errorCode: 'TIMEOUT_ERROR',
          timeout: defaultTimeout,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }
    }, defaultTimeout);

    // Clear timeout when response is sent
    const originalEnd = res.end;
    res.end = function(...args) {
      clearTimeout(timeoutId);
      originalEnd.apply(this, args);
    };

    next();
  });
}

/**
 * Setup all middleware
 * @param {Express} app - Express app instance
 */
export function setupMiddleware(app) {
  // JSON body parser is handled in api_server.js
  setupCORS(app);
  setupRequestLogging(app);
  setupRequestTimeout(app);
}

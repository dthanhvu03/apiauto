/**
 * Timeout Handler Utility
 * 
 * Provides timeout handling for API endpoints with fail-fast strategy
 * and clear error messages
 */

import { CONFIG } from '../../config.js';

/**
 * Operation types for timeout configuration
 */
export const OPERATION_TYPES = {
  FEED_EXTRACTION: 'feedExtraction',
  QUICK_OPERATION: 'quickOperation',
  INTERACTION: 'interaction',
  BULK_OPERATION: 'bulkOperation',
  DEFAULT: 'default'
};

/**
 * Get appropriate timeout for an operation type
 * @param {string} operationType - Type of operation (from OPERATION_TYPES)
 * @returns {number} Timeout in milliseconds
 */
export function getTimeoutForOperation(operationType = OPERATION_TYPES.DEFAULT) {
  const timeoutConfig = CONFIG.api?.timeout || {};
  
  switch (operationType) {
    case OPERATION_TYPES.FEED_EXTRACTION:
      return timeoutConfig.feedExtraction || timeoutConfig.default || 300000;
    case OPERATION_TYPES.QUICK_OPERATION:
      return timeoutConfig.quickOperation || 30000;
    case OPERATION_TYPES.INTERACTION:
      return timeoutConfig.interaction || timeoutConfig.default || 120000;
    case OPERATION_TYPES.BULK_OPERATION:
      return timeoutConfig.bulkOperation || timeoutConfig.default || 600000;
    default:
      return timeoutConfig.default || 300000;
  }
}

/**
 * Create a timeout wrapper for async functions
 * @param {Function} fn - Async function to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of the operation (for error messages)
 * @returns {Promise} Promise that rejects with TimeoutError if timeout exceeded
 */
export function createTimeoutHandler(fn, timeoutMs, operationName = 'operation') {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let timeoutId = null;
    let completed = false;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        const elapsedTime = Date.now() - startTime;
        const timeoutError = formatTimeoutError(
          new Error(`Operation "${operationName}" timed out after ${timeoutMs}ms`),
          {
            operation: operationName,
            timeout: timeoutMs,
            elapsedTime,
            timestamp: new Date().toISOString()
          }
        );
        reject(timeoutError);
      }
    }, timeoutMs);

    try {
      // Execute the function
      const result = await fn();
      
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        resolve(result);
      }
    } catch (error) {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    }
  });
}

/**
 * Format timeout error with consistent structure
 * @param {Error} error - Original error object
 * @param {Object} context - Additional context (operation, timeout, elapsedTime, etc.)
 * @returns {Object} Formatted timeout error
 */
export function formatTimeoutError(error, context = {}) {
  const {
    operation = 'unknown',
    timeout = null,
    elapsedTime = null,
    timestamp = new Date().toISOString(),
    ...additionalContext
  } = context;

  const formattedError = {
    name: 'TimeoutError',
    message: error.message || `Operation "${operation}" timed out`,
    errorCode: 'TIMEOUT_ERROR',
    operation,
    timeout,
    elapsedTime,
    timestamp,
    ...additionalContext
  };

  // Preserve original error properties if they exist
  if (error.stack) {
    formattedError.stack = error.stack;
  }
  if (error.code) {
    formattedError.code = error.code;
  }

  return formattedError;
}

/**
 * Wrap Express route handler with timeout
 * @param {Function} handler - Express route handler (async function)
 * @param {string} operationType - Operation type (from OPERATION_TYPES)
 * @param {string} operationName - Operation name (for error messages)
 * @returns {Function} Wrapped Express route handler
 */
export function wrapRouteWithTimeout(handler, operationType = OPERATION_TYPES.DEFAULT, operationName = 'route') {
  return async (req, res, next) => {
    const timeoutMs = getTimeoutForOperation(operationType);
    const startTime = Date.now();
    let timeoutId = null;
    let completed = false;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!completed && !res.headersSent) {
        completed = true;
        const elapsedTime = Date.now() - startTime;
        return res.status(504).json({
          success: false,
          error: `Operation "${operationName}" timed out after ${timeoutMs}ms`,
          errorCode: 'TIMEOUT_ERROR',
          timeout: timeoutMs,
          operation: operationName,
          elapsedTime: elapsedTime,
          timestamp: new Date().toISOString()
        });
      }
    }, timeoutMs);

    try {
      // Execute the handler
      await handler(req, res, (err) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutId);
          if (err) {
            next(err);
          }
        }
      });
      
      // Clear timeout if response was sent
      if (res.headersSent && !completed) {
        completed = true;
        clearTimeout(timeoutId);
      }
    } catch (error) {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        
        // If it's a timeout error, send proper response
        if (error.errorCode === 'TIMEOUT_ERROR' || error instanceof Error && error.name === 'TimeoutError') {
          if (!res.headersSent) {
            return res.status(504).json({
              success: false,
              error: error.message || `Operation "${operationName}" timed out`,
              errorCode: 'TIMEOUT_ERROR',
              timeout: error.timeout || timeoutMs,
              operation: operationName,
              elapsedTime: error.elapsedTime || (Date.now() - startTime),
              timestamp: error.timestamp || new Date().toISOString()
            });
          }
        }
        
        // Otherwise, pass to error handler
        if (!res.headersSent) {
          next(error);
        }
      }
    }
  };
}

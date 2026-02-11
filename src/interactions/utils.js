/**
 * Utility Functions for Interactions
 * 
 * Provides retry logic, logging, validation, and other utilities
 */

import { CONFIG } from '../config.js';

/**
 * Log levels
 */
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Current log level (can be configured)
 */
let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Set log level
 */
export function setLogLevel(level) {
  currentLogLevel = level;
}

/**
 * Structured logging function
 */
export function log(level, message, context = {}) {
  const levelNum = typeof level === 'string' ? LOG_LEVELS[level.toUpperCase()] : level;
  
  if (levelNum < currentLogLevel) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: typeof level === 'string' ? level.toUpperCase() : 'INFO',
    message,
    ...context
  };

  const prefix = `[${logEntry.level}]`;
  const contextStr = Object.keys(context).length > 0 
    ? ` ${JSON.stringify(context)}` 
    : '';

  switch (levelNum) {
    case LOG_LEVELS.DEBUG:
      console.debug(`${prefix} ${message}${contextStr}`);
      break;
    case LOG_LEVELS.INFO:
      console.log(`${prefix} ${message}${contextStr}`);
      break;
    case LOG_LEVELS.WARN:
      console.warn(`${prefix} ${message}${contextStr}`);
      break;
    case LOG_LEVELS.ERROR:
      console.error(`${prefix} ${message}${contextStr}`);
      if (context.error && context.error.stack) {
        console.error('Stack:', context.error.stack);
      }
      break;
  }

  return logEntry;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry = null,
    shouldRetry = null,
    context = {}
  } = options;

  let lastError;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        log(LOG_LEVELS.INFO, `Retry successful after ${attempt} attempts`, context);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        log(LOG_LEVELS.ERROR, `Max retries (${maxRetries}) exceeded`, {
          ...context,
          error: error.message
        });
        break;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        await onRetry(error, attempt + 1, maxRetries);
      }

      log(LOG_LEVELS.WARN, `Retry attempt ${attempt + 1}/${maxRetries} after ${currentDelay}ms`, {
        ...context,
        error: error.message
      });

      // Wait before retrying
      await delay(currentDelay);

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Delay helper
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate post ID
 */
export function validatePostId(postId) {
  if (!postId) {
    throw new Error('Post ID is required');
  }
  if (typeof postId !== 'string' && typeof postId !== 'number') {
    throw new Error('Post ID must be a string or number');
  }
  const postIdStr = String(postId);
  if (postIdStr.trim().length === 0) {
    throw new Error('Post ID cannot be empty');
  }
  return postIdStr;
}

/**
 * Validate comment/quote text
 */
export function validateCommentText(text, maxLength = 500) {
  if (!text) {
    throw new Error('Comment text is required');
  }
  if (typeof text !== 'string') {
    throw new Error('Comment text must be a string');
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Comment text cannot be empty');
  }
  if (trimmed.length > maxLength) {
    throw new Error(`Comment text exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

/**
 * Validate username
 */
export function validateUsername(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  if (typeof username !== 'string') {
    throw new Error('Username must be a string');
  }
  const cleaned = username.replace(/^@/, '').trim();
  if (cleaned.length === 0) {
    throw new Error('Username cannot be empty');
  }
  if (cleaned.length > 30) {
    throw new Error('Username exceeds maximum length of 30 characters');
  }
  // Basic validation - alphanumeric, underscore, dot
  if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) {
    throw new Error('Username contains invalid characters');
  }
  return cleaned;
}

/**
 * Handle interaction errors with recovery strategies
 */
export async function handleInteractionError(error, context = {}) {
  const { page, action, postId, username } = context;
  const errorMessage = error.message || String(error);
  const lowerMessage = errorMessage.toLowerCase();

  log(LOG_LEVELS.ERROR, `Interaction error: ${errorMessage}`, {
    action,
    postId,
    username,
    error: error.stack || error
  });

  // Session expired - try to re-login
  if (lowerMessage.includes('session') || 
      lowerMessage.includes('login') || 
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('not logged in')) {
    if (page && CONFIG.interactions.login.autoLogin) {
      log(LOG_LEVELS.INFO, 'Attempting to re-login due to session expiration', context);
      // Re-login will be handled by ensureLoggedIn in the calling function
      return {
        recoverable: true,
        recoveryAction: 're-login',
        error: error
      };
    }
  }

  // Element not found - might be recoverable with different selectors
  if (lowerMessage.includes('not found') || 
      lowerMessage.includes('could not find') ||
      lowerMessage.includes('element')) {
    return {
      recoverable: true,
      recoveryAction: 'retry-with-different-selectors',
      error: error
    };
  }

  // Rate limit - wait and retry
  if (lowerMessage.includes('rate limit') || 
      lowerMessage.includes('too many requests')) {
    const retryAfter = extractRetryAfter(errorMessage) || 60000; // Default 1 minute
    log(LOG_LEVELS.WARN, `Rate limit detected, waiting ${retryAfter}ms`, context);
    return {
      recoverable: true,
      recoveryAction: 'wait-and-retry',
      retryAfter,
      error: error
    };
  }

  // Timeout - might be recoverable, but with fail-fast strategy, we don't retry
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    // Extract timeout context if available
    const timeoutValue = error.timeout || error.context?.timeout || null;
    const operation = error.operation || error.context?.operation || action || 'unknown';
    const url = error.url || error.context?.url || null;
    const selector = error.selector || error.context?.selector || null;
    
    log(LOG_LEVELS.WARN, `Timeout detected: ${operation}`, {
      timeout: timeoutValue,
      url,
      selector,
      action,
      postId,
      username
    });
    
    // With fail-fast strategy, timeouts are not recoverable
    return {
      recoverable: false,
      recoveryAction: 'none',
      error: error,
      timeoutContext: {
        timeout: timeoutValue,
        operation,
        url,
        selector
      }
    };
  }

  // Not recoverable
  return {
    recoverable: false,
    error: error
  };
}

/**
 * Extract retry-after value from error message
 */
function extractRetryAfter(message) {
  const match = message.match(/retry[-\s]after[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10) * 1000; // Convert to milliseconds
  }
  return null;
}

/**
 * Wait for element with multiple selectors
 */
export async function waitForElement(page, selectors, options = {}) {
  const {
    timeout = CONFIG.browser.timeouts.normalOperation,
    state = 'visible',
    retries = 3
  } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const selector of selectors) {
      try {
        const element = await page.waitForSelector(selector, {
          timeout: timeout / retries,
          state
        });
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            return { element, selector };
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (attempt < retries - 1) {
      await delay(1000);
    }
  }

  return null;
}

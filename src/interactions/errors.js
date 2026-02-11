/**
 * Custom Error Classes for Interactions
 * 
 * Provides structured error types for better error handling and recovery
 */

/**
 * Base error class for all interaction errors
 */
export class InteractionError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'InteractionError';
    this.code = code || 'INTERACTION_ERROR';
    this.context = context;
    this.timestamp = new Date().toISOString();
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InteractionError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Error when login fails
 */
export class LoginError extends InteractionError {
  constructor(message, context = {}) {
    super(message, 'LOGIN_ERROR', context);
    this.name = 'LoginError';
  }
}

/**
 * Error when an element cannot be found on the page
 */
export class ElementNotFoundError extends InteractionError {
  constructor(message, selector, context = {}) {
    super(message, 'ELEMENT_NOT_FOUND', { ...context, selector });
    this.name = 'ElementNotFoundError';
    this.selector = selector;
  }
}

/**
 * Error when rate limiting is detected
 */
export class RateLimitError extends InteractionError {
  constructor(message, retryAfter = null, context = {}) {
    super(message, 'RATE_LIMIT', { ...context, retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error when session has expired
 */
export class SessionExpiredError extends InteractionError {
  constructor(message, context = {}) {
    super(message, 'SESSION_EXPIRED', context);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Error when navigation fails
 */
export class NavigationError extends InteractionError {
  constructor(message, url, context = {}) {
    super(message, 'NAVIGATION_ERROR', { ...context, url });
    this.name = 'NavigationError';
    this.url = url;
  }
}

/**
 * Error when validation fails
 */
export class ValidationError extends InteractionError {
  constructor(message, field, context = {}) {
    super(message, 'VALIDATION_ERROR', { ...context, field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error when an action times out
 */
export class TimeoutError extends InteractionError {
  constructor(message, timeout = null, context = {}) {
    const {
      operation = 'unknown',
      elapsedTime = null,
      url = null,
      selector = null,
      ...additionalContext
    } = context;
    
    super(message, 'TIMEOUT_ERROR', { 
      ...additionalContext, 
      timeout,
      operation,
      elapsedTime,
      url,
      selector
    });
    this.name = 'TimeoutError';
    this.timeout = timeout;
    this.operation = operation;
    this.elapsedTime = elapsedTime;
    this.url = url;
    this.selector = selector;
  }
}

/**
 * Helper to classify and wrap errors
 */
export function classifyError(error, context = {}) {
  // If already a custom error, return as is
  if (error instanceof InteractionError) {
    return error;
  }

  const errorMessage = error.message || String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Classify based on error message patterns
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    // Extract timeout value from error message if available
    const timeoutMatch = errorMessage.match(/timeout[:\s]+(\d+)/i) || 
                        errorMessage.match(/(\d+)\s*ms/i) ||
                        errorMessage.match(/after\s+(\d+)/i);
    const extractedTimeout = timeoutMatch ? parseInt(timeoutMatch[1], 10) : null;
    
    return new TimeoutError(errorMessage, extractedTimeout, context);
  }

  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    const retryAfter = extractRetryAfter(errorMessage);
    return new RateLimitError(errorMessage, retryAfter, context);
  }

  if (lowerMessage.includes('session') || lowerMessage.includes('login') || lowerMessage.includes('unauthorized')) {
    return new SessionExpiredError(errorMessage, context);
  }

  if (lowerMessage.includes('not found') || lowerMessage.includes('could not find')) {
    return new ElementNotFoundError(errorMessage, null, context);
  }

  if (lowerMessage.includes('navigation') || lowerMessage.includes('failed to navigate')) {
    return new NavigationError(errorMessage, context.url || null, context);
  }

  // Default to generic InteractionError
  return new InteractionError(errorMessage, 'UNKNOWN_ERROR', context);
}

/**
 * Extract retry-after value from error message or headers
 */
function extractRetryAfter(message) {
  const match = message.match(/retry[-\s]after[:\s]+(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Like/Unlike Post Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to like and unlike Threads posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { 
  delay, 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validatePostId,
  handleInteractionError
} from './utils.js';
import { 
  InteractionError, 
  ElementNotFoundError, 
  SessionExpiredError,
  TimeoutError,
  classifyError
} from './errors.js';
import { ensureLoggedIn } from './session.js';
import { getPostLikeButton, navigateToPost } from './post-helpers.js';

/**
 * Like a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function likePost(page, postId, options = {}) {
  const startTime = Date.now();
  const actionContext = { action: 'like', postId, ...options };

  try {
    // Validate inputs
    if (!CONFIG.interactions.enabled) {
      throw new InteractionError(
        'Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.',
        'INTERACTIONS_DISABLED',
        actionContext
      );
    }

    try {
      validatePostId(postId);
    } catch (validationError) {
      throw new InteractionError(
        validationError.message,
        'VALIDATION_ERROR',
        actionContext
      );
    }

    const { username, shortcode, postUrl, accountId } = options;
    const config = CONFIG.interactions.like;

    log(LOG_LEVELS.INFO, `Starting like action for post ${postId}`, actionContext);

    // Ensure user is logged in with retry
    const context = page.context();
    const loginCheck = await retryWithBackoff(
      () => ensureLoggedIn(page, context, accountId),
      {
        maxRetries: 2,
        initialDelay: 1000,
        context: { ...actionContext, subAction: 'login-check' },
        shouldRetry: (error) => {
          const msg = error.message?.toLowerCase() || '';
          return msg.includes('timeout') || msg.includes('navigation');
        }
      }
    ).catch(async (error) => {
      const errorInfo = await handleInteractionError(error, { page, ...actionContext });
      throw new SessionExpiredError(
        `Login required: ${error.message || errorInfo.error?.message}`,
        actionContext
      );
    });

    if (!loginCheck.success) {
      throw new SessionExpiredError(
        `Login required: ${loginCheck.error}`,
        actionContext
      );
    }
    // Navigate to post with retry
    if (postUrl) {
      await retryWithBackoff(
        () => page.goto(postUrl, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.browser.navigationTimeout
        }),
        {
          maxRetries: 2,
          initialDelay: 1000,
          context: { ...actionContext, subAction: 'navigate' }
        }
      );
      await delay(CONFIG.browser.waitAfterNavigation);
    } else if (postId) {
      const navSuccess = await retryWithBackoff(
        () => navigateToPost(page, postId, username, shortcode),
        {
          maxRetries: 2,
          initialDelay: 1000,
          context: { ...actionContext, subAction: 'navigate' }
        }
      ).catch(() => false);

      if (!navSuccess) {
        throw new InteractionError(
          'Failed to navigate to post',
          'NAVIGATION_ERROR',
          actionContext
        );
      }
    }

    // Find and click like button with retry
    const buttonResult = await retryWithBackoff(
      () => getPostLikeButton(page, postId),
      {
        maxRetries: config.retryAttempts,
        initialDelay: 1000,
        context: { ...actionContext, subAction: 'find-button' },
        shouldRetry: (error) => {
          // Retry if element not found
          return error === null || (error.message && error.message.includes('not found'));
        }
      }
    ).catch(() => null);

    if (!buttonResult) {
      throw new ElementNotFoundError(
        'Could not find like button',
        'likeButton',
        actionContext
      );
    }

    const { element, isLiked } = buttonResult;

    if (isLiked) {
      log(LOG_LEVELS.INFO, `Post ${postId} is already liked`, actionContext);
      return { 
        success: true, 
        alreadyLiked: true, 
        message: 'Post is already liked',
        duration: Date.now() - startTime
      };
    }

    // Human-like delay before click
    await delay(config.delayBeforeClick);

    // Click with retry
    await retryWithBackoff(
      () => element.click(),
      {
        maxRetries: 2,
        initialDelay: 500,
        context: { ...actionContext, subAction: 'click' }
      }
    );

    await delay(config.delayAfterClick);

    // Verify by checking if unlike button appears
    const verifyResult = await getPostLikeButton(page, postId);
    const duration = Date.now() - startTime;

    if (verifyResult && verifyResult.isLiked) {
      log(LOG_LEVELS.INFO, `Post ${postId} liked successfully`, { ...actionContext, duration });
      return { 
        success: true, 
        alreadyLiked: false, 
        message: 'Post liked successfully',
        duration
      };
    }

    // If verification failed but we clicked, assume success
    log(LOG_LEVELS.WARN, `Post ${postId} like action completed but verification uncertain`, { ...actionContext, duration });
    return { 
      success: true, 
      alreadyLiked: false, 
      message: 'Like action completed (verification uncertain)',
      duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error liking post ${postId}`, {
      ...actionContext,
      error: classifiedError.message,
      recoverable: errorInfo.recoverable,
      duration: Date.now() - startTime
    });

    // If recoverable and it's a session error, return specific error
    if (errorInfo.recoverable && errorInfo.recoveryAction === 're-login') {
      return { 
        success: false, 
        error: 'Session expired. Please login again.',
        errorCode: 'SESSION_EXPIRED',
        recoverable: true
      };
    }

    return { 
      success: false, 
      error: classifiedError.message || error.message,
      errorCode: classifiedError.code || 'UNKNOWN_ERROR',
      recoverable: errorInfo.recoverable || false
    };
  }
}

/**
 * Unlike a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function unlikePost(page, postId, options = {}) {
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  const { username, shortcode, postUrl, accountId } = options;
  const config = CONFIG.interactions.like;

  try {
    // Ensure user is logged in
    const context = page.context();
    const loginCheck = await ensureLoggedIn(page, context, accountId);
    if (!loginCheck.success) {
      return {
        success: false,
        error: `Login required: ${loginCheck.error}`
      };
    }
    // Navigate to post if needed
    if (postUrl) {
      await page.goto(postUrl, {
        waitUntil: 'networkidle',
        timeout: CONFIG.browser.navigationTimeout
      });
      await delay(CONFIG.browser.waitAfterNavigation);
    } else if (postId) {
      const navSuccess = await navigateToPost(page, postId, username, shortcode);
      if (!navSuccess) {
        return { success: false, error: 'Failed to navigate to post' };
      }
    }

    // Find and click unlike button
    let attempts = 0;
    while (attempts < config.retryAttempts) {
      const buttonResult = await getPostLikeButton(page, postId);
      
      if (!buttonResult || !buttonResult.isLiked) {
        return { success: true, alreadyUnliked: true, message: 'Post is not liked' };
      }

      const { element } = buttonResult;

      // Human-like delay before click
      await delay(config.delayBeforeClick);

      try {
        await element.click();
        await delay(config.delayAfterClick);

        // Verify by checking if like button appears
        const verifyResult = await getPostLikeButton(page, postId);
        if (verifyResult && !verifyResult.isLiked) {
          return { success: true, alreadyUnliked: false, message: 'Post unliked successfully' };
        }

        return { success: true, alreadyUnliked: false, message: 'Unlike action completed (verification uncertain)' };
      } catch (clickError) {
        attempts++;
        if (attempts < config.retryAttempts) {
          await delay(1000);
          continue;
        }
        return { success: false, error: `Failed to click unlike button: ${clickError.message}` };
      }
    }

    return { success: false, error: 'Max retry attempts reached' };
  } catch (error) {
    console.error(`[INTERACT] Error unliking post ${postId}:`, error);
    return { success: false, error: error.message };
  }
}

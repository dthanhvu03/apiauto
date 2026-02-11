/**
 * Post Interaction Status Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to check interaction status of Threads posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { 
  delay, 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validatePostId
} from './utils.js';
import { classifyError } from './errors.js';
import { ensureLoggedIn } from './session.js';
import { navigateToPost, getPostLikeButton } from './post-helpers.js';

/**
 * Get interaction status of a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Status object with isLiked and canInteract
 */
export async function getPostInteractionStatus(page, postId, options = {}) {
  const { username, shortcode, postUrl, accountId } = options;
  const actionContext = { action: 'get-status', postId, ...options };

  try {
    validatePostId(postId);
  } catch (validationError) {
    return { success: false, error: validationError.message };
  }

  try {
    // Ensure user is logged in (required to check interaction status accurately)
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
      log(LOG_LEVELS.WARN, 'Login check failed, continuing without login', {
        ...actionContext,
        error: error.message
      });
      return { success: false, error: error.message };
    });

    if (!loginCheck.success) {
      log(LOG_LEVELS.WARN, 'Not logged in, interaction status may be inaccurate', actionContext);
      // Continue anyway, but note that status may not be accurate
    } else {
      log(LOG_LEVELS.INFO, 'Login verified for interaction status check', actionContext);
    }

    // Navigate to post if needed
    if (postUrl) {
      await retryWithBackoff(
        () => page.goto(postUrl, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.browser.navigationTimeout
        }),
        { maxRetries: 2, context: actionContext }
      );
      await delay(CONFIG.browser.waitAfterNavigation);
    } else if (postId) {
      const navSuccess = await retryWithBackoff(
        () => navigateToPost(page, postId, username, shortcode),
        { maxRetries: 2, context: actionContext }
      ).catch(() => false);

      if (!navSuccess) {
        return { success: false, error: 'Failed to navigate to post' };
      }
    }

    const buttonResult = await getPostLikeButton(page, postId);
    const isLiked = buttonResult ? buttonResult.isLiked : null;

    return {
      success: true,
      isLiked: isLiked,
      canInteract: buttonResult !== null
    };
  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    log(LOG_LEVELS.ERROR, `Error getting interaction status`, {
      ...actionContext,
      error: classifiedError.message
    });
    return { success: false, error: classifiedError.message };
  }
}

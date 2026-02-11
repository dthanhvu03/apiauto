/**
 * Unrepost Post Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to unrepost Threads posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { 
  delay, 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validatePostId,
  waitForElement,
  handleInteractionError
} from './utils.js';
import { 
  InteractionError, 
  ElementNotFoundError, 
  SessionExpiredError,
  classifyError
} from './errors.js';
import { ensureLoggedIn } from './session.js';
import { navigateToPost } from './post-helpers.js';
import { getRepostStatus, scanAndScoreUnrepostButton } from './repost.js';

/**
 * Unrepost a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function unrepostPost(page, postId, options = {}) {
  const startTime = Date.now();
  const actionContext = { action: 'unrepost', postId, ...options };

  try {
    if (!CONFIG.interactions.enabled) {
      throw new InteractionError(
        'Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.',
        'INTERACTIONS_DISABLED',
        actionContext
      );
    }

    validatePostId(postId);

    const { username, shortcode, postUrl, accountId } = options;
    const config = CONFIG.interactions.repost;

    log(LOG_LEVELS.INFO, `Starting unrepost action for post ${postId}`, actionContext);

    // Ensure user is logged in
    const context = page.context();
    const loginCheck = await retryWithBackoff(
      () => ensureLoggedIn(page, context, accountId),
      { maxRetries: 2, context: { ...actionContext, subAction: 'login-check' } }
    ).catch(() => ({ success: false, error: 'Login failed' }));

    if (!loginCheck.success) {
      throw new SessionExpiredError(`Login required: ${loginCheck.error}`, actionContext);
    }

    // Navigate to post
    if (postUrl) {
      await retryWithBackoff(
        () => page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.browser.navigationTimeout }),
        { maxRetries: 2, context: { ...actionContext, subAction: 'navigate' } }
      );
      await delay(CONFIG.browser.waitAfterNavigation);
    } else if (postId) {
      const navSuccess = await retryWithBackoff(
        () => navigateToPost(page, postId, username, shortcode),
        { maxRetries: 2, context: { ...actionContext, subAction: 'navigate' } }
      ).catch(() => false);

      if (!navSuccess) {
        throw new InteractionError('Failed to navigate to post', 'NAVIGATION_ERROR', actionContext);
      }
    }

    // Check repost status first (will check for "Repost" button - highest priority if not reposted)
    log(LOG_LEVELS.INFO, `Checking if post ${postId} is reposted...`, actionContext);
    const repostStatus = await getRepostStatus(page, postId, options);
    
    if (!repostStatus.success) {
      log(LOG_LEVELS.WARN, `Could not check repost status, proceeding anyway...`, {
        ...actionContext,
        error: repostStatus.error
      });
    } else if (!repostStatus.isReposted) {
      // Post is NOT reposted (found "Repost" button, not "Remove" button) - cannot unrepost
      log(LOG_LEVELS.INFO, `Post ${postId} is not reposted (found "Repost" button, not "Remove" button) - skipping unrepost action`, actionContext);
      return {
        success: true,
        alreadyUnreposted: true,
        message: 'Post is not reposted',
        duration: Date.now() - startTime
      };
    }
    
    log(LOG_LEVELS.INFO, `Post ${postId} is reposted, proceeding with unrepost...`, actionContext);
    
    // Find unrepost button using optimized scan and score method
    log(LOG_LEVELS.INFO, `Looking for unrepost button for post ${postId}`, actionContext);
    
    // First try optimized scan method
    let unrepostButtonElement = await scanAndScoreUnrepostButton(page, actionContext);
    
    // Fallback to traditional waitForElement if scan didn't find it
    if (!unrepostButtonElement) {
      log(LOG_LEVELS.DEBUG, `Scan method didn't find button, trying traditional selectors...`, actionContext);
      const unrepostButtonResult = await waitForElement(page, CONFIG.selectors.unrepostButton, {
        timeout: CONFIG.browser.timeouts.normalOperation,
        retries: 3
      });
      
      if (unrepostButtonResult) {
        unrepostButtonElement = unrepostButtonResult.element;
      }
    }

    if (!unrepostButtonElement) {
      throw new ElementNotFoundError('Could not find unrepost button', 'unrepostButton', actionContext);
    }

    log(LOG_LEVELS.INFO, `Found unrepost button, clicking...`, actionContext);
    await delay(config.delayBeforeClick);
    
    // Try multiple click strategies
    let clickSuccess = false;
    try {
      await unrepostButtonElement.click({ timeout: CONFIG.browser.timeouts.normalOperation });
      clickSuccess = true;
      log(LOG_LEVELS.INFO, 'Unrepost button clicked (normal click)', actionContext);
    } catch (e) {
      try {
        await unrepostButtonElement.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
        clickSuccess = true;
        log(LOG_LEVELS.INFO, 'Unrepost button clicked (force click)', actionContext);
      } catch (e2) {
        try {
          await unrepostButtonElement.evaluate((el) => {
            if (el && typeof el.click === 'function') {
              el.click();
            } else if (el) {
              const event = new MouseEvent('click', { bubbles: true, cancelable: true });
              el.dispatchEvent(event);
            }
          });
          clickSuccess = true;
          log(LOG_LEVELS.INFO, 'Unrepost button clicked (JavaScript click)', actionContext);
        } catch (e3) {
          log(LOG_LEVELS.WARN, `All click strategies failed`, actionContext);
        }
      }
    }
    
    if (!clickSuccess) {
      throw new InteractionError('Failed to click unrepost button', 'CLICK_FAILED', actionContext);
    }
    
    await delay(1500); // Wait for modal or action to complete
    
    // Check for confirmation modal (similar to unfollow)
    const confirmSelectors = CONFIG.selectors.unfollowConfirmButton || [
      'button:has-text("Unfollow")',
      'button:has-text("Confirm")',
      'div[role="dialog"] button:has-text("Unfollow")',
      'div[role="dialog"] button:has-text("Confirm")'
    ];
    
    let confirmButton = null;
    for (const selector of confirmSelectors) {
      try {
        const btn = await page.waitForSelector(selector, { timeout: CONFIG.browser.timeouts.quickCheck, state: 'visible' }).catch(() => null);
        if (btn) {
          const isVisible = await btn.isVisible().catch(() => false);
          if (isVisible) {
            confirmButton = btn;
            log(LOG_LEVELS.INFO, `Found confirmation modal, clicking confirm...`, actionContext);
            await btn.click();
            await delay(1000);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    await delay(config.delayAfterClick);

    // Verify unrepost by checking if repost button appears
    log(LOG_LEVELS.INFO, `Verifying unrepost...`, actionContext);
    await delay(2000);
    
    // Try optimized scan method first for verification
    let verifyRepostButtonElement = await scanAndScoreRepostButton(page, actionContext);
    let verifyRepostButton = null;
    
    if (verifyRepostButtonElement) {
      verifyRepostButton = { element: verifyRepostButtonElement, selector: 'scanned' };
    } else {
      // Fallback to traditional waitForElement
      verifyRepostButton = await waitForElement(page, CONFIG.selectors.repostButton, {
        timeout: CONFIG.browser.timeouts.normalOperation,
        retries: 3
      }).catch(() => null);
    }
    
    // Check if unrepost button is gone (should be gone after unreposting)
    let verifyUnrepostButtonElement = await scanAndScoreUnrepostButton(page, actionContext);
    let verifyUnrepostButton = null;
    
    if (verifyUnrepostButtonElement) {
      verifyUnrepostButton = { element: verifyUnrepostButtonElement, selector: 'scanned' };
    } else {
      // Fallback to traditional waitForElement
      verifyUnrepostButton = await waitForElement(page, CONFIG.selectors.unrepostButton, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        retries: 1
      }).catch(() => null);
    }
    
    const verified = verifyRepostButton && !verifyUnrepostButton;
    
    const duration = Date.now() - startTime;
    
    if (verified) {
      log(LOG_LEVELS.INFO, `Post ${postId} unreposted successfully (verified)`, { ...actionContext, duration });
    } else {
      log(LOG_LEVELS.INFO, `Post ${postId} unrepost action completed but verification uncertain`, { ...actionContext, duration });
    }
    
    return {
      success: true,
      message: verified ? 'Post unreposted successfully (verified)' : 'Post unrepost action completed (verification uncertain)',
      verified: verified,
      duration: duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error unreposting post ${postId}`, {
      ...actionContext,
      error: classifiedError.message,
      recoverable: errorInfo.recoverable
    });

    return {
      success: false,
      error: classifiedError.message || error.message,
      errorCode: classifiedError.code || 'UNKNOWN_ERROR',
      recoverable: errorInfo.recoverable || false
    };
  }
}

/**
 * Follow User Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to follow Threads users.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { 
  delay, 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validateUsername,
  handleInteractionError
} from './utils.js';
import { 
  InteractionError, 
  ElementNotFoundError, 
  SessionExpiredError,
  classifyError
} from './errors.js';
import { ensureLoggedIn } from './session.js';
import { navigateToUserProfile, getFollowButton } from './user-helpers.js';

/**
 * Follow a user
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to follow
 * @returns {Promise<Object>} Result object with success status
 */
export async function followUser(page, username, accountId = null) {
  const startTime = Date.now();
  const actionContext = { action: 'follow', username };

  try {
    if (!CONFIG.interactions.enabled) {
      throw new InteractionError(
        'Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.',
        'INTERACTIONS_DISABLED',
        actionContext
      );
    }

    const cleanUsername = validateUsername(username);
    const config = CONFIG.interactions.follow;

    log(LOG_LEVELS.INFO, `Starting follow action for user ${cleanUsername}`, actionContext);

    // Ensure user is logged in
    const context = page.context();
    const loginCheck = await retryWithBackoff(
      () => ensureLoggedIn(page, context, accountId),
      { maxRetries: 2, context: { ...actionContext, subAction: 'login-check' } }
    ).catch(() => ({ success: false, error: 'Login failed' }));

    if (!loginCheck.success) {
      throw new SessionExpiredError(`Login required: ${loginCheck.error}`, actionContext);
    }

    // Navigate to user profile
    const navSuccess = await retryWithBackoff(
      () => navigateToUserProfile(page, cleanUsername),
      { maxRetries: 2, context: { ...actionContext, subAction: 'navigate' } }
    ).catch(() => false);

    if (!navSuccess) {
      throw new InteractionError('Failed to navigate to user profile', 'NAVIGATION_ERROR', actionContext);
    }

    // Wait for profile page to fully load
    await delay(3000);

    // Find follow button
    log(LOG_LEVELS.INFO, `Looking for follow button for user ${cleanUsername}...`, actionContext);
    const buttonResult = await retryWithBackoff(
      () => getFollowButton(page, cleanUsername),
      {
        maxRetries: config.retryAttempts,
        initialDelay: 1000,
        context: { ...actionContext, subAction: 'find-button' },
        shouldRetry: (error) => error === null
      }
    ).catch(() => null);

    if (!buttonResult) {
      // Debug: log current URL and page structure
      const currentUrl = page.url();
      log(LOG_LEVELS.ERROR, `Could not find follow button. Current URL: ${currentUrl}`, actionContext);
      
      // Try to get page title
      try {
        const pageTitle = await page.title();
        log(LOG_LEVELS.DEBUG, `Page title: ${pageTitle}`, actionContext);
      } catch (e) {
        // Ignore
      }
      
      throw new ElementNotFoundError('Could not find follow button', 'followButton', actionContext);
    }

    const { element, isFollowing } = buttonResult;

    if (isFollowing) {
      log(LOG_LEVELS.INFO, `User ${cleanUsername} is already being followed`, actionContext);
      return {
        success: true,
        alreadyFollowing: true,
        message: 'User is already being followed',
        duration: Date.now() - startTime
      };
    }

    // Get button info before click for debugging
    const buttonTextBefore = await element.textContent().catch(() => '');
    const buttonAriaBefore = await element.getAttribute('aria-label').catch(() => '');
    log(LOG_LEVELS.DEBUG, `Button before click: text="${buttonTextBefore}", aria="${buttonAriaBefore}"`, actionContext);

    // Scroll button into view
    try {
      await element.scrollIntoViewIfNeeded();
      await delay(500);
    } catch (e) {
      // Ignore scroll errors
    }

    // Human-like delay before click
    await delay(config.delayBeforeClick);

    // Try multiple click strategies
    let clickSuccess = false;
    
    // Strategy 1: Normal click
    try {
      await element.click({ timeout: CONFIG.browser.timeouts.normalOperation });
      clickSuccess = true;
      log(LOG_LEVELS.INFO, 'Follow button clicked (normal click)', actionContext);
    } catch (e) {
      log(LOG_LEVELS.DEBUG, `Normal click failed: ${e.message}, trying force click...`, actionContext);
      
      // Strategy 2: Force click
      try {
        await element.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
        clickSuccess = true;
        log(LOG_LEVELS.INFO, 'Follow button clicked (force click)', actionContext);
      } catch (e2) {
        log(LOG_LEVELS.DEBUG, `Force click failed: ${e2.message}, trying JavaScript click...`, actionContext);
        
        // Strategy 3: JavaScript click
        try {
          await page.evaluate((el) => {
            if (el && typeof el.click === 'function') {
              el.click();
            } else if (el) {
              // Dispatch click event
              const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              el.dispatchEvent(event);
            }
          }, await element.evaluateHandle((el) => el));
          clickSuccess = true;
          log(LOG_LEVELS.INFO, 'Follow button clicked (JavaScript click)', actionContext);
        } catch (e3) {
          log(LOG_LEVELS.WARN, `All click strategies failed: ${e3.message}`, actionContext);
        }
      }
    }

    if (!clickSuccess) {
      throw new InteractionError('Failed to click follow button', 'CLICK_FAILED', actionContext);
    }

    // Wait longer for page to update after click
    await delay(Math.max(config.delayAfterClick, 2000));

    // Debug: Check button state immediately after click
    try {
      const buttonTextAfter = await element.textContent().catch(() => '');
      const buttonAriaAfter = await element.getAttribute('aria-label').catch(() => '');
      log(LOG_LEVELS.DEBUG, `Button after click: text="${buttonTextAfter}", aria="${buttonAriaAfter}"`, actionContext);
    } catch (e) {
      // Ignore
    }

    // Debug: List all buttons on page after click to see what changed
    try {
      const allButtonsAfter = await page.$$('button, div[role="button"], span[role="button"]').catch(() => []);
      const buttonInfo = await Promise.all(
        allButtonsAfter.slice(0, 15).map(async (btn) => {
          try {
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) return null;
            const text = await btn.textContent().catch(() => '');
            const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
            const className = await btn.getAttribute('class').catch(() => '');
            return { 
              text: text?.trim(), 
              ariaLabel: ariaLabel?.trim(),
              class: className?.substring(0, 50) // First 50 chars
            };
          } catch {
            return null;
          }
        })
      ).catch(() => []);
      log(LOG_LEVELS.DEBUG, `All buttons after click:`, { username: cleanUsername, buttons: buttonInfo.filter(Boolean) });
    } catch (e) {
      log(LOG_LEVELS.DEBUG, `Failed to get button info: ${e.message}`, actionContext);
    }

    // Verify by checking if unfollow button appears (with retry)
    let verifyResult = null;
    for (let i = 0; i < 5; i++) {
      await delay(1500);
      verifyResult = await getFollowButton(page, cleanUsername);
      if (verifyResult) {
        const verifyText = await verifyResult.element.textContent().catch(() => '');
        const verifyAria = await verifyResult.element.getAttribute('aria-label').catch(() => '');
        log(LOG_LEVELS.DEBUG, `Verification attempt ${i + 1}: isFollowing=${verifyResult.isFollowing}, text="${verifyText}", aria="${verifyAria}"`, actionContext);
        
        if (verifyResult.isFollowing) {
          break;
        }
      } else {
        log(LOG_LEVELS.DEBUG, `Verification attempt ${i + 1}: button not found`, actionContext);
      }
    }
    
    const duration = Date.now() - startTime;

    if (verifyResult && verifyResult.isFollowing) {
      log(LOG_LEVELS.INFO, `User ${cleanUsername} followed successfully`, { ...actionContext, duration });
      return {
        success: true,
        alreadyFollowing: false,
        message: 'User followed successfully',
        duration
      };
    }

    log(LOG_LEVELS.WARN, `User ${cleanUsername} follow action completed but verification uncertain`, { ...actionContext, duration });
    return {
      success: true,
      alreadyFollowing: false,
      message: 'Follow action completed (verification uncertain)',
      duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error following user ${username}`, {
      ...actionContext,
      error: classifiedError.message,
      recoverable: errorInfo.recoverable,
      duration: Date.now() - startTime
    });

    return {
      success: false,
      error: classifiedError.message || error.message,
      errorCode: classifiedError.code || 'UNKNOWN_ERROR',
      recoverable: errorInfo.recoverable || false
    };
  }
}

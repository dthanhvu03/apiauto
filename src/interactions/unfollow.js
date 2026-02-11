/**
 * Unfollow User Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to unfollow Threads users.
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
  SessionExpiredError,
  classifyError
} from './errors.js';
import { ensureLoggedIn } from './session.js';
import { navigateToUserProfile, getFollowButton } from './user-helpers.js';

/**
 * Unfollow a user
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to unfollow
 * @returns {Promise<Object>} Result object with success status
 */
export async function unfollowUser(page, username, accountId = null) {
  const startTime = Date.now();
  const actionContext = { action: 'unfollow', username };

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

    log(LOG_LEVELS.INFO, `Starting unfollow action for user ${cleanUsername}`, actionContext);

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

    // Find unfollow button
    const buttonResult = await retryWithBackoff(
      () => getFollowButton(page, cleanUsername),
      {
        maxRetries: config.retryAttempts,
        initialDelay: 1000,
        context: { ...actionContext, subAction: 'find-button' },
        shouldRetry: (error) => error === null
      }
    ).catch(() => null);

    if (!buttonResult || !buttonResult.isFollowing) {
      return {
        success: true,
        alreadyUnfollowed: true,
        message: 'User is not being followed',
        duration: Date.now() - startTime
      };
    }

    const { element } = buttonResult;

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
      log(LOG_LEVELS.INFO, 'Unfollow button clicked (normal click)', actionContext);
    } catch (e) {
      log(LOG_LEVELS.DEBUG, `Normal click failed: ${e.message}, trying force click...`, actionContext);
      
      // Strategy 2: Force click
      try {
        await element.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
        clickSuccess = true;
        log(LOG_LEVELS.INFO, 'Unfollow button clicked (force click)', actionContext);
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
          log(LOG_LEVELS.INFO, 'Unfollow button clicked (JavaScript click)', actionContext);
        } catch (e3) {
          log(LOG_LEVELS.WARN, `All click strategies failed: ${e3.message}`, actionContext);
        }
      }
    }

    if (!clickSuccess) {
      throw new InteractionError('Failed to click unfollow button', 'CLICK_FAILED', actionContext);
    }

    // Wait for confirmation modal to appear (if any)
    await delay(1500);
    
    // Debug: Check if modal appeared
    try {
      const hasModal = await page.evaluate(() => {
        // Check for common modal patterns
        const dialogs = document.querySelectorAll('[role="dialog"], div[class*="modal"], div[class*="Modal"]');
        return dialogs.length > 0;
      });
      log(LOG_LEVELS.DEBUG, `Modal check: hasModal=${hasModal}`, actionContext);
    } catch (e) {
      // Ignore
    }
    
    // Check if confirmation modal appeared and handle it
    const confirmSelectors = CONFIG.selectors.unfollowConfirmButton || [
      'button:has-text("Unfollow")',
      'button:has-text("Confirm")',
      'div[role="dialog"] button:has-text("Unfollow")',
      'div[role="dialog"] button:has-text("Confirm")',
      '[role="dialog"] button',
      'div[class*="modal"] button',
      'div[class*="Modal"] button'
    ];
    
    let modalHandled = false;
    
    // First, try to find modal and scan all buttons in it
    try {
      const modal = await page.$('[role="dialog"], div[class*="modal"], div[class*="Modal"]').catch(() => null);
      if (modal) {
        const isVisible = await modal.isVisible().catch(() => false);
        if (isVisible) {
          log(LOG_LEVELS.INFO, 'Found confirmation modal, scanning for confirm button', actionContext);
          
          // Get all buttons in modal
          const modalButtons = await modal.$$('button, div[role="button"], span[role="button"]').catch(() => []);
          log(LOG_LEVELS.DEBUG, `Found ${modalButtons.length} buttons in modal`, actionContext);
          
          for (const btn of modalButtons) {
            try {
              const isVisible = await btn.isVisible().catch(() => false);
              if (!isVisible) continue;
              
              const text = (await btn.textContent().catch(() => '') || '').trim();
              const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '').trim();
              const lowerText = text.toLowerCase();
              const lowerAria = ariaLabel.toLowerCase();
              
              log(LOG_LEVELS.DEBUG, `Modal button: text="${text}", aria="${ariaLabel}"`, actionContext);
              
              // Check if this is a confirm button (Unfollow, Confirm, OK, etc.)
              if (lowerText === 'unfollow' ||
                  lowerText === 'confirm' ||
                  lowerText === 'ok' ||
                  lowerText.includes('unfollow') ||
                  lowerAria.includes('unfollow') ||
                  lowerAria.includes('confirm')) {
                log(LOG_LEVELS.INFO, `Found confirm button in modal: text="${text}", aria="${ariaLabel}"`, actionContext);
                
                // Try to click confirm button
                try {
                  await btn.click({ timeout: CONFIG.browser.timeouts.normalOperation });
                  modalHandled = true;
                  log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (normal click)', actionContext);
                  break;
                } catch (e) {
                  // Try force click
                  try {
                    await btn.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
                    modalHandled = true;
                    log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (force click)', actionContext);
                    break;
                  } catch (e2) {
                    // Try JavaScript click
                    try {
                      await page.evaluate((el) => {
                        if (el && typeof el.click === 'function') {
                          el.click();
                        } else if (el) {
                          const event = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                          });
                          el.dispatchEvent(event);
                        }
                      }, await btn.evaluateHandle((el) => el));
                      modalHandled = true;
                      log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (JavaScript click)', actionContext);
                      break;
                    } catch (e3) {
                      log(LOG_LEVELS.DEBUG, `Failed to click confirm button: ${e3.message}`, actionContext);
                    }
                  }
                }
              }
            } catch (e) {
              // Continue
            }
          }
        }
      }
    } catch (e) {
      log(LOG_LEVELS.DEBUG, `Error scanning modal: ${e.message}`, actionContext);
    }
    
    // Fallback: Try selectors if modal scanning didn't work
    if (!modalHandled) {
      log(LOG_LEVELS.DEBUG, 'Modal scanning failed, trying selectors', actionContext);
      for (const selector of confirmSelectors) {
        try {
          const confirmButton = await page.waitForSelector(selector, {
            timeout: CONFIG.browser.timeouts.quickCheck,
            state: 'visible'
          }).catch(() => null);
          
          if (confirmButton) {
            const isVisible = await confirmButton.isVisible().catch(() => false);
            if (isVisible) {
              const confirmText = await confirmButton.textContent().catch(() => '');
              log(LOG_LEVELS.INFO, `Found confirmation button with selector: "${selector}", text: "${confirmText}"`, actionContext);
              
              // Try to click confirm button
              try {
                await confirmButton.click({ timeout: CONFIG.browser.timeouts.normalOperation });
                modalHandled = true;
                log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (normal click)', actionContext);
                break;
              } catch (e) {
                // Try force click
                try {
                  await confirmButton.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
                  modalHandled = true;
                  log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (force click)', actionContext);
                  break;
                } catch (e2) {
                  // Try JavaScript click
                  try {
                    await page.evaluate((el) => {
                      if (el && typeof el.click === 'function') {
                        el.click();
                      } else if (el) {
                        const event = new MouseEvent('click', {
                          bubbles: true,
                          cancelable: true,
                          view: window
                        });
                        el.dispatchEvent(event);
                      }
                    }, await confirmButton.evaluateHandle((el) => el));
                    modalHandled = true;
                    log(LOG_LEVELS.INFO, 'Confirmation modal confirmed (JavaScript click)', actionContext);
                    break;
                  } catch (e3) {
                    log(LOG_LEVELS.DEBUG, `Failed to click confirm button: ${e3.message}`, actionContext);
                  }
                }
              }
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    }
    
    if (modalHandled) {
      // Wait for modal to close
      await delay(1500);
      log(LOG_LEVELS.INFO, 'Confirmation modal handled, waiting for page update', actionContext);
    } else {
      log(LOG_LEVELS.DEBUG, 'No confirmation modal found or could not click confirm button', actionContext);
    }

    // Wait longer for page to update after click (and modal confirmation)
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

    // Verify by checking if follow button appears (with retry)
    let verifyResult = null;
    for (let i = 0; i < 5; i++) {
      await delay(1500);
      verifyResult = await getFollowButton(page, cleanUsername);
      if (verifyResult) {
        const verifyText = await verifyResult.element.textContent().catch(() => '');
        const verifyAria = await verifyResult.element.getAttribute('aria-label').catch(() => '');
        log(LOG_LEVELS.DEBUG, `Verification attempt ${i + 1}: isFollowing=${verifyResult.isFollowing}, text="${verifyText}", aria="${verifyAria}"`, actionContext);
        
        if (!verifyResult.isFollowing) {
          break;
        }
      } else {
        log(LOG_LEVELS.DEBUG, `Verification attempt ${i + 1}: button not found`, actionContext);
      }
    }
    
    const duration = Date.now() - startTime;

    if (verifyResult && !verifyResult.isFollowing) {
      log(LOG_LEVELS.INFO, `User ${cleanUsername} unfollowed successfully`, { ...actionContext, duration });
      return {
        success: true,
        alreadyUnfollowed: false,
        message: 'User unfollowed successfully',
        duration
      };
    }

    log(LOG_LEVELS.WARN, `User ${cleanUsername} unfollow action completed but verification uncertain`, { ...actionContext, duration });
    return {
      success: true,
      alreadyUnfollowed: false,
      message: 'Unfollow action completed (verification uncertain)',
      duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error unfollowing user ${username}`, {
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

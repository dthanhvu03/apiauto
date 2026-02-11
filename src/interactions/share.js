/**
 * Share Post Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to share Threads posts.
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

/**
 * Share a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {string} platform - Platform to share to (optional, defaults to copy link)
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function sharePost(page, postId, platform = 'copy', options = {}) {
  const startTime = Date.now();
  const actionContext = { action: 'share', postId, platform, ...options };

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
    const config = CONFIG.interactions.share;

    log(LOG_LEVELS.INFO, `Starting share action for post ${postId}`, actionContext);

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

    // Find share button
    const shareButton = await waitForElement(page, CONFIG.selectors.shareButton, {
      timeout: CONFIG.browser.timeouts.normalOperation,
      retries: config.retryAttempts
    });

    if (!shareButton) {
      throw new ElementNotFoundError('Could not find share button', 'shareButton', actionContext);
    }

    await delay(config.delayBeforeClick);
    await shareButton.element.click();
    await delay(1500); // Wait for share menu to appear

    // Handle different share platforms
    if (platform === 'copy' || !platform) {
      log(LOG_LEVELS.INFO, `Looking for "Copy link" option in share menu...`, actionContext);
      
      // Try to find "Copy link" option with multiple selectors
      const copyLinkSelectors = [
        'button:has-text("Copy link")',
        'button:has-text("Copy")',
        'div[role="button"]:has-text("Copy link")',
        'div[role="button"]:has-text("Copy")',
        'span:has-text("Copy link")',
        'button[aria-label*="Copy link" i]',
        'button[aria-label*="Copy" i]',
        'div[role="button"][aria-label*="Copy" i]'
      ];
      
      let copyLinkButton = null;
      for (const selector of copyLinkSelectors) {
        try {
          const btn = await page.waitForSelector(selector, {
            timeout: CONFIG.browser.timeouts.quickCheck,
            state: 'visible'
          }).catch(() => null);
          
          if (btn) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (isVisible) {
              const text = await btn.textContent().catch(() => '');
              log(LOG_LEVELS.INFO, `Found copy link button with selector: ${selector}, text: "${text}"`, actionContext);
              copyLinkButton = btn;
              break;
            }
          }
        } catch (e) {
          // Continue
        }
      }
      
      // If not found with selectors, try scanning all elements in modal
      if (!copyLinkButton) {
        log(LOG_LEVELS.DEBUG, `Copy link button not found with selectors, scanning modal...`, actionContext);
        try {
          const modalElements = await page.evaluate(() => {
            const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[role="menu"], [data-testid*="menu"]'));
            const allElements = [];
            
            dialogs.forEach(dialog => {
              const buttons = Array.from(dialog.querySelectorAll('button, div[role="button"], span[role="button"]'));
              buttons.forEach(btn => {
                const text = btn.textContent?.trim() || '';
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const isVisible = btn.offsetParent !== null;
                
                if (isVisible && (text.toLowerCase().includes('copy') || ariaLabel.toLowerCase().includes('copy'))) {
                  allElements.push({
                    tag: btn.tagName,
                    text: text,
                    ariaLabel: ariaLabel
                  });
                }
              });
            });
            
            return allElements;
          }).catch(() => []);
          
          log(LOG_LEVELS.DEBUG, `Found ${modalElements.length} copy-related elements in modal:`, { 
            ...actionContext, 
            elements: modalElements 
          });
          
          // Try to click the first copy-related element
          if (modalElements.length > 0) {
            const copySelectors = [
              `button:has-text("${modalElements[0].text}")`,
              `div[role="button"]:has-text("${modalElements[0].text}")`,
              `span:has-text("${modalElements[0].text}")`
            ];
            
            for (const selector of copySelectors) {
              try {
                const btn = await page.$(selector).catch(() => null);
                if (btn) {
                  const isVisible = await btn.isVisible().catch(() => false);
                  if (isVisible) {
                    copyLinkButton = btn;
                    log(LOG_LEVELS.INFO, `Found copy button via scanning: "${modalElements[0].text}"`, actionContext);
                    break;
                  }
                }
              } catch (e) {
                // Continue
              }
            }
          }
        } catch (e) {
          log(LOG_LEVELS.DEBUG, `Modal scanning failed: ${e.message}`, actionContext);
        }
      }

      if (copyLinkButton) {
        log(LOG_LEVELS.INFO, `Clicking copy link button...`, actionContext);
        try {
          await copyLinkButton.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
          await delay(1000);
          
          // Verify clipboard was updated (if possible)
          try {
            const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
            if (clipboardText && clipboardText.includes('threads.net')) {
              log(LOG_LEVELS.INFO, `Clipboard verified: link copied`, actionContext);
            }
          } catch (e) {
            // Clipboard access might not be available, that's OK
            log(LOG_LEVELS.DEBUG, `Could not verify clipboard: ${e.message}`, actionContext);
          }
          
          await delay(config.delayAfterClick);
          
          log(LOG_LEVELS.INFO, `Post ${postId} link copied successfully`, { ...actionContext, duration: Date.now() - startTime });
          return {
            success: true,
            message: 'Post link copied successfully',
            platform: 'copy',
            duration: Date.now() - startTime
          };
        } catch (e) {
          log(LOG_LEVELS.WARN, `Failed to click copy button: ${e.message}, trying JavaScript click...`, actionContext);
          // Try JavaScript click
          try {
            await copyLinkButton.evaluate(btn => {
              btn.click();
              // Also try dispatch events
              const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
              btn.dispatchEvent(clickEvent);
            });
            await delay(config.delayAfterClick);
            
            log(LOG_LEVELS.INFO, `Post ${postId} link copied via JavaScript`, { ...actionContext, duration: Date.now() - startTime });
            return {
              success: true,
              message: 'Post link copied successfully (via JavaScript)',
              platform: 'copy',
              duration: Date.now() - startTime
            };
          } catch (e2) {
            log(LOG_LEVELS.WARN, `JavaScript click also failed: ${e2.message}`, actionContext);
          }
        }
      } else {
        log(LOG_LEVELS.WARN, `Could not find "Copy link" button in share menu`, actionContext);
      }
    }

    // For other platforms or if copy button not found, just report menu opened
    await delay(config.delayAfterClick);
    
    log(LOG_LEVELS.INFO, `Post ${postId} share menu opened`, { ...actionContext, duration: Date.now() - startTime });
    return {
      success: true,
      message: platform === 'copy' ? 'Share menu opened (copy link button not found)' : 'Share menu opened',
      platform: platform || 'menu',
      duration: Date.now() - startTime
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error sharing post ${postId}`, {
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

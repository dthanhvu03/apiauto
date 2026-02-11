/**
 * User Interaction Helpers
 * 
 * Helper functions for finding and interacting with user profile elements
 */

import { CONFIG } from '../config.js';
import { delay, log, LOG_LEVELS } from './utils.js';

/**
 * Navigate to user profile
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to navigate to
 * @returns {Promise<boolean>} Success status
 */
export async function navigateToUserProfile(page, username) {
  try {
    const cleanUsername = username.replace(/^@/, '');
    const profileUrl = `${CONFIG.threads.url}/@${cleanUsername}`;
    
    log(LOG_LEVELS.INFO, `Navigating to user profile: ${profileUrl}`, { username: cleanUsername });
    await page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.browser.navigationTimeout
    });

    await delay(CONFIG.browser.waitAfterNavigation);
    return true;
  } catch (error) {
    log(LOG_LEVELS.ERROR, `Error navigating to user profile`, { username, error: error.message });
    return false;
  }
}

/**
 * Close any open modals (Followers/Following modal)
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} Success status
 */
export async function closeModals(page) {
  try {
    // Try to find and close modal by clicking outside or close button
    const closeSelectors = [
      'button[aria-label*="Close"]',
      'button[aria-label*="close"]',
      '[data-testid*="close"]',
      'button:has-text("Close")',
      // Click outside modal (backdrop)
      '[role="dialog"] + div',
      'div[style*="backdrop"]'
    ];
    
    for (const selector of closeSelectors) {
      try {
        const closeBtn = await page.$(selector);
        if (closeBtn) {
          const isVisible = await closeBtn.isVisible().catch(() => false);
          if (isVisible) {
            await closeBtn.click();
            await delay(500);
            log(LOG_LEVELS.DEBUG, 'Closed modal');
            return true;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Try pressing Escape key
    try {
      await page.keyboard.press('Escape');
      await delay(500);
      log(LOG_LEVELS.DEBUG, 'Pressed Escape to close modal');
    } catch (e) {
      // Ignore
    }
  } catch (e) {
    // Ignore modal closing errors
  }
  
  return false;
}

/**
 * Check if element is inside a modal or list
 * @param {ElementHandle} element - Element to check
 * @returns {Promise<boolean>} True if element is in modal or list
 */
export async function isInModalOrList(element) {
  try {
    const isInModal = await element.evaluate((el) => {
      let current = el;
      for (let i = 0; i < 10; i++) {
        if (!current) break;
        const role = current.getAttribute('role');
        const className = current.className || '';
        const id = current.id || '';
        
        // Check if inside modal
        if (role === 'dialog' || 
            className.includes('modal') || 
            className.includes('Modal') ||
            id.includes('modal') ||
            id.includes('Modal')) {
          return true;
        }
        
        // Check if inside list (Followers/Following list)
        if (role === 'list' || 
            role === 'listbox' ||
            className.includes('list') ||
            className.includes('List')) {
          return true;
        }
        
        current = current.parentElement;
      }
      return false;
    });
    
    return isInModal;
  } catch (e) {
    return false;
  }
}

/**
 * Find profile header section (contains username and follow button)
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to find header for
 * @returns {Promise<ElementHandle|null>} Profile header element or null
 */
export async function findProfileHeader(page, username) {
  try {
    // Try to find profile header by looking for username link
    const usernameSelectors = [
      `a[href="/@${username}"]`,
      `a[href*="/@${username}"]`,
      `a[href*="@${username}"]`,
      `a:has-text("@${username}")`,
      `a:has-text("${username}")`
    ];
    
    for (const selector of usernameSelectors) {
      try {
        const usernameLink = await page.$(selector).catch(() => null);
        if (usernameLink) {
          const isVisible = await usernameLink.isVisible().catch(() => false);
          if (isVisible) {
            // Find parent container that likely contains the follow button
            const header = await usernameLink.evaluateHandle((el) => {
              // Go up the DOM tree to find profile header container
              let current = el;
              for (let i = 0; i < 5; i++) {
                if (!current) break;
                const parent = current.parentElement;
                if (!parent) break;
                
                // Look for common profile header patterns
                const className = parent.className || '';
                const tagName = parent.tagName || '';
                
                // Profile header usually contains username and action buttons
                if (tagName === 'HEADER' || 
                    className.includes('header') ||
                    className.includes('Header') ||
                    className.includes('profile') ||
                    className.includes('Profile')) {
                  return parent;
                }
                
                // Check if this container has multiple buttons (likely header)
                const buttons = parent.querySelectorAll('button');
                if (buttons.length >= 1) {
                  return parent;
                }
                
                current = parent;
              }
              return current;
            });
            
            if (header) {
              log(LOG_LEVELS.DEBUG, `Found profile header section`, { username });
              return header;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
  } catch (e) {
    log(LOG_LEVELS.DEBUG, `Error finding profile header: ${e.message}`, { username });
  }
  
  return null;
}

/**
 * Check if button is in profile header area (near username)
 * @param {ElementHandle} button - Button element to check
 * @param {ElementHandle} headerSection - Profile header section
 * @returns {Promise<boolean>} True if button is in header
 */
export async function isInProfileHeader(button, headerSection) {
  if (!headerSection) return false;
  
  try {
    const isInHeader = await button.evaluate((btn, header) => {
      if (!header || !btn) return false;
      
      // Check if button is descendant of header
      let current = btn;
      for (let i = 0; i < 10; i++) {
        if (!current) break;
        if (current === header) return true;
        current = current.parentElement;
      }
      return false;
    }, await headerSection.evaluateHandle((el) => el));
    
    return isInHeader;
  } catch (e) {
    return false;
  }
}

/**
 * Find follow button for a user (main button, not in modal/list)
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to find button for
 * @returns {Promise<Object|null>} Object with element and isFollowing, or null
 */
export async function getFollowButton(page, username) {
  const followSelectors = CONFIG.selectors.followButton;
  const unfollowSelectors = CONFIG.selectors.unfollowButton;

  // Wait a bit for page to fully load
  await delay(1500);
  
  // Close any open modals first
  await closeModals(page);
  await delay(500);
  
  // Find profile header section first
  const profileHeader = await findProfileHeader(page, username);
  if (profileHeader) {
    log(LOG_LEVELS.DEBUG, `Profile header found, searching within header section`, { username });
  }

  // First check if already following (unfollow button exists)
  for (const selector of unfollowSelectors) {
    try {
      const elements = await page.$$(selector).catch(() => []);
      
      for (const element of elements) {
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        // Skip if in modal or list
        const inModal = await isInModalOrList(element);
        if (inModal) {
          log(LOG_LEVELS.DEBUG, `Skipping unfollow button in modal/list`);
          continue;
        }
        
        // If we have header, verify button is in header (prioritize header buttons)
        if (profileHeader) {
          const inHeader = await isInProfileHeader(element, profileHeader);
          if (!inHeader) {
            log(LOG_LEVELS.DEBUG, `Skipping unfollow button outside profile header`);
            continue;
          }
        }
        
        const text = await element.textContent().catch(() => '');
        log(LOG_LEVELS.INFO, `User ${username} is already being followed (selector: ${selector}, text: "${text}")`);
        return { element, isFollowing: true };
      }
    } catch (e) {
      // Continue
    }
  }

  // Try to find follow button with configured selectors
  for (const selector of followSelectors) {
    try {
      const elements = await page.$$(selector).catch(() => []);
      
      for (const element of elements) {
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        // Skip if in modal or list
        const inModal = await isInModalOrList(element);
        if (inModal) {
          log(LOG_LEVELS.DEBUG, `Skipping follow button in modal/list`);
          continue;
        }
        
        // If we have header, verify button is in header (prioritize header buttons)
        if (profileHeader) {
          const inHeader = await isInProfileHeader(element, profileHeader);
          if (!inHeader) {
            log(LOG_LEVELS.DEBUG, `Skipping follow button outside profile header`);
            continue;
          }
        }
        
        const text = await element.textContent().catch(() => '');
        log(LOG_LEVELS.INFO, `Found follow button with selector: ${selector}, text: "${text}"`, { username });
        return { element, isFollowing: false };
      }
    } catch (e) {
      // Continue
    }
  }

  // If not found, try scanning buttons (prioritize profile header if found)
  log(LOG_LEVELS.DEBUG, `Follow button not found with selectors, scanning buttons...`, { username });
  try {
    // Get all buttons from page
    const allButtons = await page.$$('button, div[role="button"], span[role="button"]').catch(() => []);
    log(LOG_LEVELS.DEBUG, `Found ${allButtons.length} buttons on page`, { username });
    
    // Sort buttons by relevance (buttons in header first, then by proximity to username)
    const buttonCandidates = [];
    
    for (const btn of allButtons) {
      try {
        const isVisible = await btn.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        // Skip if in modal or list
        const inModal = await isInModalOrList(btn);
        if (inModal) {
          continue;
        }
        
        // If we have header, prioritize buttons in header
        let inHeader = false;
        if (profileHeader) {
          inHeader = await isInProfileHeader(btn, profileHeader);
          if (!inHeader) {
            // Skip buttons outside header if we have header
            continue;
          }
        }
        
        const text = (await btn.textContent().catch(() => '') || '').trim();
        const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '').trim();
        
        const lowerText = text.toLowerCase();
        const lowerAria = ariaLabel.toLowerCase();
        
        // Calculate relevance score (higher = better)
        let relevance = 0;
        if (inHeader) relevance += 100;
        if (lowerText === 'follow' || lowerText === 'following') relevance += 50;
        if (lowerAria === 'follow' || lowerAria.includes('follow')) relevance += 30;
        
        // Check for unfollow button first (more patterns)
        if ((lowerText.includes('following') && !lowerText.includes('follow') && !lowerText.includes('unfollow')) ||
            lowerText === 'unfollow' ||
            lowerText.startsWith('following')) {
          log(LOG_LEVELS.DEBUG, `Found unfollow button candidate: text="${text}", relevance=${relevance}`, { username });
          buttonCandidates.push({ element: btn, isFollowing: true, relevance });
          continue;
        }
        
        // Check for follow button
        if (lowerText === 'follow' || 
            (lowerText.includes('follow') && !lowerText.includes('following') && !lowerText.includes('unfollow'))) {
          log(LOG_LEVELS.DEBUG, `Found follow button candidate: text="${text}", relevance=${relevance}`, { username });
          buttonCandidates.push({ element: btn, isFollowing: false, relevance });
          continue;
        }
        
        // Also check aria-label for unfollow
        if ((lowerAria.includes('following') && !lowerAria.includes('follow') && !lowerAria.includes('unfollow')) ||
            lowerAria === 'unfollow' ||
            lowerAria.startsWith('following')) {
          log(LOG_LEVELS.DEBUG, `Found unfollow button candidate via aria-label: text="${text}", relevance=${relevance}`, { username });
          buttonCandidates.push({ element: btn, isFollowing: true, relevance });
          continue;
        }
        
        // Also check aria-label for follow
        if (lowerAria === 'follow' || 
            (lowerAria.includes('follow') && !lowerAria.includes('following') && !lowerAria.includes('unfollow'))) {
          log(LOG_LEVELS.DEBUG, `Found follow button candidate via aria-label: text="${text}", relevance=${relevance}`, { username });
          buttonCandidates.push({ element: btn, isFollowing: false, relevance });
          continue;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Sort by relevance and return the best match
    if (buttonCandidates.length > 0) {
      buttonCandidates.sort((a, b) => b.relevance - a.relevance);
      const bestMatch = buttonCandidates[0];
      log(LOG_LEVELS.DEBUG, `Selected best button match with relevance ${bestMatch.relevance}`, { username });
      return { element: bestMatch.element, isFollowing: bestMatch.isFollowing };
    }
    
    // Log sample buttons for debugging
    const sampleButtons = await Promise.all(
      allButtons.slice(0, 10).map(async (btn) => {
        try {
          const isVisible = await btn.isVisible().catch(() => false);
          if (!isVisible) return null;
          const text = await btn.textContent().catch(() => '');
          const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
          return { text: text?.trim(), ariaLabel: ariaLabel?.trim() };
        } catch {
          return null;
        }
      })
    ).catch(() => []);
    
    log(LOG_LEVELS.DEBUG, `Sample buttons on page:`, { username, buttons: sampleButtons.filter(Boolean) });
  } catch (e) {
    log(LOG_LEVELS.DEBUG, `Button scanning failed: ${e.message}`, { username });
  }

  return null;
}

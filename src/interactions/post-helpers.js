/**
 * Post Interaction Helpers
 * 
 * Helper functions for finding and interacting with post elements
 */

import { CONFIG } from '../config.js';
import { delay, waitForElement } from './utils.js';
import { encodePostId } from '../utils/shortcode-encoder.js';

/**
 * Find like button for a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID (optional, for logging)
 * @returns {Promise<ElementHandle|null>} Like button element or null
 */
export async function getPostLikeButton(page, postId = null) {
  const selectors = CONFIG.selectors.likeButton;
  const unlikeSelectors = CONFIG.selectors.unlikeButton;

  // First check if already liked (unlike button exists)
  for (const selector of unlikeSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`[INTERACT] Post ${postId || 'unknown'} is already liked`);
          return { element, isLiked: true };
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  // Try to find like button
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          return { element, isLiked: false };
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  return null;
}

/**
 * Find comment input for a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID (optional, for logging)
 * @returns {Promise<ElementHandle|null>} Comment input element or null
 */
export async function getPostCommentInput(page, postId = null) {
  console.log('[COMMENT] Looking for comment input...');
  
  // First, try to click comment/reply button to open input
  const commentButtonSelectors = CONFIG.selectors.commentButton;
  let commentButtonClicked = false;
  
  console.log('[COMMENT] Trying to click comment/reply button...');
  for (const selector of commentButtonSelectors) {
    try {
      const button = await page.waitForSelector(selector, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        state: 'visible'
      }).catch(() => null);
      
      if (button) {
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await button.click();
          console.log(`[COMMENT] Clicked comment button with selector: ${selector}`);
          await delay(2000); // Wait for input to appear
          commentButtonClicked = true;
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  // If button not found, try generic selectors
  if (!commentButtonClicked) {
    const genericButtonSelectors = [
      'button[aria-label*="Reply" i]',
      'button[aria-label*="Comment" i]',
      'button:has-text("Reply")',
      'button:has-text("Comment")',
      'svg[aria-label*="Reply" i]',
      'a[aria-label*="Reply" i]'
    ];
    
    for (const selector of genericButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            await button.click();
            console.log(`[COMMENT] Clicked comment button with generic selector: ${selector}`);
            await delay(2000);
            commentButtonClicked = true;
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Wait a bit more for input to appear
  await delay(1000);

  // Now try to find the input with wait
  const selectors = CONFIG.selectors.commentInput;
  console.log('[COMMENT] Looking for comment input field...');
  
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        state: 'visible'
      }).catch(() => null);
      
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`[COMMENT] Found comment input with selector: ${selector}`);
          return element;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  // Try generic selectors
  console.log('[COMMENT] Trying generic input selectors...');
  const genericSelectors = [
    'textarea[placeholder*="Reply" i]',
    'textarea[placeholder*="Add a comment" i]',
    'textarea[placeholder*="Write a comment" i]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea',
    'input[type="text"]'
  ];
  
  for (const selector of genericSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          const placeholder = await element.getAttribute('placeholder').catch(() => '');
          const role = await element.getAttribute('role').catch(() => '');
          const contentEditable = await element.getAttribute('contenteditable').catch(() => '');
          
          // Check if it's likely a comment input
          if (placeholder.toLowerCase().includes('reply') ||
              placeholder.toLowerCase().includes('comment') ||
              role === 'textbox' ||
              contentEditable === 'true') {
            console.log(`[COMMENT] Found comment input with generic selector: ${selector}`);
            return element;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  console.log('[COMMENT] Could not find comment input');
  return null;
}

/**
 * Find comment submit button with optimized scanning
 * @param {Page} page - Playwright page object
 * @param {ElementHandle} inputElement - Comment input element (optional, for context)
 * @returns {Promise<ElementHandle|null>} Submit button element or null
 */
export async function getCommentSubmitButton(page, inputElement = null) {
  console.log('[COMMENT] Looking for submit button...');
  
  // Wait for button to appear after typing
  await delay(1000);
  
  // Scroll input into view if provided
  if (inputElement) {
    try {
      await inputElement.scrollIntoViewIfNeeded();
      await delay(300);
    } catch (e) {
      // Continue
    }
  }
  
  // OPTIMIZED: Scan all buttons at once instead of trying selectors one by one
  console.log('[COMMENT] Scanning all buttons/elements on page...');
  
  try {
    // Get input position for proximity scoring (if available)
    let inputBox = null;
    if (inputElement) {
      try {
        inputBox = await inputElement.boundingBox();
      } catch (e) {
        // Continue
      }
    }
    
    // Get all potential button elements in one query
    const allElements = await page.$$eval(
      'button, div[role="button"], span[role="button"], a[role="button"]',
      (elements, inputPos) => {
        const results = [];
        for (const el of elements) {
          // Quick visibility check
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && 
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).display !== 'none';
          
          if (!isVisible) continue;
          
          // Get all attributes in one pass
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const buttonType = el.getAttribute('type') || '';
          const role = el.getAttribute('role') || '';
          const dataTestId = el.getAttribute('data-testid') || '';
          const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          const tagName = el.tagName.toLowerCase();
          
          // Calculate distance from input if provided
          let distance = Infinity;
          if (inputPos) {
            const elRect = el.getBoundingClientRect();
            const elCenterY = elRect.top + elRect.height / 2;
            distance = Math.abs(elCenterY - inputPos.y);
          }
          
          // Quick filtering: skip obvious non-submit buttons
          const lowerText = (text + ' ' + ariaLabel + ' ' + dataTestId).toLowerCase();
          if (lowerText.includes('cancel') ||
              lowerText.includes('close') ||
              lowerText.includes('back') ||
              lowerText.includes('delete') ||
              lowerText.includes('edit') ||
              lowerText.includes('repost') && !lowerText.includes('post') && text.toLowerCase() !== 'post') {
            continue;
          }
          
          // Calculate score
          let score = 0;
          
          // Exact text matches (highest priority)
          if (text.toLowerCase() === 'post') score += 200;
          if (text.toLowerCase() === 'reply') score += 180;
          
          // Aria-label matches
          if (ariaLabel.toLowerCase().includes('post')) score += 150;
          if (ariaLabel.toLowerCase().includes('reply')) score += 130;
          
          // Partial text matches
          if (lowerText.includes('post') && !lowerText.includes('repost')) score += 100;
          if (lowerText.includes('reply')) score += 80;
          if (lowerText.includes('send')) score += 60;
          
          // Type and role
          if (buttonType === 'submit') score += 120;
          if (role === 'button' && (lowerText.includes('post') || lowerText.includes('reply'))) score += 40;
          
          // Data attributes
          if (dataTestId.includes('submit')) score += 100;
          if (dataTestId.includes('post')) score += 80;
          
          // Proximity bonus (button near input)
          if (inputPos && distance < 200) {
            score += 50;
          } else if (inputPos && distance < 500) {
            score += 20;
          }
          
          // Tag type bonus
          if (tagName === 'button') score += 10;
          
          // Disabled penalty
          if (disabled) score = 0;
          
          if (score > 0) {
            results.push({
              index: Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"], a[role="button"]')).indexOf(el),
              score,
              text,
              distance
            });
          }
        }
        
        // Sort by score (descending)
        results.sort((a, b) => b.score - a.score);
        return results;
      },
      inputBox ? { x: inputBox.x, y: inputBox.y + inputBox.height / 2 } : null
    ).catch(() => []);
    
    console.log(`[COMMENT] Scanned and scored ${allElements.length} potential buttons`);
    
    // Get the top candidates
    if (allElements.length > 0) {
      const topCandidates = allElements.slice(0, 3); // Top 3 candidates
      console.log(`[COMMENT] Top candidates:`, topCandidates.map(c => `"${c.text}" (score: ${c.score})`).join(', '));
      
      // Try to get the best button element
      const allButtonElements = await page.$$('button, div[role="button"], span[role="button"], a[role="button"]');
      
      for (const candidate of topCandidates) {
        if (candidate.score < 50) break; // Minimum score threshold
        
        try {
          const button = allButtonElements[candidate.index];
          if (!button) continue;
          
          // Verify it's still visible and enabled
          const isVisible = await button.isVisible().catch(() => false);
          if (!isVisible) continue;
          
          const isEnabled = await button.isEnabled().catch(() => true);
          if (!isEnabled) continue;
          
          // Double-check it's the right button
          const currentText = await button.textContent().catch(() => '');
          if (currentText.trim().toLowerCase() === candidate.text.toLowerCase() ||
              currentText.trim().toLowerCase().includes('post') ||
              (currentText.trim().toLowerCase().includes('reply') && !currentText.toLowerCase().includes('cancel'))) {
            
            console.log(`[COMMENT] Found submit button: "${currentText.trim()}" (score: ${candidate.score})`);
            await button.scrollIntoViewIfNeeded().catch(() => {});
            await delay(200);
            return button;
          }
        } catch (e) {
          // Continue to next candidate
        }
      }
    }
    
    // Fallback: Try quick selector check for common patterns
    console.log('[COMMENT] Trying quick selector fallback...');
    const quickSelectors = [
      'button:has-text("Post"):not(:has-text("Repost"))',
      'div[role="button"]:has-text("Post"):not(:has-text("Repost"))',
      'button[type="submit"]',
      'button:has-text("Reply"):not(:has-text("Cancel"))'
    ];
    
    for (const selector of quickSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            const text = await element.textContent().catch(() => '');
            console.log(`[COMMENT] Found submit button with quick selector: "${text.trim()}"`);
            await element.scrollIntoViewIfNeeded().catch(() => {});
            return element;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
  } catch (e) {
    console.log('[COMMENT] Error during optimized scan:', e.message);
  }

  console.log('[COMMENT] Could not find submit button');
  return null;
}

/**
 * Navigate to post URL
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {string} username - Username (optional, for constructing URL)
 * @param {string} shortcode - Shortcode (optional, for constructing URL)
 * @returns {Promise<boolean>} Success status
 */
/**
 * Extract username and text from post page
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Object with username and text
 */
export async function extractPostInfoFromPage(page) {
  try {
    if (!page) {
      console.warn('[EXTRACT] Page object is null or undefined');
      return { username: null, text: null };
    }
    
    const info = await page.evaluate(() => {
      // Extract username from various possible locations
      let username = null;
      
      // Try to find username in links
      const usernameLinks = Array.from(document.querySelectorAll('a[href*="/@"]'));
      for (const link of usernameLinks) {
        const href = link.getAttribute('href');
        if (href) {
          const match = href.match(/@([^/]+)/);
          if (match && match[1]) {
            username = match[1];
            break; // Use first match
          }
        }
      }
      
      // If not found, try to extract from page URL
      if (!username) {
        const urlMatch = window.location.pathname.match(/@([^/]+)/);
        if (urlMatch && urlMatch[1]) {
          username = urlMatch[1];
        }
      }
      
      // Extract post text content
      let text = null;
      
      // Try multiple selectors for post text
      const textSelectors = [
        'article span[dir="auto"]',
        'article div[dir="auto"]',
        '[data-testid*="post"] span[dir="auto"]',
        '[data-testid*="text"]',
        'article p',
        'article div[role="article"] span'
      ];
      
      for (const selector of textSelectors) {
        const textEl = document.querySelector(selector);
        if (textEl && textEl.textContent && textEl.textContent.trim().length > 0) {
          // Check if this is likely the main post text (not a comment or metadata)
          const textContent = textEl.textContent.trim();
          if (textContent.length > 10 && !textContent.match(/^\d+$/)) {
            text = textContent;
            break;
          }
        }
      }
      
      // If still not found, try to get all text from article
      if (!text) {
        const article = document.querySelector('article');
        if (article) {
          // Get text but exclude buttons, links, and metadata
          const allText = Array.from(article.querySelectorAll('span, div, p'))
            .filter(el => {
              const tag = el.tagName.toLowerCase();
              const role = el.getAttribute('role');
              const isButton = tag === 'button' || role === 'button' || el.closest('button');
              const isLink = tag === 'a' || el.closest('a');
              const isMetadata = el.textContent.match(/^\d+[\s,]*$/); // Just numbers
              return !isButton && !isLink && !isMetadata && el.textContent.trim().length > 10;
            })
            .map(el => el.textContent.trim())
            .filter(t => t.length > 10)
            .join(' ');
          
          if (allText) {
            text = allText.substring(0, 500); // Limit length
          }
        }
      }
      
      return { username, text };
    }).catch((evalError) => {
      console.warn(`[EXTRACT] Page evaluation error: ${evalError.message}`);
      return { username: null, text: null };
    });
    
    return info || { username: null, text: null };
  } catch (error) {
    console.error(`[INTERACT] Error extracting post info: ${error.message}`);
    if (error.stack) {
      console.error(`[INTERACT] Stack trace:`, error.stack);
    }
    return { username: null, text: null };
  }
}

export async function navigateToPost(page, postId, username = null, shortcode = null) {
  try {
    let postUrl;
    
    if (shortcode && username) {
      postUrl = `${CONFIG.threads.url}/@${username}/post/${shortcode}`;
    } else if (shortcode) {
      postUrl = `${CONFIG.threads.url}/post/${shortcode}`;
    } else if (postId) {
      // Try to generate shortcode from post_id
      try {
        const generatedShortcode = encodePostId(postId);
        postUrl = `${CONFIG.threads.url}/post/${generatedShortcode}`;
      } catch (e) {
        console.warn(`[INTERACT] Could not generate shortcode for post ${postId}, trying direct navigation`);
        postUrl = `${CONFIG.threads.url}/post/${postId}`;
      }
    } else {
      throw new Error('Post ID, shortcode, or username required');
    }

    console.log(`[INTERACT] Navigating to post: ${postUrl}`);
    await page.goto(postUrl, {
      waitUntil: 'networkidle',
      timeout: CONFIG.browser.navigationTimeout
    });

    // Wait for page to load
    await delay(CONFIG.browser.waitAfterNavigation);

    return true;
  } catch (error) {
    console.error(`[INTERACT] Error navigating to post: ${error.message}`);
    return false;
  }
}

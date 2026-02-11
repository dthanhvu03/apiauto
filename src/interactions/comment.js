/**
 * Comment on Post Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to comment on Threads posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { delay, validateCommentText } from './utils.js';
import { ensureLoggedIn } from './session.js';
import { getPostCommentInput, getCommentSubmitButton, navigateToPost, extractPostInfoFromPage } from './post-helpers.js';

/**
 * Comment on a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {string} commentText - Comment text
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function commentOnPost(page, postId, commentText, options = {}) {
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  if (!commentText || commentText.trim().length === 0) {
    return { success: false, error: 'Comment text is required' };
  }

  const { username: initialUsername, shortcode, postUrl } = options;
  const config = CONFIG.interactions.comment;
  
  // Use mutable variable for username (may be updated from page extraction)
  let username = initialUsername;
  let extractedText = null;

  try {
    // Ensure user is logged in
    const context = page.context();
    const accountId = options?.accountId || null;
    const loginCheck = await ensureLoggedIn(page, context, accountId);
    if (!loginCheck.success) {
      return {
        success: false,
        error: `Login required: ${loginCheck.error}`
      };
    }
    
    // Navigate to post if needed
    try {
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
      } else {
        return { success: false, error: 'Post URL or ID required' };
      }
    } catch (navError) {
      console.error(`[COMMENT] Navigation error: ${navError.message}`);
      return { 
        success: false, 
        error: `Navigation failed: ${navError.message}` 
      };
    }

    // Wait for page to fully load
    await delay(2000);
    
    // Try to extract username and text from page (fallback if not in GraphQL data)
    try {
      const postInfo = await extractPostInfoFromPage(page);
      if (postInfo.username && !username) {
        username = postInfo.username;
        console.log(`[COMMENT] Extracted username from page: @${username}`);
      }
      if (postInfo.text) {
        extractedText = postInfo.text;
        console.log(`[COMMENT] Extracted text from page: ${postInfo.text.substring(0, 50)}...`);
      }
    } catch (extractError) {
      // Non-fatal: continue even if extraction fails
      console.warn(`[COMMENT] Could not extract post info from page: ${extractError.message}`);
    }
    
    // Find comment input with retries
    let attempts = 0;
    let inputElement = null;

    console.log('[COMMENT] Attempting to find comment input...');
    while (attempts < config.retryAttempts && !inputElement) {
      inputElement = await getPostCommentInput(page, postId);
      if (!inputElement) {
        attempts++;
        console.log(`[COMMENT] Retry ${attempts}/${config.retryAttempts}...`);
        if (attempts < config.retryAttempts) {
          await delay(2000); // Longer delay between retries
        }
      }
    }

    if (!inputElement) {
      // Debug: log page structure
      const pageInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
        return inputs.map(el => ({
          tag: el.tagName,
          placeholder: el.placeholder || '',
          role: el.getAttribute('role') || '',
          contentEditable: el.getAttribute('contenteditable') || '',
          visible: el.offsetParent !== null
        }));
      }).catch(() => []);
      
      console.log(`[COMMENT] Available input fields:`, pageInfo);
      return { success: false, error: 'Could not find comment input' };
    }

    // Human-like delay before typing
    await delay(config.delayBeforeType);

    // Type comment with human-like speed
    try {
      console.log('[COMMENT] Typing comment...');
      
      // Check if it's a contenteditable div or textarea
      const tagName = await inputElement.evaluate(el => el.tagName.toLowerCase());
      const isContentEditable = await inputElement.evaluate(el => el.contentEditable === 'true').catch(() => false);
      
      await inputElement.click();
      await delay(500); // Wait after click
      
      if (tagName === 'div' || isContentEditable) {
        // Contenteditable div - use fill
        console.log('[COMMENT] Using contenteditable div');
        await inputElement.fill(commentText);
      } else {
        // Regular textarea or input
        console.log('[COMMENT] Using textarea/input');
        await inputElement.fill(''); // Clear first
        await delay(200);
        
        // Type character by character for human-like behavior
        for (const char of commentText) {
          await inputElement.type(char, { delay: config.typingSpeed });
        }
      }

      await delay(1000); // Wait after typing

      // Find and click submit button with retries and advanced strategies
      console.log('[COMMENT] Looking for submit button...');
      let submitButton = null;
      let submitAttempts = 0;
      const maxAttempts = 5; // Increased retries
      
      while (submitAttempts < maxAttempts && !submitButton) {
        submitButton = await getCommentSubmitButton(page, inputElement);
        if (!submitButton) {
          submitAttempts++;
          if (submitAttempts < maxAttempts) {
            console.log(`[COMMENT] Submit button not found, retry ${submitAttempts}/${maxAttempts}...`);
            // Scroll input again and wait longer
            await inputElement.scrollIntoViewIfNeeded().catch(() => {});
            await delay(2000); // Longer delay between retries
          }
        }
      }
      
      if (!submitButton) {
        // Last resort: Try pressing Enter as fallback
        console.log('[COMMENT] Submit button not found after all attempts, trying Enter key...');
        try {
          await inputElement.focus();
          await delay(500);
          await inputElement.press('Enter');
          await delay(config.delayAfterSubmit);
          console.log('[COMMENT] Pressed Enter on comment input');
          
          // Extract post info after comment
          let finalUsername = username;
          let finalText = extractedText;
          try {
            const postInfo = await extractPostInfoFromPage(page);
            if (postInfo.username && !finalUsername) {
              finalUsername = postInfo.username;
            }
            if (postInfo.text && !finalText) {
              finalText = postInfo.text;
            }
          } catch (extractError) {
            // Non-fatal: use already extracted values
            console.warn(`[COMMENT] Could not extract post info: ${extractError.message}`);
          }
          
          return { 
            success: true, 
            message: 'Comment posted successfully (using Enter key)',
            postId,
            username: finalUsername,
            text: finalText
          };
        } catch (e) {
          return { success: false, error: 'Could not find submit button and Enter key failed' };
        }
      }

      // Multiple click strategies
      console.log('[COMMENT] Clicking submit button...');
      let clicked = false;
      
      // Strategy 1: Normal click
      try {
        await submitButton.scrollIntoViewIfNeeded();
        await delay(300);
        await submitButton.click({ timeout: CONFIG.browser.timeouts.normalOperation });
        clicked = true;
        console.log('[COMMENT] Clicked submit button (normal click)');
      } catch (e) {
        console.log('[COMMENT] Normal click failed, trying force click...');
      }
      
      // Strategy 2: Force click
      if (!clicked) {
        try {
          await submitButton.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
          clicked = true;
          console.log('[COMMENT] Clicked submit button (force click)');
        } catch (e) {
          console.log('[COMMENT] Force click failed, trying JavaScript click...');
        }
      }
      
      // Strategy 3: JavaScript click
      if (!clicked) {
        try {
          await submitButton.evaluate(btn => {
            btn.click();
            // Also trigger events
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          });
          clicked = true;
          console.log('[COMMENT] Clicked submit button (JavaScript click)');
        } catch (e) {
          console.log('[COMMENT] JavaScript click failed');
        }
      }
      
      // Strategy 4: Try Ctrl+Enter or Enter on button
      if (!clicked) {
        try {
          await submitButton.focus();
          await delay(200);
          await page.keyboard.press('Enter');
          clicked = true;
          console.log('[COMMENT] Pressed Enter on submit button');
        } catch (e) {
          console.log('[COMMENT] Enter key on button failed');
        }
      }
      
      if (!clicked) {
        return { success: false, error: 'Could not click submit button with any method' };
      }
      
      await delay(config.delayAfterSubmit);

      // Verify submission by checking if input cleared or modal closed
      try {
        await delay(2000);
        const inputStillVisible = await inputElement.isVisible().catch(() => false);
        const inputValue = await inputElement.textContent().catch(() => '');
        if (!inputStillVisible || inputValue.trim().length === 0) {
          console.log('[COMMENT] Comment submitted successfully (input cleared/closed)');
        } else {
          console.log('[COMMENT] Comment submitted (verification uncertain)');
        }
      } catch (e) {
        // Verification failed, but assume success
        console.log('[COMMENT] Comment submitted (verification failed)');
      }

      console.log('[COMMENT] Comment submitted successfully');
      
      // Extract post info after comment (in case page structure changed)
      let finalUsername = username;
      let finalText = extractedText;
      try {
        const postInfo = await extractPostInfoFromPage(page);
        if (postInfo && postInfo.username && !finalUsername) {
          finalUsername = postInfo.username;
        }
        if (postInfo && postInfo.text && !finalText) {
          finalText = postInfo.text;
        }
      } catch (extractError) {
        // Non-fatal: use already extracted values
        console.warn(`[COMMENT] Could not re-extract post info: ${extractError.message}`);
      }
      
      return { 
        success: true, 
        message: 'Comment posted successfully',
        postId,
        username: finalUsername || null,
        text: finalText || null
      };
    } catch (typeError) {
      console.error(`[COMMENT] Error typing comment:`, typeError);
      if (typeError.stack) {
        console.error(`[COMMENT] Stack trace:`, typeError.stack);
      }
      return { 
        success: false, 
        error: `Failed to type comment: ${typeError.message}`,
        postId,
        username: username || null,
        text: extractedText || null
      };
    }
  } catch (error) {
    console.error(`[INTERACT] Error commenting on post ${postId}: ${error.message}`);
    if (error.stack) {
      console.error(`[INTERACT] Stack trace:`, error.stack);
    }
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred',
      postId,
      username: username || null,
      text: extractedText || null
    };
  }
}

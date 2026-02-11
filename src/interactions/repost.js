/**
 * Repost/Quote Post Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to repost, quote, and unrepost Threads posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { 
  delay, 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validatePostId,
  validateCommentText,
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
import { navigateToPost, getCommentSubmitButton } from './post-helpers.js';

/**
 * Scan and score all repost buttons to find the best one
 * @param {Page} page - Playwright page object
 * @param {Object} actionContext - Action context for logging
 * @returns {Promise<ElementHandle|null>} Best repost button element or null
 */
export async function scanAndScoreRepostButton(page, actionContext) {
  log(LOG_LEVELS.DEBUG, `[REPOST] Scanning for repost button...`, actionContext);
  
  try {
    // OPTIMIZED: Try quick selector first (most common case)
    const quickButton = await page.$('svg[aria-label*="Repost" i]:not([aria-label*="Unrepost" i]):not([aria-label*="Reposted" i])').catch(() => null);
    if (quickButton) {
      const isVisible = await quickButton.isVisible().catch(() => false);
      if (isVisible) {
        log(LOG_LEVELS.INFO, `[REPOST] Found repost button via quick selector`, actionContext);
        await quickButton.scrollIntoViewIfNeeded().catch(() => {});
        return quickButton;
      }
    }

    // OPTIMIZED: Limit scan to post area and interaction buttons only
    const bestButtonInfo = await page.$$eval(
      'article button, article svg, [role="article"] button, [role="article"] svg, button[aria-label*="Repost" i], svg[aria-label*="Repost" i]',
      (elements) => {
        let bestButton = null;
        let bestScore = 0;
        const maxElements = 100; // Limit to first 100 elements for performance

        for (let i = 0; i < Math.min(elements.length, maxElements); i++) {
          const el = elements[i];
          
          // Quick visibility check
          if (el.offsetParent === null) continue;

          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
          const dataTestId = el.getAttribute('data-testid')?.trim() || '';
          const tagName = el.tagName.toLowerCase();

          const lowerText = (text + ' ' + ariaLabel + ' ' + dataTestId).toLowerCase();

          // Early exit: if we find a perfect match, return immediately
          if (ariaLabel.toLowerCase() === 'repost' || 
              (tagName === 'svg' && ariaLabel.toLowerCase().includes('repost') && !ariaLabel.toLowerCase().includes('unrepost'))) {
            return {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: 300, // Perfect match
              index: i
            };
          }

          // Skip if clearly not a repost button
          if (lowerText.includes('unrepost') ||
              lowerText.includes('reposted') ||
              lowerText.includes('quote') ||
              lowerText.includes('share') ||
              lowerText.includes('like') ||
              lowerText.includes('comment')) {
            continue;
          }

          // Check if button is in a comment/reply section (penalize these)
          let isInCommentSection = false;
          try {
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              const parentClass = parent.className?.toLowerCase() || '';
              const parentId = parent.id?.toLowerCase() || '';
              const parentRole = parent.getAttribute('role') || '';
              
              // Check for comment/reply indicators
              if (parentClass.includes('comment') || 
                  parentClass.includes('reply') ||
                  parentId.includes('comment') ||
                  parentId.includes('reply') ||
                  parentRole === 'article' && parentClass.includes('thread')) {
                // Check if this is a nested article (likely a reply/comment)
                const articleCount = parent.querySelectorAll('article').length;
                if (articleCount > 1) {
                  isInCommentSection = true;
                  break;
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          } catch (e) {
            // Ignore errors in parent traversal
          }

          let score = 0;

          // Prioritize exact matches
          if (ariaLabel.toLowerCase().includes('repost') && !ariaLabel.toLowerCase().includes('unrepost')) {
            score += 200;
          }
          if (text.toLowerCase() === 'repost') {
            score += 180;
          }

          // Prioritize SVG elements with repost aria-label (common in Threads)
          if (tagName === 'svg' && ariaLabel.toLowerCase().includes('repost')) {
            score += 150;
          }

          // Prioritize button elements
          if (tagName === 'button' && ariaLabel.toLowerCase().includes('repost')) {
            score += 120;
          }

          // Data attributes
          if (dataTestId.includes('repost') && !dataTestId.includes('unrepost')) {
            score += 100;
          }

          // Penalize if it's an unrepost button
          if (lowerText.includes('unrepost') || lowerText.includes('reposted')) {
            score -= 200;
          }

          // Penalize if button is in comment/reply section (prioritize main post buttons)
          if (isInCommentSection) {
            score -= 150;
          }

          // Early exit if we find a high-scoring button
          if (score >= 200) {
            return {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: score,
              index: i
            };
          }

          if (score > bestScore) {
            bestScore = score;
            bestButton = {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: score,
              index: i
            };
          }
        }
        return bestButton;
      }
    );

    if (bestButtonInfo && bestButtonInfo.score > 50) {
      log(LOG_LEVELS.INFO, `[REPOST] Found repost button: "${bestButtonInfo.ariaLabel || bestButtonInfo.text}" (score: ${bestButtonInfo.score})`, actionContext);
      
      // Re-find the element using index (faster than selector)
      let finalButton = null;
      
      if (bestButtonInfo.index !== undefined) {
        const allElements = await page.$$('article button, article svg, [role="article"] button, [role="article"] svg, button[aria-label*="Repost" i], svg[aria-label*="Repost" i]').catch(() => []);
        if (allElements[bestButtonInfo.index]) {
          finalButton = allElements[bestButtonInfo.index];
        }
      }
      
      // Fallback to selector if index method failed
      if (!finalButton && bestButtonInfo.ariaLabel) {
        finalButton = await page.$(`[aria-label*="${bestButtonInfo.ariaLabel}" i]`).catch(() => null);
      }
      
      if (!finalButton) {
        // Final fallback: find by SVG with repost aria-label
        finalButton = await page.$('svg[aria-label*="Repost" i]:not([aria-label*="Unrepost" i]):not([aria-label*="Reposted" i])').catch(() => null);
      }

      if (finalButton) {
        await finalButton.scrollIntoViewIfNeeded().catch(() => {});
        return finalButton;
      }
    }
  } catch (e) {
    log(LOG_LEVELS.ERROR, `[REPOST] Error scanning buttons: ${e.message}`, actionContext);
  }

  log(LOG_LEVELS.INFO, `[REPOST] Could not find repost button via scanning`, actionContext);
  return null;
}

/**
 * Scan and score all unrepost buttons to find the best one
 * @param {Page} page - Playwright page object
 * @param {Object} actionContext - Action context for logging
 * @returns {Promise<ElementHandle|null>} Best unrepost button element or null
 */
export async function scanAndScoreUnrepostButton(page, actionContext) {
  log(LOG_LEVELS.DEBUG, `[UNREPOST] Scanning for unrepost button...`, actionContext);
  
  try {
    // OPTIMIZED: Try quick selector first, but only in article elements (main post area)
    // This prevents finding buttons in comments/replies
    log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Trying quick selector in article elements...`, actionContext);
    const quickButton = await page.$('article button:has-text("Remove"), article button[aria-label*="Remove" i], article svg[aria-label*="Reposted" i], article svg[aria-label*="Unrepost" i], [role="article"] button:has-text("Remove"), [role="article"] button[aria-label*="Remove" i]').catch(() => null);
    log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Quick selector result: button found = ${!!quickButton}`, actionContext);
    
    if (quickButton) {
      const isVisible = await quickButton.isVisible().catch(() => false);
      log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Quick button visible = ${isVisible}`, actionContext);
      if (isVisible) {
        // Double-check it's not in a comment/reply section
        log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Verifying quick button is in main post (not comment/reply)...`, actionContext);
        const isInMainPost = await page.evaluate((el) => {
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 15) {
            const parentClass = parent.className?.toLowerCase() || '';
            const parentId = parent.id?.toLowerCase() || '';
            if (parentClass.includes('comment') || 
                parentClass.includes('reply') ||
                parentId.includes('comment') ||
                parentId.includes('reply')) {
              const articleCount = parent.querySelectorAll('article').length;
              if (articleCount > 1) {
                return false; // In comment/reply section
              }
            }
            parent = parent.parentElement;
            depth++;
          }
          return true; // In main post
        }, quickButton).catch(() => true);
        
        log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Quick button isInMainPost = ${isInMainPost}`, actionContext);
        
        if (isInMainPost) {
          const text = await quickButton.textContent().catch(() => '');
          const ariaLabel = await quickButton.getAttribute('aria-label').catch(() => '');
          log(LOG_LEVELS.INFO, `[SCAN_UNREPOST] ✅ Found unrepost button via quick selector in main post: "${text || ariaLabel}"`, actionContext);
          await quickButton.scrollIntoViewIfNeeded().catch(() => {});
          return quickButton;
        } else {
          log(LOG_LEVELS.WARN, `[SCAN_UNREPOST] ⚠️ Found button but it's in comment/reply section, continuing scan...`, actionContext);
        }
      } else {
        log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Quick button found but not visible`, actionContext);
      }
    }

    // OPTIMIZED: Limit scan to post area and interaction buttons only
    log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Starting full scan in article elements...`, actionContext);
    const bestButtonInfo = await page.$$eval(
      'article button, article svg, [role="article"] button, [role="article"] svg, button[aria-label*="Reposted" i], svg[aria-label*="Reposted" i], button[aria-label*="Unrepost" i], svg[aria-label*="Unrepost" i], button:has-text("Remove")',
      (elements) => {
        let bestButton = null;
        let bestScore = 0;
        const maxElements = 100; // Limit to first 100 elements for performance
        
        console.log(`[SCAN_UNREPOST_INTERNAL] Found ${elements.length} total elements to scan`);

        for (let i = 0; i < Math.min(elements.length, maxElements); i++) {
          const el = elements[i];
          
          // Quick visibility check
          if (el.offsetParent === null) continue;

          // Check if button is in a comment/reply section (skip these immediately)
          let isInCommentSection = false;
          try {
            let parent = el.parentElement;
            let depth = 0;
            while (parent && depth < 10) {
              const parentClass = parent.className?.toLowerCase() || '';
              const parentId = parent.id?.toLowerCase() || '';
              const parentRole = parent.getAttribute('role') || '';
              
              // Check for comment/reply indicators
              if (parentClass.includes('comment') || 
                  parentClass.includes('reply') ||
                  parentId.includes('comment') ||
                  parentId.includes('reply')) {
                // Check if this is a nested article (likely a reply/comment)
                const articleCount = parent.querySelectorAll('article').length;
                if (articleCount > 1) {
                  isInCommentSection = true;
                  break;
                }
              }
              parent = parent.parentElement;
              depth++;
            }
          } catch (e) {
            // Ignore errors in parent traversal
          }
          
          // Skip buttons in comment/reply sections immediately
          if (isInCommentSection) {
            continue;
          }

          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
          const dataTestId = el.getAttribute('data-testid')?.trim() || '';
          const tagName = el.tagName.toLowerCase();

          const lowerText = (text + ' ' + ariaLabel + ' ' + dataTestId).toLowerCase();

          // Early exit: "Remove" button is the primary unrepost button in Threads
          if (text.toLowerCase() === 'remove' || ariaLabel.toLowerCase().includes('remove')) {
            console.log(`[SCAN_UNREPOST_INTERNAL] ✅ Found "Remove" button at index ${i} - EARLY EXIT`, { text, ariaLabel, isInCommentSection: isInCommentSection });
            return {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: 350, // Highest priority - "Remove" is the main unrepost button
              index: i
            };
          }

          // Early exit: if we find a perfect match, return immediately
          if (ariaLabel.toLowerCase().includes('unrepost') || 
              (tagName === 'svg' && (ariaLabel.toLowerCase().includes('reposted') || ariaLabel.toLowerCase().includes('unrepost')))) {
            return {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: 300, // Perfect match
              index: i
            };
          }

          // Skip if clearly not an unrepost button
          if ((lowerText.includes('repost') && !lowerText.includes('unrepost') && !lowerText.includes('reposted') && !lowerText.includes('remove')) ||
              lowerText.includes('quote') ||
              lowerText.includes('share') ||
              lowerText.includes('like') ||
              lowerText.includes('comment')) {
            continue;
          }

          let score = 0;

          // Highest priority: "Remove" button (primary unrepost button in Threads)
          if (text.toLowerCase() === 'remove' || ariaLabel.toLowerCase().includes('remove')) {
            score += 350;
          }

          // Prioritize exact matches
          if (ariaLabel.toLowerCase().includes('unrepost')) {
            score += 200;
          }
          if (ariaLabel.toLowerCase().includes('reposted') && !ariaLabel.toLowerCase().includes('unrepost')) {
            score += 180;
          }
          if (text.toLowerCase() === 'unrepost' || text.toLowerCase() === 'reposted') {
            score += 170;
          }

          // Prioritize SVG elements with unrepost/reposted aria-label
          if (tagName === 'svg' && (ariaLabel.toLowerCase().includes('reposted') || ariaLabel.toLowerCase().includes('unrepost'))) {
            score += 150;
          }

          // Prioritize button elements
          if (tagName === 'button' && (ariaLabel.toLowerCase().includes('reposted') || ariaLabel.toLowerCase().includes('unrepost'))) {
            score += 120;
          }

          // Data attributes
          if (dataTestId.includes('unrepost') || dataTestId.includes('reposted')) {
            score += 100;
          }

          // Penalize if it's a regular repost button (not unrepost)
          if (lowerText.includes('repost') && !lowerText.includes('unrepost') && !lowerText.includes('reposted')) {
            score -= 200;
          }

          // Early exit if we find a high-scoring button
          if (score >= 200) {
            return {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: score,
              index: i
            };
          }

          if (score > bestScore) {
            bestScore = score;
            bestButton = {
              tag: tagName,
              text: text,
              ariaLabel: ariaLabel,
              score: score,
              index: i
            };
          }
        }
        console.log(`[SCAN_UNREPOST_INTERNAL] Scan complete. Best button:`, bestButton ? {
          text: bestButton.text,
          ariaLabel: bestButton.ariaLabel,
          score: bestButton.score
        } : null);
        return bestButton;
      }
    );

    log(LOG_LEVELS.DEBUG, `[SCAN_UNREPOST] Full scan result:`, {
      ...actionContext,
      bestButtonInfo: bestButtonInfo ? {
        text: bestButtonInfo.text,
        ariaLabel: bestButtonInfo.ariaLabel,
        score: bestButtonInfo.score,
        tag: bestButtonInfo.tag
      } : null
    });

    if (bestButtonInfo && bestButtonInfo.score > 50) {
      log(LOG_LEVELS.INFO, `[SCAN_UNREPOST] ✅ Found unrepost button: "${bestButtonInfo.ariaLabel || bestButtonInfo.text}" (score: ${bestButtonInfo.score})`, actionContext);
      
      // Re-find the element using index (faster than selector)
      let finalButton = null;
      
      if (bestButtonInfo.index !== undefined) {
        const allElements = await page.$$('article button, article svg, [role="article"] button, [role="article"] svg, button[aria-label*="Reposted" i], svg[aria-label*="Reposted" i], button[aria-label*="Unrepost" i], svg[aria-label*="Unrepost" i], button:has-text("Remove")').catch(() => []);
        if (allElements[bestButtonInfo.index]) {
          finalButton = allElements[bestButtonInfo.index];
        }
      }
      
      // Fallback to selector if index method failed
      if (!finalButton && bestButtonInfo.text === 'Remove') {
        finalButton = await page.$('button:has-text("Remove")').catch(() => null);
      }
      
      if (!finalButton && bestButtonInfo.ariaLabel) {
        finalButton = await page.$(`[aria-label*="${bestButtonInfo.ariaLabel}" i]`).catch(() => null);
      }
      
      if (!finalButton) {
        // Final fallback: find by "Remove" button or SVG with reposted/unrepost aria-label
        finalButton = await page.$('button:has-text("Remove"), svg[aria-label*="Reposted" i], svg[aria-label*="Unrepost" i]').catch(() => null);
      }

      if (finalButton) {
        await finalButton.scrollIntoViewIfNeeded().catch(() => {});
        return finalButton;
      }
    }
  } catch (e) {
    log(LOG_LEVELS.ERROR, `[UNREPOST] Error scanning buttons: ${e.message}`, actionContext);
  }

  log(LOG_LEVELS.INFO, `[UNREPOST] Could not find unrepost button via scanning`, actionContext);
  return null;
}

/**
 * Check if a post is already reposted
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Status object with isReposted and canInteract
 */
export async function getRepostStatus(page, postId, options = {}) {
  const { username, shortcode, postUrl, accountId } = options;
  const actionContext = { action: 'check-repost-status', postId, ...options };

  try {
    validatePostId(postId);
  } catch (validationError) {
    return { success: false, error: validationError.message };
  }

  try {
    // Ensure user is logged in
    const context = page.context();
    const loginCheck = await retryWithBackoff(
      () => ensureLoggedIn(page, context, accountId),
      { maxRetries: 2, context: { ...actionContext, subAction: 'login-check' } }
    ).catch(() => ({ success: false, error: 'Login failed' }));

    if (!loginCheck.success) {
      log(LOG_LEVELS.WARN, 'Not logged in, repost status may be inaccurate', actionContext);
    }

    // Navigate to post if needed
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
        return { success: false, error: 'Failed to navigate to post' };
      }
    }

    // Wait for page to fully load (reduced delay)
    await delay(1500);
    
    // Scroll to top to ensure buttons are in view
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    // Check for unrepost button (indicates already reposted)
    log(LOG_LEVELS.INFO, `Checking repost status for post ${postId}...`, actionContext);
    
    // Debug: Scan all buttons with repost-related text (including "Remove")
    try {
      const allRepostButtons = await page.$$eval('button, svg, [role="button"]', (elements) => {
        return elements
          .filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
            const combined = text + ' ' + ariaLabel;
            return combined.includes('repost') || 
                   combined.includes('reposted') || 
                   combined.includes('remove') ||
                   combined.includes('unrepost');
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim() || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            visible: el.offsetParent !== null
          }));
      });
      
      if (allRepostButtons.length > 0) {
        log(LOG_LEVELS.DEBUG, `Found ${allRepostButtons.length} repost-related elements (including Remove):`, {
          ...actionContext,
          buttons: allRepostButtons
        });
      }
    } catch (e) {
      // Ignore debug errors
    }
    
    // IMPORTANT: After repost, UI only updates when you click on the repost button area
    // We need to click to trigger UI update, but then press Escape to close modal (don't actually repost)
    // This way we can see if "Remove" button appears without performing repost action
    log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0: Clicking on repost button area to trigger UI update...`, actionContext);
    let clickedAndWaited = false;
    
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:581',message:'HYP-A: Starting getRepostStatus - checking for repost button area',data:{postId:actionContext.postId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    try {
      // DEBUG: Check all buttons on page first (hypothesis A: button not in article)
      // #region agent log
      const allButtonsDebug = await page.$$eval('button, svg', (elements) => {
        return elements.slice(0, 50).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim() || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          visible: el.offsetParent !== null,
          inArticle: el.closest('article') !== null
        }));
      }).catch(() => []);
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:590',message:'HYP-A: All buttons on page (first 50)',data:{buttons:allButtonsDebug,count:allButtonsDebug.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Find repost button area - try multiple selectors
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:595',message:'HYP-A: Trying selector for repost button area',data:{selector:'article button[aria-label*="Repost" i], article svg[aria-label*="Repost" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      let repostButtonArea = await page.$('article button[aria-label*="Repost" i], article svg[aria-label*="Repost" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
      
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:598',message:'HYP-A: Selector result (article only)',data:{found:!!repostButtonArea},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // If not found in article, try without article constraint (hypothesis A)
      if (!repostButtonArea) {
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:602',message:'HYP-A: Not found in article, trying without article constraint',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        repostButtonArea = await page.$('button[aria-label*="Repost" i], svg[aria-label*="Repost" i], button:has-text("Remove"), button[aria-label*="Remove" i]').catch(() => null);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:606',message:'HYP-A: Selector result (without article)',data:{found:!!repostButtonArea},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      
      if (repostButtonArea) {
        await repostButtonArea.scrollIntoViewIfNeeded().catch(() => {});
        await delay(500);
        
        // Check what button we have before clicking
        const beforeText = await repostButtonArea.textContent().catch(() => '');
        const beforeAriaLabel = await repostButtonArea.getAttribute('aria-label').catch(() => '');
        log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.1: Before click - text="${beforeText}", aria-label="${beforeAriaLabel}"`, actionContext);
        
        const isRemoveBefore = beforeText.toLowerCase().includes('remove') || beforeAriaLabel.toLowerCase().includes('remove');
        
        if (!isRemoveBefore) {
          // It's still "Repost" button, click it to trigger UI update
          log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.2: Clicking repost button to trigger UI update...`, actionContext);
          await repostButtonArea.click({ force: true }).catch(() => {});
          await delay(2000); // Wait for modal to appear and UI to update
          clickedAndWaited = true;
          
          // Check if "Remove" button appears in the modal or on the page after click
          // Sometimes the button changes immediately after clicking
          log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.3: Checking if "Remove" button appeared after click...`, actionContext);
          
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:615',message:'HYP-B: After click - checking for Remove button',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          const checkAfterClick = await page.$('button:has-text("Remove"), button[aria-label*="Remove" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
          
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:619',message:'HYP-B: After click - Remove button check result',data:{found:!!checkAfterClick},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          if (checkAfterClick) {
            const afterText = await checkAfterClick.textContent().catch(() => '');
            const afterAriaLabel = await checkAfterClick.getAttribute('aria-label').catch(() => '');
            log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.4: After click, found button - text="${afterText}", aria-label="${afterAriaLabel}"`, actionContext);
            
            // #region agent log
            fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:625',message:'HYP-B: After click - button details',data:{text:afterText,ariaLabel:afterAriaLabel,isRemove:afterText.toLowerCase().includes('remove') || afterAriaLabel.toLowerCase().includes('remove')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            if (afterText.toLowerCase().includes('remove') || afterAriaLabel.toLowerCase().includes('remove')) {
              // "Remove" button appeared! Close modal and return
              log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] ✅ "Remove" button appeared after click - post is reposted`, actionContext);
              
              // #region agent log
              fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:630',message:'HYP-B: CONFIRMED - Remove button found after click, returning isReposted=true',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
              await page.keyboard.press('Escape').catch(() => {});
              await delay(1000);
              return {
                success: true,
                isReposted: true,
                canInteract: true
              };
            }
          } else {
            // #region agent log
            fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:640',message:'HYP-B: REJECTED - Remove button NOT found after click',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
          }
          
          // IMPORTANT: Press Escape to close modal WITHOUT clicking "Repost" option
          // This way we only trigger UI update, not actually repost
          log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.5: Pressing Escape to close modal (don't repost)...`, actionContext);
          await page.keyboard.press('Escape').catch(() => {});
          await delay(2000); // Wait longer for UI to update after closing modal
          
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:645',message:'HYP-C: After Escape - checking for Remove button again',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Check again after Escape
          const checkAfterEscape = await page.$('button:has-text("Remove"), button[aria-label*="Remove" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
          
          // #region agent log
          if (checkAfterEscape) {
            const afterEscapeText = await checkAfterEscape.textContent().catch(() => '');
            const afterEscapeAriaLabel = await checkAfterEscape.getAttribute('aria-label').catch(() => '');
            fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:651',message:'HYP-C: After Escape - Remove button found',data:{text:afterEscapeText,ariaLabel:afterEscapeAriaLabel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          } else {
            fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:655',message:'HYP-C: After Escape - Remove button NOT found',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          }
          // #endregion
          
          log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 0.6: Clicked, closed modal, and waited for UI update. Now scanning...`, actionContext);
        } else {
          log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] ✅ Already found "Remove" button before click - post is reposted`, actionContext);
          // Already found "Remove" button, return immediately
          return {
            success: true,
            isReposted: true,
            canInteract: true
          };
        }
      } else {
        log(LOG_LEVELS.WARN, `[GET_REPOST_STATUS] Could not find repost button area to click`, actionContext);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:660',message:'HYP-A: REJECTED - Could not find repost button area with any selector',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } catch (e) {
      log(LOG_LEVELS.WARN, `[GET_REPOST_STATUS] Error clicking repost button area: ${e.message}`, actionContext);
      
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:665',message:'HYP-A: ERROR - Exception while finding repost button area',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
    
    // Now scan AFTER clicking and waiting for UI update
    if (clickedAndWaited) {
      log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 1: Scanning for unrepost/Remove button (AFTER click and UI update)...`, actionContext);
    } else {
      log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] Step 1: Scanning for unrepost/Remove button (no click needed)...`, actionContext);
    }
    // OPTIMIZED: Use scan functions directly (they filter out comment/reply buttons)
    // Priority: "Remove" button (350 points) > Repost button (300 points) > Unrepost button (200 points)
    
    // Step 1: Scan for "Remove" button or unrepost button (highest priority - indicates reposted)
    // scanAndScoreUnrepostButton includes "Remove" button and filters out comment/reply buttons
    // NOTE: This scan happens AFTER clicking repost button area and waiting for UI update
    log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Step 1: Scanning for unrepost/Remove button (after click and UI update)...`, actionContext);
    let unrepostButtonElement = await scanAndScoreUnrepostButton(page, actionContext);
    let unrepostButton = null;
    
    log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Step 1 result: unrepostButtonElement found = ${!!unrepostButtonElement}`, actionContext);
    
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:680',message:'HYP-D: Scan result for unrepost/Remove button',data:{found:!!unrepostButtonElement,clickedAndWaited},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    if (unrepostButtonElement) {
      // Verify it's actually a "Remove" button or unrepost button by checking its properties
      // AND verify it's in the main post area (not in comments/replies)
      log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Verifying unrepost button element...`, actionContext);
      const buttonInfo = await page.evaluate((el) => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
        const lowerText = (text + ' ' + ariaLabel).toLowerCase();
        
        // Check if button is in a comment/reply section
        let isInCommentSection = false;
        let parent = el.parentElement;
        let depth = 0;
        while (parent && depth < 15) {
          const parentClass = parent.className?.toLowerCase() || '';
          const parentId = parent.id?.toLowerCase() || '';
          const parentRole = parent.getAttribute('role') || '';
          
          // Check for comment/reply indicators
          if (parentClass.includes('comment') || 
              parentClass.includes('reply') ||
              parentId.includes('comment') ||
              parentId.includes('reply')) {
            // Check if this is a nested article (likely a reply/comment)
            const articleCount = parent.querySelectorAll('article').length;
            if (articleCount > 1) {
              isInCommentSection = true;
              break;
            }
          }
          parent = parent.parentElement;
          depth++;
        }
        
        // Check if it's "Remove" button (highest priority)
        if (text.toLowerCase() === 'remove' || ariaLabel.toLowerCase().includes('remove')) {
          return { type: 'remove', score: 350, isInCommentSection };
        }
        // Check if it's unrepost button
        if (lowerText.includes('unrepost') || lowerText.includes('reposted')) {
          return { type: 'unrepost', score: 200, isInCommentSection };
        }
        return null;
      }, unrepostButtonElement).catch(() => null);
      
      log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Button info:`, {
        ...actionContext,
        buttonInfo: buttonInfo ? {
          type: buttonInfo.type,
          isInCommentSection: buttonInfo.isInCommentSection
        } : null
      });
      
      if (buttonInfo && buttonInfo.type === 'remove' && !buttonInfo.isInCommentSection) {
        // Found "Remove" button in main post = post is reposted, return immediately
        log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] ✅ Found "Remove" button in main post - post is reposted (early exit)`, actionContext);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:695',message:'HYP-D: CONFIRMED - Remove button found via scan, returning isReposted=true',data:{buttonInfo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        return {
          success: true,
          isReposted: true,
          canInteract: true
        };
      } else if (buttonInfo && buttonInfo.type === 'remove' && buttonInfo.isInCommentSection) {
        // "Remove" button found but in comment section - ignore
        log(LOG_LEVELS.WARN, `[GET_REPOST_STATUS] ⚠️ Found "Remove" button but it's in comment/reply section, ignoring...`, actionContext);
        unrepostButtonElement = null; // Reset to continue searching
      } else if (buttonInfo && buttonInfo.type === 'unrepost' && !buttonInfo.isInCommentSection) {
        // Found unrepost button in main post
        log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Found unrepost button in main post`, actionContext);
        unrepostButton = { element: unrepostButtonElement, selector: 'scanned' };
      } else if (buttonInfo && buttonInfo.type === 'unrepost' && buttonInfo.isInCommentSection) {
        // Unrepost button found but in comment section - ignore
        log(LOG_LEVELS.WARN, `[GET_REPOST_STATUS] ⚠️ Found unrepost button but it's in comment/reply section, ignoring...`, actionContext);
        unrepostButtonElement = null; // Reset to continue searching
      } else if (!buttonInfo) {
        log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Button element found but buttonInfo is null/invalid`, actionContext);
        unrepostButtonElement = null;
      }
    } else {
      log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] No unrepost button element found from scan`, actionContext);
    }
    
    // If no unrepost button found, try fallback (only in article elements to avoid comment/reply buttons)
    if (!unrepostButton) {
      // Create selectors with article context
      const articleUnrepostSelectors = CONFIG.selectors.unrepostButton.map(selector => {
        // Add article context if not already present
        if (!selector.includes('article') && !selector.includes('[role="article"]')) {
          return `article ${selector}, [role="article"] ${selector}`;
        }
        return selector;
      });
      
      unrepostButton = await waitForElement(page, articleUnrepostSelectors, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        retries: 1
      }).catch(() => null);
      
      // If found, verify it's not in comment/reply section
      if (unrepostButton && unrepostButton.element) {
        const isInMainPost = await page.evaluate((el) => {
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 15) {
            const parentClass = parent.className?.toLowerCase() || '';
            const parentId = parent.id?.toLowerCase() || '';
            if (parentClass.includes('comment') || 
                parentClass.includes('reply') ||
                parentId.includes('comment') ||
                parentId.includes('reply')) {
              const articleCount = parent.querySelectorAll('article').length;
              if (articleCount > 1) {
                return false; // In comment/reply section
              }
            }
            parent = parent.parentElement;
            depth++;
          }
          return true; // In main post
        }, unrepostButton.element).catch(() => true);
        
        if (!isInMainPost) {
          log(LOG_LEVELS.DEBUG, `Fallback found button but it's in comment/reply section, ignoring...`, actionContext);
          unrepostButton = null;
        }
      }
    }

    // Step 2: Scan for Repost button (indicates NOT reposted)
    // scanAndScoreRepostButton filters out comment/reply buttons by scanning only in article elements
    log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Step 2: Scanning for repost button...`, actionContext);
    let repostButtonElement = await scanAndScoreRepostButton(page, actionContext);
    let repostButton = null;
    
    log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Step 2 result: repostButtonElement found = ${!!repostButtonElement}, unrepostButton found = ${!!unrepostButton}`, actionContext);
    
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:800',message:'HYP-D: Final scan results',data:{repostButtonFound:!!repostButtonElement,unrepostButtonFound:!!unrepostButton,clickedAndWaited},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    if (repostButtonElement) {
      repostButton = { element: repostButtonElement, selector: 'scanned' };
      
      // If we found repost button but no unrepost button, post is NOT reposted
      if (!unrepostButton) {
        log(LOG_LEVELS.INFO, `[GET_REPOST_STATUS] ✅ Found Repost button (no unrepost button) - post is NOT reposted (early exit)`, actionContext);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:808',message:'HYP-D: REJECTED - Found Repost button but no Remove button, returning isReposted=false',data:{clickedAndWaited},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        return {
          success: true,
          isReposted: false,
          canInteract: true
        };
      } else {
        log(LOG_LEVELS.WARN, `[GET_REPOST_STATUS] ⚠️ Found BOTH repost button AND unrepost button - ambiguous state`, actionContext);
      }
    } else {
      // Fallback to traditional waitForElement
      log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Repost button not found from scan, trying fallback...`, actionContext);
      repostButton = await waitForElement(page, CONFIG.selectors.repostButton, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        retries: 1
      }).catch(() => null);
      log(LOG_LEVELS.DEBUG, `[GET_REPOST_STATUS] Fallback result: repostButton found = ${!!repostButton}`, actionContext);
    }

    // Determine status
    let isReposted = false;
    let canInteract = false;

    log(LOG_LEVELS.DEBUG, `Button check results:`, {
      ...actionContext,
      unrepostButtonFound: !!unrepostButton,
      repostButtonFound: !!repostButton
    });

    // Priority 1: Unrepost button (including "Remove") indicates post is reposted
    if (unrepostButton) {
      // Unrepost button exists = already reposted
      isReposted = true;
      canInteract = true;
      
      // Double-check: repost button should NOT exist if already reposted
      if (!repostButton) {
        log(LOG_LEVELS.INFO, `Confirmed: Post ${postId} is reposted (found unrepost/Remove button)`, actionContext);
      } else {
        // Both buttons exist? Wait and re-check (UI might be updating)
        log(LOG_LEVELS.DEBUG, `Both buttons found, re-checking...`, actionContext);
        await delay(2000);
        
        // Scroll again and wait
        await page.evaluate(() => window.scrollTo(0, 0));
        await delay(500);
        
        const finalUnrepostCheck = await waitForElement(page, CONFIG.selectors.unrepostButton, {
          timeout: CONFIG.browser.timeouts.quickCheck,
          retries: 1
        });
        
        const finalRepostCheck = await waitForElement(page, CONFIG.selectors.repostButton, {
          timeout: CONFIG.browser.timeouts.quickCheck,
          retries: 1
        }).catch(() => null);
        
        if (finalUnrepostCheck && !finalRepostCheck) {
          isReposted = true;
          log(LOG_LEVELS.INFO, `Confirmed after re-check: Post ${postId} is reposted`, actionContext);
        } else if (!finalUnrepostCheck && finalRepostCheck) {
          isReposted = false;
          log(LOG_LEVELS.INFO, `Re-check shows: Post ${postId} is not reposted`, actionContext);
        } else {
          // Still ambiguous, trust unrepost button
          isReposted = true;
          log(LOG_LEVELS.WARN, `Ambiguous state, defaulting to reposted based on unrepost button`, actionContext);
        }
      }
    } else if (repostButton) {
      // Repost button exists and unrepost doesn't = not reposted
      isReposted = false;
      canInteract = true;
      log(LOG_LEVELS.INFO, `Confirmed: Post ${postId} is not reposted`, actionContext);
    } else {
      // Neither button found = cannot determine or cannot interact
      canInteract = false;
      log(LOG_LEVELS.WARN, `Could not determine repost status for post ${postId} - no buttons found`, actionContext);
      
      // Try one more time with shorter wait
      await delay(1000);
      const lastUnrepostCheck = await waitForElement(page, CONFIG.selectors.unrepostButton, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        retries: 1
      }).catch(() => null);
      
      const lastRepostCheck = await waitForElement(page, CONFIG.selectors.repostButton, {
        timeout: CONFIG.browser.timeouts.quickCheck,
        retries: 1
      }).catch(() => null);
      
      if (lastUnrepostCheck) {
        isReposted = true;
        canInteract = true;
        log(LOG_LEVELS.INFO, `Found unrepost button on second attempt: Post ${postId} is reposted`, actionContext);
      } else if (lastRepostCheck) {
        isReposted = false;
        canInteract = true;
        log(LOG_LEVELS.INFO, `Found repost button on second attempt: Post ${postId} is not reposted`, actionContext);
      }
    }

    return {
      success: true,
      isReposted,
      canInteract
    };
  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    log(LOG_LEVELS.ERROR, `Error checking repost status`, {
      ...actionContext,
      error: classifiedError.message
    });
    return { success: false, error: classifiedError.message };
  }
}

/**
 * Repost a post
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function repostPost(page, postId, options = {}) {
  const startTime = Date.now();
  const actionContext = { action: 'repost', postId, ...options };

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

    log(LOG_LEVELS.INFO, `Starting repost action for post ${postId}`, actionContext);

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

    // Check repost status first (will check for "Remove" button - highest priority)
    log(LOG_LEVELS.INFO, `[REPOST] Checking if post ${postId} is already reposted...`, actionContext);
    const repostStatus = await getRepostStatus(page, postId, options);
    
    log(LOG_LEVELS.INFO, `[REPOST] Repost status check result:`, {
      ...actionContext,
      success: repostStatus.success,
      isReposted: repostStatus.isReposted,
      canInteract: repostStatus.canInteract,
      error: repostStatus.error
    });
    
    if (!repostStatus.success) {
      log(LOG_LEVELS.WARN, `[REPOST] ⚠️ Could not check repost status, proceeding anyway...`, {
        ...actionContext,
        error: repostStatus.error
      });
    } else if (repostStatus.isReposted) {
      // Post is already reposted (found "Remove" button or unrepost button)
      log(LOG_LEVELS.INFO, `[REPOST] ✅ Post ${postId} is already reposted (found "Remove" or unrepost button) - skipping repost action`, actionContext);
      return {
        success: true,
        alreadyReposted: true,
        message: 'Post is already reposted',
        duration: Date.now() - startTime
      };
    }
    
    log(LOG_LEVELS.INFO, `[REPOST] Post ${postId} is NOT reposted yet, proceeding with repost action...`, actionContext);

    // Find repost button using optimized scan and score method
    log(LOG_LEVELS.INFO, `Looking for repost button for post ${postId}`, actionContext);
    
    // First try optimized scan method
    let repostButtonElement = await scanAndScoreRepostButton(page, actionContext);
    
    // Fallback to traditional waitForElement if scan didn't find it
    if (!repostButtonElement) {
      log(LOG_LEVELS.DEBUG, `Scan method didn't find button, trying traditional selectors...`, actionContext);
      const repostButton = await waitForElement(page, CONFIG.selectors.repostButton, {
        timeout: CONFIG.browser.timeouts.normalOperation,
        retries: config.retryAttempts
      });
      
      if (repostButton) {
        repostButtonElement = repostButton.element;
      }
    }

    if (!repostButtonElement) {
      throw new ElementNotFoundError('Could not find repost button', 'repostButton', actionContext);
    }

    log(LOG_LEVELS.INFO, `Found repost button, clicking...`, actionContext);
    await delay(config.delayBeforeClick);
    await repostButtonElement.click();
    await delay(1500); // Wait for modal to appear

    // After clicking repost button, a modal appears with "Repost" and "Quote" options
    // We need to click the "Repost" option in the modal
    log(LOG_LEVELS.INFO, `Looking for repost option in modal...`, actionContext);
    
    // Wait for modal to appear first
    await delay(1000); // Give modal time to appear
    
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1147',message:'HYP-F: Waiting for modal to appear',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    // Check if modal exists
    const modalExists = await page.$('div[role="dialog"], div[role="menu"], [data-testid*="menu"]').catch(() => null);
    
    // #region agent log
    fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1153',message:'HYP-F: Modal exists check',data:{modalExists:!!modalExists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    
    const repostModalSelectors = CONFIG.selectors.repostModalButton || [
      'button:has-text("Repost")',
      'button[aria-label*="Repost"]:not([aria-label*="Quote"])',
      'div[role="dialog"] button:has-text("Repost")',
      'div[role="menu"] button:has-text("Repost")',
      '[data-testid*="repost"] button'
    ];

    let repostModalClicked = false;
    for (const selector of repostModalSelectors) {
      try {
        const modalButton = await page.waitForSelector(selector, {
          timeout: CONFIG.browser.timeouts.quickCheck,
          state: 'visible'
        }).catch(() => null);
        
        if (modalButton) {
          const isVisible = await modalButton.isVisible().catch(() => false);
          if (isVisible) {
            // #region agent log
            const buttonText = await modalButton.textContent().catch(() => '');
            const buttonAriaLabel = await modalButton.getAttribute('aria-label').catch(() => '');
            fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1170',message:'HYP-F: Found repost button via selector',data:{selector,text:buttonText,ariaLabel:buttonAriaLabel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            log(LOG_LEVELS.INFO, `Found repost option in modal, clicking...`, { ...actionContext, selector });
            await delay(500);
            
            // Try multiple click strategies
            try {
              await modalButton.click();
            } catch (e) {
              // If normal click fails, try force click
              await modalButton.click({ force: true });
            }
            
            repostModalClicked = true;
            await delay(config.delayAfterClick);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If modal button not found, try to find any button with "Repost" text in visible dialogs
    if (!repostModalClicked) {
      log(LOG_LEVELS.DEBUG, `Modal button not found with selectors, trying alternative approach...`, actionContext);
      
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1210',message:'HYP-F: Trying alternative approach - scanning all buttons',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      try {
        // First, wait a bit more for modal to fully render
        await delay(1000);
        
        // DEBUG: List all buttons on page to see what's available
        const allButtonsDebug = await page.$$eval('button, [role="button"], [role="menuitem"]', (buttons) => {
          return buttons
            .filter(btn => btn.offsetParent !== null)
            .slice(0, 30) // Limit to first 30
            .map(btn => {
              const text = btn.textContent?.trim() || '';
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const role = btn.getAttribute('role') || '';
              const tag = btn.tagName;
              const inModal = btn.closest('div[role="dialog"], div[role="menu"], [data-testid*="menu"]') !== null;
              return { text, ariaLabel, role, tag, inModal };
            });
        }).catch(() => []);
        
        // #region agent log
        log(LOG_LEVELS.DEBUG, `[REPOST] All visible buttons on page:`, { ...actionContext, allButtons: allButtonsDebug });
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1228',message:'HYP-F: All visible buttons on page',data:{buttons:allButtonsDebug,count:allButtonsDebug.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Find all visible buttons in dialogs/menus, score them, and click the best one
        // Use $$eval to scan all buttons in one go (more efficient)
        const buttonCandidates = await page.$$eval(
          'div[role="dialog"] button, div[role="menu"] button, [data-testid*="menu"] button, [role="menuitem"], [role="menuitem"] button',
          (buttons) => {
            return buttons
              .filter(btn => btn.offsetParent !== null) // Only visible
              .map((btn, index) => {
                const text = btn.textContent?.trim() || '';
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const lowerText = (text + ' ' + ariaLabel).toLowerCase();
                
                // Score buttons: "Repost" (not "Quote") gets highest score
                let score = 0;
                if (text.toLowerCase() === 'repost' || ariaLabel.toLowerCase() === 'repost') {
                  score = 100; // Exact match
                } else if (lowerText.includes('repost') && !lowerText.includes('quote')) {
                  score = 80; // Contains "repost" but not "quote"
                } else if (lowerText.includes('repost')) {
                  score = 50; // Contains "repost" but also "quote"
                }
                
                return { index, text, ariaLabel, score };
              })
              .filter(btn => btn.score > 0)
              .sort((a, b) => b.score - a.score); // Sort by score descending
          }
        ).catch(() => []);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1252',message:'HYP-F: Button candidates found in modal',data:{candidates:buttonCandidates,count:buttonCandidates.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // If no candidates in modal, try scanning entire page for "Repost" button
        if (buttonCandidates.length === 0) {
          log(LOG_LEVELS.DEBUG, `No repost button found in modal, scanning entire page...`, actionContext);
          
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1260',message:'HYP-F: Scanning entire page for Repost button',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          // Scan entire page for any button with "Repost" text
          const pageButtonCandidates = await page.$$eval(
            'button, [role="button"], [role="menuitem"]',
            (buttons) => {
              return buttons
                .filter(btn => btn.offsetParent !== null) // Only visible
                .map((btn, index) => {
                  const text = btn.textContent?.trim() || '';
                  const ariaLabel = btn.getAttribute('aria-label') || '';
                  const lowerText = (text + ' ' + ariaLabel).toLowerCase();
                  
                  // Score buttons: "Repost" (not "Quote") gets highest score
                  let score = 0;
                  if (text.toLowerCase() === 'repost' || ariaLabel.toLowerCase() === 'repost') {
                    score = 100; // Exact match
                  } else if (lowerText.includes('repost') && !lowerText.includes('quote')) {
                    score = 80; // Contains "repost" but not "quote"
                  } else if (lowerText.includes('repost')) {
                    score = 50; // Contains "repost" but also "quote"
                  }
                  
                  return { index, text, ariaLabel, score };
                })
                .filter(btn => btn.score > 0)
                .sort((a, b) => b.score - a.score); // Sort by score descending
            }
          ).catch(() => []);
          
          // #region agent log
          fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1288',message:'HYP-F: Button candidates found on entire page',data:{candidates:pageButtonCandidates,count:pageButtonCandidates.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          if (pageButtonCandidates.length > 0) {
            // Get all buttons again to click the best one
            const allPageButtons = await page.$$('button, [role="button"], [role="menuitem"]').catch(() => []);
            
            // Find the button that matches the best candidate
            const bestCandidate = pageButtonCandidates[0];
            const targetIndex = bestCandidate.index;
            
            if (allPageButtons[targetIndex]) {
              const bestButton = allPageButtons[targetIndex];
              const isVisible = await bestButton.isVisible().catch(() => false);
              
              if (isVisible) {
                // #region agent log
                fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1305',message:'HYP-F: Clicking best button found on entire page',data:{text:bestCandidate.text,ariaLabel:bestCandidate.ariaLabel,score:bestCandidate.score},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                // #endregion
                
                log(LOG_LEVELS.INFO, `Clicking repost button found on page (via scoring, score=${bestCandidate.score})`, actionContext);
                await delay(500);
                
                // Try multiple click strategies
                try {
                  await bestButton.click();
                } catch (e) {
                  try {
                    await bestButton.click({ force: true });
                  } catch (e2) {
                    await page.evaluate((btn) => btn.click(), bestButton).catch(() => {});
                  }
                }
                
                repostModalClicked = true;
                await delay(config.delayAfterClick);
              }
            }
          }
        } else {
          // Get all buttons again to click the best one
          const allModalButtons = await page.$$('div[role="dialog"] button, div[role="menu"] button, [data-testid*="menu"] button, [role="menuitem"]').catch(() => []);
          
          // Find the button that matches the best candidate
          const bestCandidate = buttonCandidates[0];
          const targetIndex = bestCandidate.index;
          
          if (allModalButtons[targetIndex]) {
            const bestButton = allModalButtons[targetIndex];
            const isVisible = await bestButton.isVisible().catch(() => false);
            
            if (isVisible) {
              // #region agent log
              fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1335',message:'HYP-F: Clicking best button found via scoring',data:{text:bestCandidate.text,ariaLabel:bestCandidate.ariaLabel,score:bestCandidate.score},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              
              log(LOG_LEVELS.INFO, `Clicking repost button in modal (found via scoring, score=${bestCandidate.score})`, actionContext);
              await delay(500);
              
              // Try multiple click strategies
              try {
                await bestButton.click();
              } catch (e) {
                // If normal click fails, try force click or JavaScript click
                try {
                  await bestButton.click({ force: true });
                } catch (e2) {
                  await page.evaluate((btn) => btn.click(), bestButton).catch(() => {});
                }
              }
              
              repostModalClicked = true;
              await delay(config.delayAfterClick);
            }
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Alternative modal approach failed: ${e.message}`, actionContext);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1358',message:'HYP-F: ERROR - Alternative approach exception',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }
    }

    // If still not clicked, try pressing Enter (modal might be focused)
    if (!repostModalClicked) {
      log(LOG_LEVELS.WARN, `[REPOST] Could not find repost option in modal, trying Enter key...`, actionContext);
      
      // #region agent log
      fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1227',message:'HYP-E: Enter key fallback - checking modal state before Enter',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      try {
        // Try to find and focus the modal first
        const modal = await page.$('div[role="dialog"], div[role="menu"]').catch(() => null);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1233',message:'HYP-E: Modal found before Enter',data:{modalFound:!!modal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        if (modal) {
          await modal.focus().catch(() => {});
          await delay(300);
        }
        
        // Check modal buttons before Enter
        // #region agent log
        const modalButtonsBefore = await page.$$eval('div[role="dialog"] button, div[role="menu"] button', (buttons) => {
          return buttons.slice(0, 10).map(btn => ({
            text: btn.textContent?.trim() || '',
            ariaLabel: btn.getAttribute('aria-label') || '',
            visible: btn.offsetParent !== null
          }));
        }).catch(() => []);
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1242',message:'HYP-E: Modal buttons before Enter',data:{buttons:modalButtonsBefore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        await page.keyboard.press('Enter');
        await delay(2000); // Increased delay after Enter
        
        // Check if modal closed after Enter
        // #region agent log
        const modalAfterEnter = await page.$('div[role="dialog"], div[role="menu"]').catch(() => null);
        const modalVisible = modalAfterEnter ? await modalAfterEnter.isVisible().catch(() => false) : false;
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1250',message:'HYP-E: Modal state after Enter',data:{modalFound:!!modalAfterEnter,modalVisible},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // Verify Enter key actually triggered repost by checking for "Remove" button
        // #region agent log
        const removeButtonAfterEnter = await page.$('button:has-text("Remove"), button[aria-label*="Remove" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
        const repostButtonAfterEnter = await page.$('button[aria-label*="Repost" i], article button[aria-label*="Repost" i]').catch(() => null);
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1256',message:'HYP-E: Button state after Enter (before reload)',data:{removeButtonFound:!!removeButtonAfterEnter,repostButtonFound:!!repostButtonAfterEnter},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // Only assume it worked if modal closed OR we see "Remove" button
        if (modalVisible === false || removeButtonAfterEnter) {
          repostModalClicked = true;
          log(LOG_LEVELS.INFO, `[REPOST] Enter key pressed, modal closed or "Remove" button appeared`, actionContext);
        } else {
          log(LOG_LEVELS.WARN, `[REPOST] Enter key pressed but modal still visible and no "Remove" button - repost may have failed`, actionContext);
          // Still set to true to continue, but we'll verify later
          repostModalClicked = true;
        }
      } catch (e) {
        log(LOG_LEVELS.WARN, `[REPOST] Enter key also failed: ${e.message}`, actionContext);
        
        // #region agent log
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1258',message:'HYP-E: Enter key failed',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }
    }

    // Wait for modal to close after repost action
    if (repostModalClicked) {
      try {
        await page.waitForSelector('div[role="dialog"], div[role="menu"]', {
          state: 'hidden',
          timeout: CONFIG.browser.timeouts.quickCheck
        }).catch(() => {
          // Modal might already be closed or not exist
          log(LOG_LEVELS.DEBUG, `[REPOST] Modal already closed or not found`, actionContext);
        });
      } catch (e) {
        // Ignore if modal check fails
      }
      await delay(2000); // Additional delay for UI to update
      
      // IMPORTANT: After repost, "Remove" button only appears after clicking on the repost button area
      // Try to click on the repost button area to trigger UI update
      log(LOG_LEVELS.INFO, `[REPOST] Clicking on repost button area to trigger UI update...`, actionContext);
      try {
        // Try to find and click the repost button area (even if it's now "Remove" button)
        const repostArea = await page.$('article button[aria-label*="Repost" i], article svg[aria-label*="Repost" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
        if (repostArea) {
          await repostArea.scrollIntoViewIfNeeded().catch(() => {});
          await delay(500);
          // Just hover or click to trigger UI update, but don't actually click if it's "Remove"
          const ariaLabel = await repostArea.getAttribute('aria-label').catch(() => '');
          const text = await repostArea.textContent().catch(() => '');
          const isRemove = text.toLowerCase().includes('remove') || ariaLabel.toLowerCase().includes('remove');
          
          if (!isRemove) {
            // It's still repost button, click it to trigger UI update
            await repostArea.click({ force: true }).catch(() => {});
            await delay(1000);
            // Press Escape to close any modal that might open
            await page.keyboard.press('Escape').catch(() => {});
            await delay(1000);
            log(LOG_LEVELS.INFO, `[REPOST] Clicked repost button area to trigger UI update`, actionContext);
          } else {
            log(LOG_LEVELS.INFO, `[REPOST] Already found "Remove" button, no need to click`, actionContext);
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `[REPOST] Could not click repost button area: ${e.message}`, actionContext);
      }
      
      // Reload page as fallback to ensure UI is updated
      log(LOG_LEVELS.INFO, `[REPOST] Reloading page to ensure UI is updated...`, actionContext);
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: CONFIG.browser.timeouts.longOperation });
        await delay(2000); // Wait for page to fully load
        log(LOG_LEVELS.INFO, `[REPOST] Page reloaded successfully`, actionContext);
        
        // #region agent log
        // After reload, check if "Remove" button appears
        const removeButtonAfterReload = await page.$('button:has-text("Remove"), button[aria-label*="Remove" i], article button:has-text("Remove"), article button[aria-label*="Remove" i]').catch(() => null);
        const repostButtonAfterReload = await page.$('button[aria-label*="Repost" i], article button[aria-label*="Repost" i]').catch(() => null);
        fetch('http://127.0.0.1:7248/ingest/4a10d893-6b3f-4432-848f-8569590b84ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'repost.js:1295',message:'HYP-E: After reload - button state',data:{removeButtonFound:!!removeButtonAfterReload,repostButtonFound:!!repostButtonAfterReload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      } catch (e) {
        log(LOG_LEVELS.WARN, `[REPOST] Page reload failed, continuing anyway: ${e.message}`, actionContext);
      }
    }

    // Verify by checking if "Remove" button or unrepost button appears
    log(LOG_LEVELS.INFO, `Verifying repost...`, actionContext);
    await delay(3000); // Increased delay before verification
    
    // Retry verification logic: check "Remove" button 3-5 times with delay between attempts
    let verifyUnrepostButtonElement = null;
    let verified = false;
    const maxVerificationRetries = 5;
    
    for (let retry = 0; retry < maxVerificationRetries; retry++) {
      // Use scanAndScoreUnrepostButton to find "Remove" button (filters out comment/reply buttons)
      verifyUnrepostButtonElement = await scanAndScoreUnrepostButton(page, actionContext);
      
      if (verifyUnrepostButtonElement) {
        // Verify it's actually a "Remove" button or unrepost button
        const buttonInfo = await page.evaluate((el) => {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label')?.trim() || '';
          const lowerText = (text + ' ' + ariaLabel).toLowerCase();
          
          // Check if it's "Remove" button (highest priority)
          if (text.toLowerCase() === 'remove' || ariaLabel.toLowerCase().includes('remove')) {
            return { type: 'remove', valid: true };
          }
          // Check if it's unrepost button
          if (lowerText.includes('unrepost') || lowerText.includes('reposted')) {
            return { type: 'unrepost', valid: true };
          }
          return { valid: false };
        }, verifyUnrepostButtonElement).catch(() => ({ valid: false }));
        
        if (buttonInfo && buttonInfo.valid) {
          const buttonType = buttonInfo.type === 'remove' ? 'Remove' : 'Unrepost';
          log(LOG_LEVELS.INFO, `Verification: Found "${buttonType}" button - repost successful (attempt ${retry + 1}/${maxVerificationRetries})`, actionContext);
          verified = true;
          break;
        }
      }
      
      // If not found and not last retry, wait and try again
      if (retry < maxVerificationRetries - 1) {
        log(LOG_LEVELS.DEBUG, `Verification attempt ${retry + 1}/${maxVerificationRetries} failed, retrying...`, actionContext);
        await delay(1500); // Wait between retries
        
        // Scroll to top to ensure buttons are in view
        await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        await delay(500);
      }
    }

    const duration = Date.now() - startTime;

    if (verified && verifyUnrepostButtonElement) {
      log(LOG_LEVELS.INFO, `Post ${postId} reposted successfully (verified)`, { ...actionContext, duration });
      return {
        success: true,
        alreadyReposted: false,
        message: 'Post reposted successfully',
        verified: true,
        duration
      };
    }

    // If verification failed but we clicked, assume success
    log(LOG_LEVELS.WARN, `Post ${postId} repost action completed but verification uncertain`, { ...actionContext, duration });
    return {
      success: true,
      alreadyReposted: false,
      message: 'Repost action completed (verification uncertain)',
      verified: false,
      duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error reposting post ${postId}`, {
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

/**
 * Quote a post with comment
 * @param {Page} page - Playwright page object
 * @param {string} postId - Post ID
 * @param {string} quoteText - Quote text/comment
 * @param {Object} options - Options (username, shortcode, postUrl)
 * @returns {Promise<Object>} Result object with success status
 */
export async function quotePost(page, postId, quoteText, options = {}) {
  const startTime = Date.now();
  const actionContext = { action: 'quote', postId, ...options };

  try {
    if (!CONFIG.interactions.enabled) {
      throw new InteractionError(
        'Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.',
        'INTERACTIONS_DISABLED',
        actionContext
      );
    }

    validatePostId(postId);
    validateCommentText(quoteText);

    const { username, shortcode, postUrl, accountId } = options;
    const config = CONFIG.interactions.repost;

    log(LOG_LEVELS.INFO, `Starting quote action for post ${postId}`, actionContext);

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

    // Quote button doesn't exist directly - need to click repost button first to open modal
    // Then click "Quote" option in the modal
    log(LOG_LEVELS.INFO, `Looking for repost button to open quote modal...`, actionContext);
    
    // Find repost button (same as repostPost)
    const repostButton = await waitForElement(page, CONFIG.selectors.repostButton, {
      timeout: CONFIG.browser.timeouts.normalOperation,
      retries: config.retryAttempts
    });

    if (!repostButton) {
      throw new ElementNotFoundError('Could not find repost button (needed to open quote modal)', 'repostButton', actionContext);
    }

    log(LOG_LEVELS.INFO, `Found repost button, clicking to open modal...`, { ...actionContext, selector: repostButton.selector });
    await delay(config.delayBeforeClick);
    await repostButton.element.click();
    await delay(1500); // Wait for modal to appear

    // Now find and click "Quote" option in the modal
    log(LOG_LEVELS.INFO, `Looking for Quote option in modal...`, actionContext);
    
    const quoteModalSelectors = CONFIG.selectors.quoteModalButton || [
      'button:has-text("Quote")',
      'button[aria-label*="Quote"]',
      'div[role="dialog"] button:has-text("Quote")',
      'div[role="menu"] button:has-text("Quote")',
      '[data-testid*="quote"] button'
    ];

    let quoteModalClicked = false;
    for (const selector of quoteModalSelectors) {
      try {
        const modalButton = await page.waitForSelector(selector, {
          timeout: CONFIG.browser.timeouts.quickCheck,
          state: 'visible'
        }).catch(() => null);
        
        if (modalButton) {
          const isVisible = await modalButton.isVisible().catch(() => false);
          if (isVisible) {
            log(LOG_LEVELS.INFO, `Found Quote option in modal, clicking...`, { ...actionContext, selector });
            await delay(500);
            await modalButton.click();
            quoteModalClicked = true;
            await delay(1000); // Wait for quote input to appear
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // If modal button not found, try alternative approach
    if (!quoteModalClicked) {
      log(LOG_LEVELS.DEBUG, `Quote modal button not found with selectors, trying alternative approach...`, actionContext);
      
      try {
        // Wait a bit more for modal to fully render
        await delay(1000);
        
        // Find all visible buttons/elements in dialogs/menus
        const modalElements = await page.evaluate(() => {
          const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], div[role="menu"], [data-testid*="menu"], [data-testid*="dialog"]'));
          const allElements = [];
          
          dialogs.forEach(dialog => {
            const buttons = Array.from(dialog.querySelectorAll('button, div[role="button"], a, span[role="button"]'));
            buttons.forEach(btn => {
              const text = btn.textContent?.trim() || '';
              const ariaLabel = btn.getAttribute('aria-label') || '';
              const isVisible = btn.offsetParent !== null;
              
              if (isVisible) {
                allElements.push({
                  tag: btn.tagName,
                  text: text,
                  ariaLabel: ariaLabel,
                  className: btn.className,
                  id: btn.id
                });
              }
            });
          });
          
          return allElements;
        }).catch(() => []);

        log(LOG_LEVELS.DEBUG, `Found ${modalElements.length} elements in modal:`, { 
          ...actionContext, 
          elements: modalElements.slice(0, 10) // Log first 10
        });
        
        // Try to find quote by text content
        const quoteElements = modalElements.filter(el => 
          el.text.toLowerCase().includes('quote') || 
          el.ariaLabel.toLowerCase().includes('quote')
        );
        
        if (quoteElements.length > 0) {
          log(LOG_LEVELS.INFO, `Found ${quoteElements.length} quote-related elements:`, { 
            ...actionContext, 
            quoteElements 
          });
          
          // Try to click using various selectors
          const clickSelectors = [
            `button:has-text("${quoteElements[0].text}")`,
            `div[role="button"]:has-text("${quoteElements[0].text}")`,
            `span:has-text("${quoteElements[0].text}")`,
            `a:has-text("${quoteElements[0].text}")`
          ];
          
          for (const selector of clickSelectors) {
            try {
              const element = await page.$(selector).catch(() => null);
              if (element) {
                const isVisible = await element.isVisible().catch(() => false);
                if (isVisible) {
                  log(LOG_LEVELS.INFO, `Clicking quote element using selector: ${selector}`, actionContext);
                  await delay(500);
                  await element.click();
                  quoteModalClicked = true;
                  await delay(1000);
                  break;
                }
              }
            } catch (e) {
              // Continue
            }
          }
        }
        
        // If still not found, try clicking by index (second button in modal is usually Quote)
        if (!quoteModalClicked) {
          log(LOG_LEVELS.DEBUG, `Trying to click second button in modal (usually Quote)...`, actionContext);
          try {
            const modalButtons = await page.$$('div[role="dialog"] button, div[role="menu"] button').catch(() => []);
            if (modalButtons.length >= 2) {
              // Second button is usually Quote
              const secondButton = modalButtons[1];
              const isVisible = await secondButton.isVisible().catch(() => false);
              if (isVisible) {
                const buttonText = await secondButton.textContent().catch(() => '');
                log(LOG_LEVELS.INFO, `Clicking second button in modal (text: "${buttonText}")`, actionContext);
                await delay(500);
                await secondButton.click();
                quoteModalClicked = true;
                await delay(1000);
              }
            }
          } catch (e) {
            log(LOG_LEVELS.DEBUG, `Clicking by index failed: ${e.message}`, actionContext);
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Alternative modal approach failed: ${e.message}`, actionContext);
      }
    }

    if (!quoteModalClicked) {
      // Log final debug info before throwing
      try {
        const screenshot = await page.screenshot({ encoding: 'base64' }).catch(() => null);
        log(LOG_LEVELS.ERROR, `Could not find Quote option in modal. Modal elements logged above.`, {
          ...actionContext,
          screenshotAvailable: screenshot !== null
        });
      } catch (e) {
        // Ignore screenshot errors
      }
      
      throw new ElementNotFoundError('Could not find Quote option in modal', 'quoteModalButton', actionContext);
    }

    // Wait a bit more for quote input to appear after clicking Quote option
    await delay(2000);
    
    // Find quote input
    log(LOG_LEVELS.INFO, `Looking for quote input field...`, actionContext);
    const quoteInput = await waitForElement(page, CONFIG.selectors.quoteInput, {
      timeout: CONFIG.browser.timeouts.longOperation,
      retries: 5
    });

    if (!quoteInput) {
      // Debug: log available input fields
      const inputs = await page.evaluate(() => {
        const allInputs = Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"]'));
        return allInputs
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            placeholder: el.placeholder || '',
            role: el.getAttribute('role') || '',
            contentEditable: el.getAttribute('contenteditable') || '',
            className: el.className.substring(0, 50)
          }));
      }).catch(() => []);
      
      log(LOG_LEVELS.ERROR, `Could not find quote input. Available inputs:`, { ...actionContext, inputs });
      throw new ElementNotFoundError('Could not find quote input', 'quoteInput', actionContext);
    }

    log(LOG_LEVELS.INFO, `Found quote input, typing text...`, { ...actionContext, selector: quoteInput.selector });
    
    // Type quote text
    await quoteInput.element.click();
    await delay(500);
    
    const tagName = await quoteInput.element.evaluate(el => el.tagName.toLowerCase());
    const isContentEditable = await quoteInput.element.evaluate(el => el.contentEditable === 'true').catch(() => false);
    
    log(LOG_LEVELS.INFO, `Input type: ${tagName}, contentEditable: ${isContentEditable}`, actionContext);
    
    if (tagName === 'div' || isContentEditable) {
      // For contentEditable, we need to use a different approach
      // Method 1: Focus and use keyboard.type
      log(LOG_LEVELS.INFO, `Typing into contentEditable using keyboard...`, actionContext);
      await quoteInput.element.focus();
      await delay(300);
      
      // Clear existing content first
      await quoteInput.element.evaluate(el => {
        el.textContent = '';
        el.innerText = '';
      });
      await delay(200);
      
      // Type character by character using keyboard
      await page.keyboard.type(quoteText, { delay: CONFIG.interactions.comment.typingSpeed });
      await delay(500);
      
      // Verify and trigger events
      await quoteInput.element.evaluate((el, text) => {
        // Ensure text is set
        if (el.textContent !== text && el.innerText !== text) {
          el.textContent = text;
          el.innerText = text;
        }
        
        // Trigger input events
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        el.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        el.dispatchEvent(changeEvent);
        
        // Also trigger composition events (sometimes needed)
        const compositionStart = new CompositionEvent('compositionstart', { bubbles: true });
        const compositionUpdate = new CompositionEvent('compositionupdate', { bubbles: true, data: text });
        const compositionEnd = new CompositionEvent('compositionend', { bubbles: true, data: text });
        el.dispatchEvent(compositionStart);
        el.dispatchEvent(compositionUpdate);
        el.dispatchEvent(compositionEnd);
      }, quoteText);
      
      log(LOG_LEVELS.INFO, `Typed quote text using keyboard.type with events`, actionContext);
    } else {
      await quoteInput.element.fill('');
      await delay(200);
      for (const char of quoteText) {
        await quoteInput.element.type(char, { delay: CONFIG.interactions.comment.typingSpeed });
      }
      log(LOG_LEVELS.INFO, `Typed quote text character by character`, actionContext);
    }

    // Wait longer for submit button to become enabled
    await delay(2000);

    // Verify text was entered
    let enteredText = await quoteInput.element.evaluate(el => {
      if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
        return el.value || '';
      }
      return (el.textContent || el.innerText || '').trim();
    }).catch(() => '');
    
    log(LOG_LEVELS.INFO, `Entered text length: ${enteredText.length}, expected: ${quoteText.length}`, actionContext);
    
    // If text is not entered correctly, try alternative methods
    if (enteredText.length < quoteText.length * 0.8) { // Allow 20% tolerance
      log(LOG_LEVELS.WARN, `Text not fully entered (${enteredText.length}/${quoteText.length}), trying alternative methods...`, actionContext);
      
      // Method 1: Clear and retry with keyboard.type
      try {
        await quoteInput.element.focus();
        await delay(200);
        
        // Select all and delete
        await page.keyboard.press('Control+a');
        await delay(100);
        await page.keyboard.press('Delete');
        await delay(200);
        
        // Type again
        await page.keyboard.type(quoteText, { delay: CONFIG.interactions.comment.typingSpeed });
        await delay(500);
        
        // Verify again
        enteredText = await quoteInput.element.evaluate(el => {
          if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
            return el.value || '';
          }
          return (el.textContent || el.innerText || '').trim();
        }).catch(() => '');
        
        log(LOG_LEVELS.INFO, `After retry, entered text length: ${enteredText.length}`, actionContext);
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Retry typing failed: ${e.message}`, actionContext);
      }
      
      // Method 2: If still not working, try setting directly with events
      if (enteredText.length < quoteText.length * 0.8) {
        try {
          await quoteInput.element.evaluate((el, text) => {
            // Clear first
            el.textContent = '';
            el.innerText = '';
            
            // Set text
            el.textContent = text;
            el.innerText = text;
            
            // Set innerHTML if needed
            if (el.innerHTML !== text) {
              el.innerHTML = text;
            }
            
            // Trigger all necessary events
            const events = ['focus', 'input', 'change', 'keyup', 'keydown'];
            events.forEach(eventType => {
              const event = new Event(eventType, { bubbles: true, cancelable: true });
              el.dispatchEvent(event);
            });
          }, quoteText);
          
          await delay(500);
          
          // Verify again
          enteredText = await quoteInput.element.evaluate(el => {
            if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
              return el.value || '';
            }
            return (el.textContent || el.innerText || '').trim();
          }).catch(() => '');
          
          log(LOG_LEVELS.INFO, `After direct set, entered text length: ${enteredText.length}`, actionContext);
        } catch (e) {
          log(LOG_LEVELS.DEBUG, `Direct set failed: ${e.message}`, actionContext);
        }
      }
    }
    
    // Final check
    if (enteredText.length < quoteText.length * 0.5) {
      log(LOG_LEVELS.ERROR, `Failed to enter quote text properly. Entered: ${enteredText.length} chars, Expected: ${quoteText.length}`, actionContext);
      throw new InteractionError(
        `Failed to enter quote text. Only ${enteredText.length} characters entered out of ${quoteText.length}`,
        'TEXT_ENTRY_FAILED',
        actionContext
      );
    }

    // Scroll to make sure submit button is visible
    try {
      await quoteInput.element.scrollIntoViewIfNeeded();
      await delay(500);
    } catch (e) {
      // Ignore scroll errors
    }

    // Wait a bit for submit button to appear (sometimes it appears after typing)
    await delay(2000);

    // Find and click submit button (similar to comment)
    log(LOG_LEVELS.INFO, `Looking for submit button...`, actionContext);
    
    // Try multiple methods to find submit button
    let submitButton = null;
    let submitMethod = null;
    
    // Method 1: Use getCommentSubmitButton
    submitButton = await getCommentSubmitButton(page);
    if (submitButton) {
      submitMethod = 'getCommentSubmitButton';
    }
    
    // Method 2: Try to find button with "Post" text (exact match, not "Repost")
    if (!submitButton) {
      log(LOG_LEVELS.DEBUG, `Trying to find button with "Post" text (exact match)...`, actionContext);
      
      // First, find all buttons and filter by exact text match
      try {
        const allButtons = await page.$$('button, div[role="button"], span[role="button"]').catch(() => []);
        for (const btn of allButtons) {
          try {
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) continue;
            
            const text = (await btn.textContent().catch(() => '') || '').trim();
            const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '').trim();
            
            // Look for exact "Post" text (not "Repost")
            if (text === 'Post' || ariaLabel.toLowerCase() === 'post') {
              const isEnabled = await btn.isEnabled().catch(() => true);
              if (isEnabled) {
                log(LOG_LEVELS.INFO, `Found submit button with exact "Post" text: "${text}", ariaLabel: "${ariaLabel}"`, actionContext);
                submitButton = btn;
                submitMethod = `exact match: "${text}"`;
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Exact match search failed: ${e.message}`, actionContext);
      }
      
      // Fallback to selectors
      if (!submitButton) {
        const postButtonSelectors = [
          'button:has-text("Post")',
          'button[aria-label*="Post" i]',
          'button:has-text("Share")',
          'button[aria-label*="Share" i]',
          'button[type="submit"]',
          'div[role="button"]:has-text("Post")',
          'span[role="button"]:has-text("Post")'
        ];
        
        for (const selector of postButtonSelectors) {
          try {
            const btn = await page.$(selector).catch(() => null);
            if (btn) {
              const isVisible = await btn.isVisible().catch(() => false);
              const isEnabled = await btn.isEnabled().catch(() => true);
              const text = await btn.textContent().catch(() => '');
              
              // Skip if text contains "Repost"
              if (text.toLowerCase().includes('repost') && !text.toLowerCase().includes('post ')) {
                continue;
              }
              
              if (isVisible && isEnabled) {
                log(LOG_LEVELS.INFO, `Found submit button with selector: ${selector}, text: "${text}"`, actionContext);
                submitButton = btn;
                submitMethod = `selector: ${selector}`;
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
      }
    }
    
    // Method 3: Find all buttons and look for submit-like ones
    if (!submitButton) {
      log(LOG_LEVELS.DEBUG, `Trying to find submit button by scanning all buttons...`, actionContext);
      try {
        const allButtons = await page.$$('button, div[role="button"], span[role="button"]').catch(() => []);
        log(LOG_LEVELS.DEBUG, `Found ${allButtons.length} potential buttons`, actionContext);
        
        for (const btn of allButtons) {
          try {
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) continue;
            
            const text = (await btn.textContent().catch(() => '') || '').trim();
            const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '').trim();
            const type = await btn.getAttribute('type').catch(() => '');
            const className = await btn.getAttribute('class').catch(() => '');
            
            const lowerText = text.toLowerCase();
            const lowerAria = ariaLabel.toLowerCase();
            
            // Check if it looks like a submit button
            if (
              lowerText.includes('post') ||
              lowerText.includes('share') ||
              lowerText.includes('publish') ||
              lowerAria.includes('post') ||
              lowerAria.includes('share') ||
              type === 'submit' ||
              className.includes('submit') ||
              className.includes('post')
            ) {
              log(LOG_LEVELS.INFO, `Found potential submit button: text="${text}", ariaLabel="${ariaLabel}"`, actionContext);
              submitButton = btn;
              submitMethod = `scanned: text="${text}"`;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Button scanning failed: ${e.message}`, actionContext);
      }
    }
    
    // Try to click submit button
    if (submitButton) {
      log(LOG_LEVELS.INFO, `Found submit button (${submitMethod}), checking if enabled...`, actionContext);
      
      // Check if button is enabled
      let isEnabled = true;
      try {
        isEnabled = await submitButton.isEnabled().catch(() => true);
        const buttonText = await submitButton.textContent().catch(() => '');
        log(LOG_LEVELS.INFO, `Button enabled: ${isEnabled}, text: "${buttonText}"`, actionContext);
        
        if (!isEnabled) {
          log(LOG_LEVELS.WARN, `Button is disabled, waiting for it to become enabled...`, actionContext);
          // Wait for button to become enabled (sometimes it takes time after typing)
          for (let i = 0; i < 10; i++) {
            await delay(500);
            isEnabled = await submitButton.isEnabled().catch(() => true);
            if (isEnabled) {
              log(LOG_LEVELS.INFO, `Button is now enabled after ${(i + 1) * 500}ms`, actionContext);
              break;
            }
          }
        }
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Error checking button state: ${e.message}`, actionContext);
      }
      
      // Scroll button into view
      try {
        await submitButton.scrollIntoViewIfNeeded();
        await delay(500);
      } catch (e) {
        // Ignore
      }
      
      log(LOG_LEVELS.INFO, `Attempting to click submit button...`, actionContext);
      let clicked = false;
      
      // Method 1: Try normal click with force
      try {
        await submitButton.click({ force: true, timeout: CONFIG.browser.timeouts.normalOperation });
        await delay(1000);
        clicked = true;
        log(LOG_LEVELS.INFO, `Submit button clicked successfully (force)`, actionContext);
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Force click failed: ${e.message}`, actionContext);
      }
      
      // Method 2: Try JavaScript click with event dispatch
      if (!clicked) {
        try {
          await submitButton.evaluate(btn => {
            // Try multiple ways to trigger click
            if (btn.click) {
              btn.click();
            } else if (btn.dispatchEvent) {
              const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              btn.dispatchEvent(clickEvent);
            }
            
            // Also try mousedown + mouseup
            const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
            btn.dispatchEvent(mouseDownEvent);
            btn.dispatchEvent(mouseUpEvent);
          });
          await delay(1000);
          clicked = true;
          log(LOG_LEVELS.INFO, `Submit button clicked via JavaScript with events`, actionContext);
        } catch (e2) {
          log(LOG_LEVELS.DEBUG, `JavaScript click with events failed: ${e2.message}`, actionContext);
        }
      }
      
      // Method 3: Try clicking parent element
      if (!clicked) {
        try {
          const parent = await submitButton.evaluateHandle(btn => btn.parentElement);
          if (parent) {
            await parent.click({ force: true, timeout: CONFIG.browser.timeouts.quickCheck });
            await delay(1000);
            clicked = true;
            log(LOG_LEVELS.INFO, `Parent element clicked`, actionContext);
          }
        } catch (e3) {
          log(LOG_LEVELS.DEBUG, `Parent click failed: ${e3.message}`, actionContext);
        }
      }
      
      // Method 4: Try keyboard navigation and Enter
      if (!clicked) {
        try {
          await submitButton.focus();
          await delay(300);
          await page.keyboard.press('Enter');
          await delay(1000);
          clicked = true;
          log(LOG_LEVELS.INFO, `Submit button activated via Enter key`, actionContext);
        } catch (e4) {
          log(LOG_LEVELS.DEBUG, `Enter key on button failed: ${e4.message}`, actionContext);
        }
      }
      
      // Method 5: Try Space key
      if (!clicked) {
        try {
          await submitButton.focus();
          await delay(300);
          await page.keyboard.press('Space');
          await delay(1000);
          clicked = true;
          log(LOG_LEVELS.INFO, `Submit button activated via Space key`, actionContext);
        } catch (e5) {
          log(LOG_LEVELS.DEBUG, `Space key on button failed: ${e5.message}`, actionContext);
        }
      }
      
      if (!clicked) {
        log(LOG_LEVELS.WARN, `All click methods failed, but continuing...`, actionContext);
      }
      
      await delay(config.delayAfterClick);
    } else {
      // Try multiple keyboard shortcuts
      log(LOG_LEVELS.INFO, `Submit button not found, trying keyboard shortcuts...`, actionContext);
      
      // Focus on input first
      await quoteInput.element.focus();
      await delay(300);
      
      // Try Ctrl+Enter (common for posting)
      try {
        log(LOG_LEVELS.INFO, `Trying Ctrl+Enter...`, actionContext);
        await page.keyboard.press('Control+Enter');
        await delay(config.delayAfterClick);
        log(LOG_LEVELS.INFO, `Ctrl+Enter pressed`, actionContext);
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Ctrl+Enter failed: ${e.message}`, actionContext);
      }
      
      // Try Enter
      try {
        log(LOG_LEVELS.INFO, `Trying Enter key...`, actionContext);
        await quoteInput.element.press('Enter');
        await delay(config.delayAfterClick);
        log(LOG_LEVELS.INFO, `Enter key pressed`, actionContext);
      } catch (e) {
        log(LOG_LEVELS.DEBUG, `Enter key failed: ${e.message}`, actionContext);
      }
      
      // Try clicking outside the input (sometimes triggers submit)
      try {
        log(LOG_LEVELS.INFO, `Trying to click outside input...`, actionContext);
        await page.mouse.click(100, 100);
        await delay(500);
      } catch (e) {
        // Ignore
      }
    }

    // Wait a bit to ensure submission
    await delay(3000);
    
    // Verify submission by checking if quote input disappeared or modal closed
    log(LOG_LEVELS.INFO, `Verifying quote submission...`, actionContext);
    let verified = false;
    let verificationDetails = {};
    
    try {
      const inputStillVisible = await quoteInput.element.isVisible().catch(() => false);
      const modalStillOpen = await page.$('div[role="dialog"]').catch(() => null);
      
      if (!inputStillVisible && !modalStillOpen) {
        verified = true;
        verificationDetails = { method: 'modal_closed', inputVisible: false, modalOpen: false };
        log(LOG_LEVELS.INFO, `Quote submission verified: input/modal closed`, actionContext);
      } else {
        verificationDetails = { method: 'modal_check', inputVisible: inputStillVisible, modalOpen: !!modalStillOpen };
        log(LOG_LEVELS.WARN, `Quote submission uncertain: input still visible=${inputStillVisible}, modal still open=${!!modalStillOpen}`, actionContext);
        
        // Additional check: wait a bit more and check again
        await delay(2000);
        const inputStillVisible2 = await quoteInput.element.isVisible().catch(() => false);
        const modalStillOpen2 = await page.$('div[role="dialog"]').catch(() => null);
        
        if (!inputStillVisible2 && !modalStillOpen2) {
          verified = true;
          verificationDetails = { method: 'modal_closed_delayed', inputVisible: false, modalOpen: false };
          log(LOG_LEVELS.INFO, `Quote submission verified after additional wait: input/modal closed`, actionContext);
        }
      }
      
      // Check if we're back to the post page (another sign of success)
      const currentUrl = page.url();
      if (currentUrl.includes('/post/') || currentUrl.includes('threads.net')) {
        verificationDetails.url = currentUrl;
        if (!inputStillVisible && !modalStillOpen) {
          verified = true;
        }
      }
    } catch (e) {
      log(LOG_LEVELS.DEBUG, `Verification check failed: ${e.message}`, actionContext);
      verificationDetails.error = e.message;
    }

    const duration = Date.now() - startTime;
    log(LOG_LEVELS.INFO, `Post ${postId} quote action completed`, { 
      ...actionContext, 
      duration,
      verified,
      verificationDetails
    });
    
    return {
      success: true,
      message: verified ? 'Post quoted successfully (verified)' : 'Post quote action completed (verification uncertain)',
      verified: verified,
      verificationDetails: verificationDetails,
      duration: duration
    };

  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    const errorInfo = await handleInteractionError(classifiedError, { page, ...actionContext });
    
    log(LOG_LEVELS.ERROR, `Error quoting post ${postId}`, {
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


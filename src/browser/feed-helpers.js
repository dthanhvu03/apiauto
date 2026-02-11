/**
 * Feed Helper Functions
 * 
 * Helper functions for waiting and analyzing feed loading
 */

import { CONFIG } from '../config.js';

/**
 * Wait for feed to appear in DOM
 * WHY: Feed may load asynchronously, need to wait before extraction
 * FRAGILE: Selectors may change, but we have fallbacks
 */
export async function waitForFeedRender(page, config = CONFIG) {
  console.log('[WAIT] Waiting for feed to render...');

  const selectors = config.selectors?.feed || CONFIG.selectors.feed;
  const selectorTimeout = config.browser?.timeouts?.selector || config.browser?.waitForSelectorTimeout || CONFIG.browser.waitForSelectorTimeout;
  const waitAfterNav = config.browser?.waitAfterNavigation || CONFIG.browser.waitAfterNavigation;
  const url = page.url();

  // Try each selector with timeout
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: selectorTimeout });
      console.log(`[WAIT] Feed found using selector: ${selector}`);
      return true;
    } catch (e) {
      // If it's a timeout error, log it with context
      if (e.name === 'TimeoutError' || e.message?.includes('timeout')) {
        console.log(`[WAIT] Selector "${selector}" timed out after ${selectorTimeout}ms`);
      }
      // Try next selector
      continue;
    }
  }

  // If no selector worked, wait a bit anyway (feed might be loading)
  await page.waitForTimeout(waitAfterNav);
  console.log(`[WAIT] Feed may not be visible after trying ${selectors.length} selectors (timeout: ${selectorTimeout}ms each), proceeding anyway...`);
  console.log(`[WAIT] URL: ${url}`);
  return false;
}

/**
 * Analyze how Threads loads feed data
 * WHY: Determine the most reliable extraction method
 * 
 * Checks:
 * 1. GraphQL responses (most reliable if available)
 * 2. Window-level preloaded data (SSR or initial state)
 * 3. DOM structure (fallback)
 */
export async function analyzeFeedLoading(page, config = CONFIG) {
  const analysis = {
    hasGraphQL: false,
    hasWindowGlobals: false,
    hasSSRData: false,
    feedSource: null
  };

  const windowGlobals = config.windowGlobals || CONFIG.windowGlobals;

  // Check for window-level globals
  for (const globalName of windowGlobals) {
    try {
      const exists = await page.evaluate((name) => {
        // Handle nested paths like 'window.__relayStore'
        const parts = name.split('.');
        let obj = window;
        for (const part of parts) {
          if (obj && typeof obj[part] !== 'undefined') {
            obj = obj[part];
          } else {
            return false;
          }
        }
        return obj !== null && obj !== undefined;
      }, globalName);

      if (exists) {
        analysis.hasWindowGlobals = true;
        analysis.feedSource = `window.${globalName}`;
        break;
      }
    } catch (e) {
      // Continue checking other globals
    }
  }

  // Check for SSR data in script tags
  const ssrData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        // Look for feed-like structures
        if (data && typeof data === 'object') {
          const str = JSON.stringify(data);
          if (str.includes('edges') || str.includes('feed') || str.includes('timeline')) {
            return true;
          }
        }
      } catch (e) {
        // Not valid JSON
      }
    }
    return false;
  });

  analysis.hasSSRData = ssrData;

  // Log findings
  console.log('[ANALYSIS] Feed Loading Strategy:');
  console.log(`  - Window globals: ${analysis.hasWindowGlobals ? 'YES' : 'NO'}`);
  console.log(`  - SSR data: ${analysis.hasSSRData ? 'YES' : 'NO'}`);
  console.log(`  - GraphQL: Will be checked during navigation`);

  return analysis;
}

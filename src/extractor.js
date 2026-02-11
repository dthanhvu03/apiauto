/**
 * Main Feed Extractor
 * 
 * Orchestrates the entire extraction process
 */

import { CONFIG, getSessionPath } from './config.js';
import { launchBrowser, closeBrowser } from './browser/browser-manager.js';
import { scrollFeed } from './browser/scrolling.js';
import { waitForFeedRender, analyzeFeedLoading } from './browser/feed-helpers.js';
import { setupGraphQLInterceptor } from './network/graphql-interceptor.js';
import { extractFeedItems } from './extractors/index.js';
import { normalizeFeedItem } from './normalizers/index.js';
import { collectFromPostDetailPage, fullInspection } from './utils/shortcode-browser-inspector.js';
import { collectFromURL } from './utils/shortcode-research.js';
import { loadSession } from './interactions/session.js';

/**
 * Extract feed data from Threads
 * This function can be called from both CLI and API
 * Returns all extracted items (filtering should be done externally)
 * 
 * @param {Object} options - Extraction options
 * @param {string} [options.targetUrl=CONFIG.threads.url] - URL to navigate to (home feed or user profile)
 * @param {number|null} options.maxItems - Maximum items to extract (null = no limit)
 * @param {string|null} options.accountId - Optional account ID for account-specific session and browser profile
 * @param {string|null} options.profilePath - Optional custom profile path provided by client
 * @param {Browser|null} options.browser - Optional browser instance to reuse (if provided, context must also be provided)
 * @param {BrowserContext|null} options.context - Optional browser context to reuse (if provided, browser must also be provided)
 * @returns {Promise<Array>} Array of normalized feed items (unfiltered)
 */
export async function extractFeedData(options = {}) {
  const {
    targetUrl = CONFIG.threads.url, // Default to home feed, can be overridden for user profiles
    maxItems = CONFIG.extraction.maxItems,
    accountId = null,
    profilePath = null,
    browser: providedBrowser = null,
    context: providedContext = null
  } = options;

  let browser = providedBrowser;
  let context = providedContext;
  let shouldCloseBrowser = false;

  // Only launch if not provided
  if (!browser || !context) {
    const browserData = await launchBrowser(accountId, profilePath);
    browser = browserData.browser;
    context = browserData.context;
    shouldCloseBrowser = true; // Mark for cleanup
  }
  
  // Load saved session if available (for authenticated requests)
  const sessionPath = getSessionPath(accountId);
  if (CONFIG.interactions?.enabled && sessionPath) {
    try {
      const sessionLoaded = await loadSession(context, sessionPath);
      if (sessionLoaded) {
        console.log(`[EXTRACT] Session loaded for authenticated feed extraction (account: ${accountId || 'default'})`);
      }
    } catch (error) {
      // Session loading failed, continue without it
      console.log('[EXTRACT] Could not load session, continuing without authentication');
    }
  }
  
  const page = await context.newPage();

  try {
    // Setup network interception BEFORE navigation
    const graphqlResponses = setupGraphQLInterceptor(context, CONFIG);

    // Navigate to target URL (home feed or user profile)
    console.log(`[NAVIGATE] Opening ${targetUrl}...`);
    const navigationTimeout = CONFIG.browser.timeouts.navigation || CONFIG.browser.navigationTimeout;
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded', // Use domcontentloaded instead of networkidle for faster loading
        timeout: navigationTimeout
      });
    } catch (error) {
      // If timeout, try with load event instead
      if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        console.log(`[NAVIGATE] Timeout (${navigationTimeout}ms) with domcontentloaded, trying with load event...`);
        try {
          await page.goto(targetUrl, {
            waitUntil: 'load',
            timeout: navigationTimeout
          });
        } catch (retryError) {
          // Enhanced timeout error with context
          const timeoutError = new Error(
            `Navigation to ${targetUrl} timed out after ${navigationTimeout}ms. ` +
            `Operation: feed_extraction, URL: ${targetUrl}`
          );
          timeoutError.name = 'TimeoutError';
          timeoutError.timeout = navigationTimeout;
          timeoutError.url = targetUrl;
          timeoutError.operation = 'feed_extraction';
          throw timeoutError;
        }
      } else {
        throw error;
      }
    }

    // Wait for feed to render
    await waitForFeedRender(page, CONFIG);

    // Analyze feed loading strategy
    const analysis = await analyzeFeedLoading(page, CONFIG);
    console.log(`[ANALYSIS] Recommended source: ${analysis.feedSource || 'GraphQL'}\n`);

    // Scroll to trigger lazy loading
    // Calculate scroll attempts based on maxItems
    // More items = more scrolling needed
    let scrollConfig = { ...CONFIG };
    if (maxItems && maxItems > 30) {
      // For large maxItems, increase scroll attempts
      // Rough estimate: ~25 posts per 10 scrolls, so for 500 posts we need ~200 scrolls
      // But we also need to account for initial posts (usually ~10-15)
      const postsNeeded = maxItems - 15; // Subtract initial posts
      const estimatedScrolls = Math.ceil((postsNeeded / 25) * 10);
      const maxScrollAttempts = Math.min(Math.max(estimatedScrolls, 20), 300); // Min 20, max 300 to avoid infinite scrolling
      scrollConfig = {
        ...CONFIG,
        scroll: {
          ...CONFIG.scroll,
          maxAttempts: maxScrollAttempts
        }
      };
      console.log(`[SCROLL] Adjusted scroll attempts to ${maxScrollAttempts} for maxItems=${maxItems} (estimated ${postsNeeded} additional posts needed)`);
    }
    await scrollFeed(page, scrollConfig);

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(CONFIG.browser.waitAfterScroll);

    // Extract feed items using multiple strategies
    // NOTE: feedItems are already normalized by extractFeedItems()
    let normalizedItems = await extractFeedItems(page, graphqlResponses, normalizeFeedItem);

    // Apply max items limit if configured
    if (maxItems && normalizedItems.length > maxItems) {
      normalizedItems = normalizedItems.slice(0, maxItems);
      console.log(`[EXTRACT] Limited to ${maxItems} items`);
    }

    return normalizedItems;

  } catch (error) {
    console.error('[ERROR]', error);
    throw error;
  } finally {
    // Only close if we created the browser
    if (shouldCloseBrowser) {
      await closeBrowser(browser, context);
    }
  }
}

/**
 * Extract posts from a specific user's profile page
 * 
 * @param {string} username - Username (with or without @ prefix)
 * @param {Object} options - Extraction options (same as extractFeedData)
 * @param {Browser|null} options.browser - Optional browser instance to reuse
 * @param {BrowserContext|null} options.context - Optional browser context to reuse
 * @returns {Promise<Array>} Array of normalized feed items from user profile
 */
export async function extractUserPosts(username, options = {}) {
  // Remove @ if present
  const cleanUsername = username.replace(/^@/, '');
  
  // Validate username
  if (!cleanUsername || cleanUsername.length === 0) {
    throw new Error('Username is required');
  }
  
  // Validate username format (basic check)
  if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
    throw new Error(`Invalid username format: ${cleanUsername}`);
  }
  
  // Construct profile URL
  const profileUrl = `${CONFIG.threads.url}/@${cleanUsername}`;
  
  console.log(`[USER PROFILE] Extracting posts from @${cleanUsername}...`);
  
  // Extract using existing logic with profile URL
  // Note: extractFeedData will automatically load session if available
  // Pass accountId, browser, and context through to extractFeedData
  return await extractFeedData({
    ...options,
    targetUrl: profileUrl,
    browser: options.browser,
    context: options.context
  });
}

/**
 * Collect shortcode from a post detail page
 * Navigates to post URL and extracts shortcode/post_id pair
 * 
 * @param {string} postUrl - Full URL to post (e.g., https://www.threads.com/@username/post/SHORTCODE)
 * @param {string} [expectedPostId] - Expected post_id to verify
 * @returns {Promise<Object|null>} { post_id, shortcode } or null if failed
 */
export async function collectShortcodeFromPostUrl(postUrl, expectedPostId = null, profilePath = null) {
  const { browser, context } = await launchBrowser(null, profilePath);
  const page = await context.newPage();

  try {
    console.log(`[SHORTCODE COLLECT] Navigating to: ${postUrl}`);
    
    // Navigate to post detail page
    await page.goto(postUrl, {
      waitUntil: 'networkidle',
      timeout: CONFIG.browser.navigationTimeout
    });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Extract shortcode and post_id from page
    const result = await collectFromPostDetailPage(page, postUrl);
    
    if (result) {
      // Also collect from URL
      const urlResult = collectFromURL(postUrl, result.post_id);
      
      // Verify if expected post_id matches
      if (expectedPostId && result.post_id !== expectedPostId) {
        console.warn(`[SHORTCODE COLLECT] Warning: Expected post_id ${expectedPostId}, got ${result.post_id}`);
      }
      
      return result;
    }

    return null;
  } catch (error) {
    console.error('[SHORTCODE COLLECT] Error:', error.message);
    return null;
  } finally {
    await closeBrowser(browser, context);
  }
}

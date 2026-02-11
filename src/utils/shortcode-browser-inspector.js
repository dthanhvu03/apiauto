/**
 * Browser Inspector for Shortcode Encoding
 * 
 * Inspects browser runtime to find Threads' shortcode encoding logic
 */

import { CONFIG } from '../config.js';

/**
 * Inspect window object for encoding functions
 */
export async function inspectWindowObject(page) {
  try {
    const windowFunctions = await page.evaluate(() => {
      const functions = {};
      
      // Search for functions with "encode", "decode", "shortcode", "code" in name
      for (const key in window) {
        try {
          if (typeof window[key] === 'function') {
            const funcName = key.toLowerCase();
            if (funcName.includes('encode') || 
                funcName.includes('decode') || 
                funcName.includes('shortcode') || 
                funcName.includes('code')) {
              functions[key] = 'function';
            }
          }
        } catch (e) {
          // Ignore access errors
        }
      }
      
      return functions;
    });

    if (Object.keys(windowFunctions).length > 0) {
      console.log('[SHORTCODE INSPECTOR] Found potential encoding functions in window:', Object.keys(windowFunctions));
    }

    return windowFunctions;
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error inspecting window object:', error.message);
    return {};
  }
}

/**
 * Inspect React/Relay store for shortcode mappings
 */
export async function inspectRelayStore(page) {
  try {
    const storeData = await page.evaluate(() => {
      const results = {};
      
      // Check for Relay store
      if (window.__RELAY_STORE__) {
        results.hasRelayStore = true;
        results.relayStoreKeys = Object.keys(window.__RELAY_STORE__).slice(0, 20);
      }
      
      // Check for React DevTools
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        results.hasReactDevTools = true;
      }
      
      // Check for any global stores
      const storeKeys = Object.keys(window).filter(k => 
        k.toLowerCase().includes('store') || 
        k.toLowerCase().includes('cache') ||
        k.toLowerCase().includes('relay')
      );
      results.storeKeys = storeKeys;
      
      return results;
    });

    if (storeData.hasRelayStore || storeData.storeKeys?.length > 0) {
      console.log('[SHORTCODE INSPECTOR] Found store data:', storeData);
    }

    return storeData;
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error inspecting Relay store:', error.message);
    return {};
  }
}

/**
 * Extract shortcode from current page URL
 */
export async function extractShortcodeFromURL(page) {
  try {
    const url = page.url();
    const match = url.match(/\/post\/([A-Za-z0-9_-]+)/);
    if (match) {
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error extracting shortcode from URL:', error.message);
    return null;
  }
}

/**
 * Extract post_id from page data/state
 */
export async function extractPostIdFromPage(page) {
  try {
    const postId = await page.evaluate(() => {
      // Try to find post_id in various places
      // Check for data attributes
      const postElement = document.querySelector('[data-post-id]');
      if (postElement) {
        return postElement.getAttribute('data-post-id');
      }
      
      // Check for meta tags
      const metaPostId = document.querySelector('meta[property="og:url"]');
      if (metaPostId) {
        const url = metaPostId.getAttribute('content');
        const match = url.match(/\/post\/(\d+)/);
        if (match) return match[1];
      }
      
      // Check window.__INITIAL_DATA__ or similar
      if (window.__INITIAL_DATA__) {
        const data = window.__INITIAL_DATA__;
        // Try to find post_id in nested structure
        const findPostId = (obj, depth = 0) => {
          if (depth > 5) return null;
          if (!obj || typeof obj !== 'object') return null;
          
          if (obj.pk || obj.post_id || obj.thread_id) {
            return obj.pk || obj.post_id || obj.thread_id;
          }
          
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const result = findPostId(obj[key], depth + 1);
              if (result) return result;
            }
          }
          return null;
        };
        
        return findPostId(data);
      }
      
      return null;
    });

    return postId;
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error extracting post_id from page:', error.message);
    return null;
  }
}

/**
 * Intercept network requests to find shortcode in GraphQL responses
 */
export async function interceptGraphQLForShortcode(page, onResponse) {
  try {
    await page.route('**/graphql/**', async (route) => {
      const request = route.request();
      const response = await route.fetch();
      const responseBody = await response.text();
      
      try {
        const data = JSON.parse(responseBody);
        if (onResponse) {
          onResponse(data, request.url());
        }
      } catch (e) {
        // Not JSON, ignore
      }
      
      await route.fulfill({ response });
    });

    console.log('[SHORTCODE INSPECTOR] Set up GraphQL interception');
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error setting up interception:', error.message);
  }
}

/**
 * Navigate to post detail page and collect shortcode/post_id pair
 */
export async function collectFromPostDetailPage(page, postUrl) {
  try {
    console.log(`[SHORTCODE INSPECTOR] Navigating to post detail: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'networkidle', timeout: CONFIG.browser.timeouts.navigation });
    
    // Wait a bit for page to fully load
    await page.waitForTimeout(2000);
    
    const shortcode = await extractShortcodeFromURL(page);
    const postId = await extractPostIdFromPage(page);
    
    if (shortcode && postId) {
      console.log(`[SHORTCODE INSPECTOR] Collected: post_id=${postId}, shortcode=${shortcode}`);
      return { post_id: postId, shortcode };
    }
    
    return null;
  } catch (error) {
    console.error('[SHORTCODE INSPECTOR] Error collecting from post detail page:', error.message);
    return null;
  }
}

/**
 * Full inspection: check window, store, and collect from current page
 */
export async function fullInspection(page) {
  console.log('[SHORTCODE INSPECTOR] Starting full inspection...');
  
  const results = {
    windowFunctions: {},
    relayStore: {},
    currentShortcode: null,
    currentPostId: null
  };

  // Inspect window object
  results.windowFunctions = await inspectWindowObject(page);
  
  // Inspect Relay store
  results.relayStore = await inspectRelayStore(page);
  
  // Extract from current page
  results.currentShortcode = await extractShortcodeFromURL(page);
  results.currentPostId = await extractPostIdFromPage(page);
  
  return results;
}

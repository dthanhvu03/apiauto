/**
 * Relay Store Extractor
 * 
 * Extracts feed items from window-level Relay store
 */

/**
 * Extract feed items from window-level Relay store
 * WHY: Relay store contains normalized, structured data
 * FRAGILE: Store structure and access methods may change
 * STABLE: Relay's normalization pattern is consistent
 */
export async function extractFromRelayStore(page) {
  const feedItems = [];

  try {
    // Try to access Relay store
    const storeData = await page.evaluate(() => {
      // Try multiple ways to access Relay store
      if (window.__relayStore) {
        return window.__relayStore;
      }
      if (window.__RELAY_STORE__) {
        return window.__RELAY_STORE__;
      }
      if (window.__INITIAL_DATA__) {
        return window.__INITIAL_DATA__;
      }
      
      // Try to find Relay store in React DevTools format
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook.renderers && hook.renderers.size > 0) {
          const renderer = Array.from(hook.renderers.values())[0];
          // This is a fallback - may not work in production
        }
      }

      return null;
    });

    if (storeData) {
      // Relay store is typically a map/object with node IDs as keys
      // Look for nodes that look like posts/threads
      const nodes = await page.evaluate((store) => {
        const posts = [];
        
        // Handle different store structures
        const traverse = (obj, depth = 0) => {
          if (depth > 5) return; // Prevent infinite recursion
          if (!obj || typeof obj !== 'object') return;

          // Check if this looks like a post node
          if (obj.id && (obj.text || obj.caption || obj.content)) {
            posts.push(obj);
            return;
          }

          // Recursively search
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              traverse(obj[key], depth + 1);
            }
          }
        };

        traverse(store);
        return posts;
      }, storeData);

      feedItems.push(...nodes);
    }
  } catch (e) {
    console.warn('[WARNING] Failed to read Relay store:', e.message);
  }

  return feedItems;
}

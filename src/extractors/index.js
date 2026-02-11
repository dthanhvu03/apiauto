/**
 * Unified Feed Extraction Interface
 * 
 * Orchestrates multiple extraction strategies:
 * 1. GraphQL (most reliable)
 * 2. Relay Store (fallback)
 * 3. DOM (last resort)
 */

import { extractFromGraphQL } from './graphql-extractor.js';
import { extractFromRelayStore } from './relay-extractor.js';
import { extractFromDOM } from './dom-extractor.js';
import { collectFromGraphQLItems } from '../utils/shortcode-research.js';

/**
 * Extract feed items using multiple strategies
 * WHY: Different strategies have different reliability
 * Order: GraphQL > Relay Store > DOM (most to least reliable)
 * 
 * IMPORTANT: If GraphQL extraction finds items but they're empty (only IDs),
 * we'll also try DOM extraction to fill in the missing data.
 */
export async function extractFeedItems(page, graphqlResponses, normalizeFeedItem) {
  const allFeedItems = [];
  const seenIds = new Set();

  // Strategy 1: Extract from GraphQL responses (most reliable)
  console.log('[EXTRACT] Trying GraphQL extraction...');
  const graphqlItems = extractFromGraphQL(graphqlResponses);
  
  // Collect shortcode samples from GraphQL items
  if (graphqlItems.length > 0) {
    collectFromGraphQLItems(graphqlItems);
  }
  
  let graphqlItemsWithData = 0;
  let itemIndex = 0;
  
  for (const item of graphqlItems) {
    const isFirstItem = itemIndex === 0;
    itemIndex++;
    // Debug: Log raw item structure BEFORE normalization for first item or items with low counts
    if (graphqlItems.indexOf(item) === 0 || item.like_count === 1 || (item.like_count === 0 && item.id)) {
      console.log(`[RAW DEBUG] Raw item before normalization (post ${item.id || item.post_id || 'unknown'}):`);
      console.log(`[RAW DEBUG] Item keys:`, Object.keys(item).slice(0, 25));
      console.log(`[RAW DEBUG] Item structure (first 1200 chars):`, JSON.stringify(item, null, 2).substring(0, 1200));
      
      // Debug: Check media fields specifically
      const mediaFields = {
        carousel_media: item.carousel_media,
        image_versions2: item.image_versions2,
        video_versions: item.video_versions,
        media_type: item.media_type
      };
      console.log(`[RAW DEBUG] Media fields check:`, {
        has_carousel_media: !!item.carousel_media,
        carousel_media_type: Array.isArray(item.carousel_media) ? `array[${item.carousel_media.length}]` : typeof item.carousel_media,
        has_image_versions2: !!item.image_versions2,
        image_versions2_type: typeof item.image_versions2,
        has_video_versions: !!item.video_versions,
        video_versions_type: Array.isArray(item.video_versions) ? `array[${item.video_versions.length}]` : typeof item.video_versions,
        media_type: item.media_type
      });
      
      // Log sample of media fields if they exist
      if (item.carousel_media && Array.isArray(item.carousel_media) && item.carousel_media.length > 0) {
        console.log(`[RAW DEBUG] carousel_media[0] sample:`, JSON.stringify(item.carousel_media[0], null, 2).substring(0, 500));
      }
      if (item.image_versions2) {
        console.log(`[RAW DEBUG] image_versions2 sample:`, JSON.stringify(item.image_versions2, null, 2).substring(0, 500));
      }
      
      // Check for counts in raw item
      const findRawCounts = (obj, depth = 0) => {
        if (depth > 4) return {};
        const counts = {};
        for (const key in obj) {
          const lowerKey = key.toLowerCase();
          if (typeof obj[key] === 'number' && (lowerKey.includes('count') || lowerKey.includes('like') || lowerKey.includes('reply') || lowerKey.includes('repost'))) {
            counts[key] = obj[key];
          } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            Object.assign(counts, findRawCounts(obj[key], depth + 1));
          }
        }
        return counts;
      };
      const rawCounts = findRawCounts(item);
      if (Object.keys(rawCounts).length > 0) {
        console.log(`[RAW DEBUG] Found count fields in raw item:`, rawCounts);
      }
    }
    
    const normalized = normalizeFeedItem(item, isFirstItem);
    if (normalized.post_id && !seenIds.has(normalized.post_id)) {
      allFeedItems.push(normalized);
      seenIds.add(normalized.post_id);
      
      // Check if this item has useful data (not just ID)
      if (normalized.text || normalized.username || normalized.media_urls.length > 0) {
        graphqlItemsWithData++;
      }
    }
  }
  console.log(`[EXTRACT] GraphQL: Found ${graphqlItems.length} items (${graphqlItemsWithData} with data)`);

  // Strategy 2: Extract from Relay store (fallback if GraphQL failed)
  if (allFeedItems.length === 0) {
    console.log('[EXTRACT] Trying Relay store extraction...');
    const relayItems = await extractFromRelayStore(page);
    for (const item of relayItems) {
      const normalized = normalizeFeedItem(item, false);
      if (normalized.post_id && !seenIds.has(normalized.post_id)) {
        allFeedItems.push(normalized);
        seenIds.add(normalized.post_id);
      }
    }
    console.log(`[EXTRACT] Relay Store: Found ${relayItems.length} items`);
  }

  // Strategy 3: Extract from DOM (last resort OR supplement GraphQL data)
  // Use DOM if GraphQL found items but they're mostly empty (only IDs)
  const shouldTryDOM = allFeedItems.length === 0 || 
                       (graphqlItems.length > 0 && graphqlItemsWithData < graphqlItems.length * 0.3);
  
  if (shouldTryDOM) {
    console.log('[EXTRACT] Trying DOM extraction...');
    const domItems = await extractFromDOM(page);
    
    for (const item of domItems) {
      const normalized = normalizeFeedItem(item, false);
      const id = normalized.post_id || normalized.text?.substring(0, 50);
      
      if (id) {
        // Try to merge with existing GraphQL item if ID matches
        const existingIndex = allFeedItems.findIndex(existing => 
          existing.post_id === normalized.post_id || 
          existing.post_id === id
        );
        
        if (existingIndex >= 0) {
          // Merge DOM data into existing GraphQL item (DOM has more complete data)
          const existing = allFeedItems[existingIndex];
          allFeedItems[existingIndex] = {
            ...existing,
            // Prefer DOM data if GraphQL data is missing
            username: existing.username || normalized.username,
            text: existing.text || normalized.text,
            like_count: existing.like_count || normalized.like_count,
            reply_count: existing.reply_count || normalized.reply_count,
            repost_count: existing.repost_count || normalized.repost_count,
            media_urls: existing.media_urls.length > 0 ? existing.media_urls : normalized.media_urls
          };
        } else if (!seenIds.has(id)) {
          // New item from DOM
          allFeedItems.push(normalized);
          seenIds.add(id);
        }
      }
    }
    console.log(`[EXTRACT] DOM: Found ${domItems.length} items`);
  }
  
  // Strategy 4: DOM fallback for items missing username/text
  // If GraphQL items exist but are missing username or text, try to extract from DOM
  // IMPORTANT: This must run BEFORE browser/page is closed
  const itemsNeedingDOM = allFeedItems.filter(item => 
    item.post_id && (!item.username || !item.text)
  );
  
  if (itemsNeedingDOM.length > 0 && itemsNeedingDOM.length <= 20) {
    // Only try DOM fallback for reasonable number of items (max 20)
    console.log(`[EXTRACT] ${itemsNeedingDOM.length} items missing username/text, trying DOM fallback...`);
    
    // Check if page is still available
    try {
      // Check if page context is still valid
      let pageIsAvailable = false;
      try {
        pageIsAvailable = page && !page.isClosed();
        // Try a simple evaluate to verify context is alive
        if (pageIsAvailable) {
          await page.evaluate(() => document.readyState).catch(() => {
            pageIsAvailable = false;
          });
        }
      } catch (e) {
        pageIsAvailable = false;
      }
      
      if (!pageIsAvailable) {
        console.log(`[EXTRACT] ⚠️ Page context is closed/disposed, skipping DOM fallback`);
      } else {
        for (const item of itemsNeedingDOM) {
          try {
            // Try to extract from current page DOM first (faster)
            const domData = await page.evaluate((postId) => {
          // Find post element by various methods
          const findPostElement = () => {
            // Try data attributes
            const byDataId = document.querySelector(`[data-post-id="${postId}"]`);
            if (byDataId) return byDataId;
            
            // Try finding by post URL pattern
            const links = Array.from(document.querySelectorAll('a[href*="/post/"]'));
            for (const link of links) {
              const href = link.getAttribute('href');
              if (href && href.includes(postId)) {
                return link.closest('article') || link.closest('[role="article"]');
              }
            }
            
            // Try finding by text content that might contain post ID
            const allElements = Array.from(document.querySelectorAll('article, [role="article"]'));
            for (const el of allElements) {
              if (el.textContent && el.textContent.includes(postId)) {
                return el;
              }
            }
            
            return null;
          };
          
          const postEl = findPostElement();
          if (!postEl) return null;
          
          // Extract username
          let username = null;
          const usernameLinks = Array.from(postEl.querySelectorAll('a[href*="/@"]'));
          for (const link of usernameLinks) {
            const href = link.getAttribute('href');
            if (href) {
              const match = href.match(/@([^/]+)/);
              if (match && match[1]) {
                username = match[1];
                break;
              }
            }
          }
          
          // Extract text
          let text = null;
          const textSelectors = [
            'span[dir="auto"]',
            'div[dir="auto"]',
            '[data-testid*="text"]',
            'p',
            'div[role="article"] span'
          ];
          
          for (const selector of textSelectors) {
            const textEl = postEl.querySelector(selector);
            if (textEl && textEl.textContent && textEl.textContent.trim().length > 10) {
              const textContent = textEl.textContent.trim();
              // Filter out metadata like counts
              if (!textContent.match(/^\d+[\s,]*$/) && textContent.length > 10) {
                text = textContent;
                break;
              }
            }
          }
          
          return { username, text };
        }, item.post_id);
        
        if (domData && (domData.username || domData.text)) {
          if (domData.username && !item.username) {
            item.username = domData.username;
            console.log(`[EXTRACT] ✅ Extracted username from DOM for post ${item.post_id}: @${domData.username}`);
          }
          if (domData.text && !item.text) {
            item.text = domData.text;
            console.log(`[EXTRACT] ✅ Extracted text from DOM for post ${item.post_id}: ${domData.text.substring(0, 50)}...`);
          }
            }
          } catch (error) {
            // Non-fatal: continue with other items
            // Check if error is due to disposed context - this is expected if browser closed
            if (error.message && error.message.includes('Request context disposed')) {
              console.log(`[EXTRACT] ⚠️ Browser context disposed, stopping DOM fallback`);
              break; // Stop trying more items if context is disposed
            }
            console.warn(`[EXTRACT] DOM fallback failed for post ${item.post_id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`[EXTRACT] DOM fallback error: ${error.message}`);
    }
  } else if (itemsNeedingDOM.length > 20) {
    console.log(`[EXTRACT] Too many items (${itemsNeedingDOM.length}) missing username/text, skipping DOM fallback`);
  }

  return allFeedItems;
}

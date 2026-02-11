/**
 * DOM Extractor
 * 
 * Extracts feed items from DOM elements (fallback method)
 */

import { CONFIG } from '../config.js';

/**
 * Extract feed items from DOM elements
 * WHY: Fallback when GraphQL/Relay store are unavailable
 * FRAGILE: DOM selectors break frequently with UI updates
 * STABLE: Data attributes (data-testid) are more stable than class names
 */
export async function extractFromDOM(page, selectors = null) {
  const feedItems = [];
  const feedSelectors = selectors || CONFIG.selectors.feed;

  // Debug: Check what's actually in the DOM
  const domInfo = await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const divsWithRole = document.querySelectorAll('div[role="article"]');
    const dataTestIds = Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'));
    return {
      articleCount: articles.length,
      divRoleCount: divsWithRole.length,
      uniqueTestIds: [...new Set(dataTestIds)].slice(0, 10)
    };
  });
  console.log('[DOM DEBUG] DOM structure:', JSON.stringify(domInfo, null, 2));

  // Try each selector until we find posts
  for (const selector of feedSelectors) {
    try {
      const posts = await page.$$(selector);
      
      if (posts.length > 0) {
        console.log(`[DOM] Found ${posts.length} posts using selector: ${selector}`);
        
        for (const post of posts) {
          try {
            const postData = await post.evaluate((el) => {
              // Extract post ID
              const postId = el.getAttribute('data-post-id') ||
                           el.getAttribute('data-id') ||
                           el.id ||
                           null;

              // Extract username
              const usernameEl = el.querySelector('[href*="/@"]') ||
                               el.querySelector('a[href*="/"]');
              const username = usernameEl ? 
                (usernameEl.getAttribute('href')?.match(/@([^/]+)/)?.[1] || 
                 usernameEl.textContent?.trim()) : null;

              // Extract text content
              const textEl = el.querySelector('[data-testid*="text"]') ||
                           el.querySelector('span[dir="auto"]') ||
                           el.querySelector('div[dir="auto"]');
              const text = textEl?.textContent?.trim() || null;

              // Extract counts (likes, replies, reposts)
              const extractCount = (label) => {
                const buttons = Array.from(el.querySelectorAll('button, a'));
                for (const btn of buttons) {
                  const text = btn.textContent || btn.getAttribute('aria-label') || '';
                  if (text.toLowerCase().includes(label)) {
                    const match = text.match(/(\d+[\d,]*)/);
                    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
                  }
                }
                return 0;
              };

              const likeCount = extractCount('like');
              const replyCount = extractCount('reply') || extractCount('comment');
              const repostCount = extractCount('repost') || extractCount('repost');
              const shareCount = extractCount('share');

              // Extract media URLs
              const mediaUrls = [];
              const images = el.querySelectorAll('img[src]');
              for (const img of images) {
                const src = img.getAttribute('src');
                if (src && !src.includes('data:image') && !src.includes('placeholder')) {
                  mediaUrls.push(src);
                }
              }

              return {
                post_id: postId,
                username: username,
                text: text,
                like_count: likeCount,
                reply_count: replyCount,
                repost_count: repostCount,
                share_count: shareCount,
                media_urls: mediaUrls
              };
            });

            if (postData.post_id || postData.text) {
              feedItems.push(postData);
            }
          } catch (e) {
            // Skip this post if extraction fails
            continue;
          }
        }

        // If we found posts with this selector, stop trying others
        if (feedItems.length > 0) {
          break;
        }
      }
    } catch (e) {
      // Try next selector
      continue;
    }
  }

  return feedItems;
}

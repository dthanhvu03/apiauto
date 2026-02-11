/**
 * Post Normalizer
 * 
 * Main normalization logic that combines all normalizers
 */

import { extractMediaUrls, determineMediaType, extractVideoDuration } from './media-normalizer.js';
import { extractTextEntities } from './text-normalizer.js';
import { normalizeUserInfo } from './user-normalizer.js';
import { encodePostId, findMatchingAlgorithm } from '../utils/shortcode-encoder.js';
import { CONFIG } from '../config.js';

// Debug counter to limit share_count debug logging
let shareDebugCount = 0;

/**
 * Extract post ID from various possible fields
 */
function extractPostId(item) {
  // Handle Relay-style __ref (e.g., "Post:123456" or just ID)
  let postId = item.id || 
               item.post_id || 
               item.thread_id ||
               item.pk ||
               item.code || // Instagram-style shortcode
               null;

  // If we have a __ref, extract ID from it
  if (!postId && item.__ref) {
    // __ref format is usually "TypeName:ID" or just "ID"
    postId = item.__ref.includes(':') ? item.__ref.split(':')[1] : item.__ref;
  }
  
  // Threads uses composite keys like "3821587946977367805_63414964147" (threadId_userId)
  // Extract just the thread ID (part before underscore)
  if (postId && postId.includes('_') && /^\d+_\d+$/.test(postId)) {
    postId = postId.split('_')[0];
  }

  return postId;
}

/**
 * Extract text content from item
 */
function extractText(item) {
  // Extract text content - Threads uses various field names
  // IMPORTANT: Threads sometimes returns text as an object {text: "...", pk: "...", has_translation: null}
  let text = item.text ||
              item.caption ||
              item.content ||
              item.text_content ||
              item.caption?.text ||
              item.thread?.text ||
              item.post?.text ||
              item.body?.text ||
              // Check text_post_app_info (Threads stores text here sometimes)
              item.text_post_app_info?.text ||
              item.media_info?.caption?.text ||
              // Handle array of text blocks
              (Array.isArray(item.text_items) ? item.text_items.map(t => t.text || t).join(' ') : null) ||
              // Check for text in nested structures
              item.thread?.caption?.text ||
              item.post?.caption?.text ||
              // Check for text in user-generated content
              item.user?.text ||
              null;
  
  // If text is an object, extract the actual text string
  if (text && typeof text === 'object') {
    text = text.text || text.content || text.value || text.caption || JSON.stringify(text);
  }
  
  // Ensure text is a string
  if (text && typeof text !== 'string') {
    text = String(text);
  }

  return text;
}

/**
 * Extract count from item using multiple possible paths
 */
function getCount(item, paths, debugName = '') {
  for (const path of paths) {
    const parts = path.split('.');
    let value = item;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = null;
        break;
      }
    }
    if (typeof value === 'number') {
      // Debug: Log if we found a count (for like, reply, repost, share)
      if (debugName && (debugName === 'share' || debugName === 'like' || debugName === 'reply' || debugName === 'repost')) {
        if (debugName === 'share' && (path.includes('reshare') || path.includes('share'))) {
          console.log(`[GETCOUNT DEBUG] Found ${debugName} via path "${path}": ${value}`);
        } else if (debugName !== 'share') {
          // Log for like, reply, repost
          console.log(`[GETCOUNT DEBUG] Found ${debugName} via path "${path}": ${value}`);
        }
      }
      return value;
    }
    // Also handle string numbers
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const numValue = parseInt(value, 10);
      if (debugName && (debugName === 'share' || debugName === 'like' || debugName === 'reply' || debugName === 'repost')) {
        if (debugName === 'share' && (path.includes('reshare') || path.includes('share'))) {
          console.log(`[GETCOUNT DEBUG] Found ${debugName} via path "${path}" (string): ${numValue}`);
        } else if (debugName !== 'share') {
          // Log for like, reply, repost
          console.log(`[GETCOUNT DEBUG] Found ${debugName} via path "${path}" (string): ${numValue}`);
        }
      }
      return numValue;
    }
  }
  
  // Debug: Log if count is 0 (might indicate extraction issue)
  if (debugName) {
    // Check for alternative count structures in raw item
    const itemStr = JSON.stringify(item).substring(0, 1000);
    const hasCountKeywords = itemStr.includes('count') || itemStr.includes('like') || itemStr.includes('reply') || itemStr.includes('repost');
    
    if (hasCountKeywords) {
      // Try to find count values in the item structure
      const findCounts = (obj, depth = 0) => {
        if (depth > 3) return {};
        const counts = {};
        for (const key in obj) {
          if (typeof obj[key] === 'number' && (key.includes('count') || key.includes('like') || key.includes('reply') || key.includes('repost'))) {
            counts[key] = obj[key];
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(counts, findCounts(obj[key], depth + 1));
          }
        }
        return counts;
      };
      
      const foundCounts = findCounts(item);
      if (Object.keys(foundCounts).length > 0) {
        console.log(`[COUNT DEBUG] ${debugName} - Found count fields in item but getCount returned 0:`, foundCounts);
        console.log(`[COUNT DEBUG] Item top-level keys:`, Object.keys(item).slice(0, 20));
        // Try to manually check first few paths
        if (paths.length > 0) {
          const firstPath = paths[0];
          const parts = firstPath.split('.');
          let testValue = item;
          for (const part of parts) {
            if (testValue && typeof testValue === 'object') {
              testValue = testValue[part];
            } else {
              testValue = null;
              break;
            }
          }
          console.log(`[COUNT DEBUG] Testing first path "${firstPath}": value=${testValue}, type=${typeof testValue}`);
        }
      }
    }
  }
  
  return 0;
}

/**
 * Extract timestamp from item
 */
function extractTimestamp(item) {
  const timestamp = item.taken_at ||
                   item.created_at ||
                   item.timestamp ||
                   item.created_time ||
                   item.thread?.taken_at ||
                   item.post?.taken_at ||
                   item.post?.created_at ||
                   null;

  if (!timestamp) return null;

  // Convert to Unix timestamp (seconds)
  if (typeof timestamp === 'number') {
    // If it's in milliseconds, convert to seconds
    return timestamp > 1000000000000 ? Math.floor(timestamp / 1000) : timestamp;
  }

  // If it's a string, try to parse
  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return null;
}

/**
 * Extract post metadata (post_url, thread_id, is_reply, parent_post_id, quoted_post)
 * 
 * IMPORTANT: post_url should use shortcode if available, not numeric post_id
 */
function extractPostMetadata(item, postId, username) {
  // Extract shortcode from item (field 'code' in GraphQL response)
  let shortcode = item.code ||
                 item.shortcode ||
                 item.short_code ||
                 null;

  // If shortcode not found in item, encode post_id using base64url
  // CONFIRMED: Threads uses base64url encoding for shortcodes
  // Tested with: post_id=3821612401750661495 → shortcode=DUJGDtLk1l3
  if (!shortcode && postId) {
    try {
      shortcode = encodePostId(postId, 'base64url');
    } catch (error) {
      // If encoding fails, fall back to post_id
      // Silently fail - we'll use post_id in URL
    }
  }

  // Construct post_url using shortcode if available, otherwise use post_id
  // Threads uses shortcode in URLs (e.g., /post/DUJGDtLk1l3)
  // If we don't have shortcode, we'll use post_id as fallback
  const urlIdentifier = shortcode || postId;
  const postUrl = (urlIdentifier && username) 
    ? `${CONFIG.threads.url}/@${username}/post/${urlIdentifier}`
    : null;

  // Extract thread_id (may be same as post_id for top-level posts)
  const threadId = item.thread_id ||
                  item.thread?.id ||
                  item.thread?.thread_id ||
                  item.post?.thread_id ||
                  postId || // Fallback to post_id if thread_id not found
                  null;

  // Extract is_reply (check if this is a reply to another post)
  const isReply = !!(item.reply_to ||
                    item.parent_post ||
                    item.parent_post_id ||
                    item.reply_to_post ||
                    item.in_reply_to ||
                    item.thread?.reply_to ||
                    item.text_post_app_info?.reply_to ||
                    item.text_post_app_info?.parent_post_id);

  // Extract parent_post_id (ID of the post this is replying to)
  const parentPostId = item.reply_to?.id ||
                      item.reply_to?.post_id ||
                      item.reply_to?.thread_id ||
                      item.parent_post?.id ||
                      item.parent_post?.post_id ||
                      item.parent_post_id ||
                      item.reply_to_post?.id ||
                      item.in_reply_to?.id ||
                      item.thread?.reply_to?.id ||
                      item.text_post_app_info?.reply_to?.id ||
                      item.text_post_app_info?.parent_post_id ||
                      null;

  // Extract quoted_post (if this post quotes another post)
  const quotedPost = item.quoted_post ||
                    item.quote_post ||
                    item.quoted_thread ||
                    item.quote_thread ||
                    item.text_post_app_info?.quoted_post ||
                    null;

  // Normalize quoted_post to include basic info if it's an object
  let quotedPostData = null;
  if (quotedPost) {
    if (typeof quotedPost === 'object') {
      quotedPostData = {
        post_id: quotedPost.id || quotedPost.post_id || quotedPost.thread_id || null,
        username: quotedPost.user?.username || quotedPost.username || null,
        text: quotedPost.text || quotedPost.caption || null,
        media_urls: extractMediaUrls(quotedPost, false, false) || []
      };
    } else if (typeof quotedPost === 'string') {
      // If it's just an ID string, store it
      quotedPostData = { post_id: quotedPost };
    }
  }

  return {
    post_url: postUrl,
    shortcode: shortcode, // Include shortcode in metadata for future use
    thread_id: threadId,
    is_reply: isReply,
    parent_post_id: parentPostId,
    quoted_post: quotedPostData
  };
}

/**
 * Determine which object contains the counts (like_count, reply_count, repost_count)
 * Returns the prefix path (e.g., 'text_post_app_info', 'thread', 'post', or '') and the object itself
 * WHY: share_count should be in the same object as other counts
 */
function findCountsContainer(item, likeCount, replyCount, repostCount) {
  // Check text_post_app_info first (most common in Threads)
  if (item.text_post_app_info) {
    const textAppInfo = item.text_post_app_info;
    const hasLike = typeof textAppInfo.like_count === 'number' || typeof textAppInfo.num_likes === 'number';
    const hasReply = typeof textAppInfo.reply_count === 'number' || typeof textAppInfo.direct_reply_count === 'number' || typeof textAppInfo.num_replies === 'number';
    const hasRepost = typeof textAppInfo.repost_count === 'number' || typeof textAppInfo.quote_count === 'number' || typeof textAppInfo.reshare_count === 'number' || typeof textAppInfo.num_reposts === 'number';
    
    // If we found at least one count in text_post_app_info and it matches our extracted values
    if ((hasLike && likeCount > 0) || (hasReply && replyCount > 0) || (hasRepost && repostCount > 0)) {
      return { prefix: 'text_post_app_info', container: textAppInfo };
    }
  }
  
  // Check thread object
  if (item.thread) {
    const thread = item.thread;
    const hasLike = typeof thread.like_count === 'number' || typeof thread.likes === 'number' || typeof thread.num_likes === 'number';
    const hasReply = typeof thread.reply_count === 'number' || typeof thread.comment_count === 'number';
    const hasRepost = typeof thread.repost_count === 'number' || typeof thread.reposts === 'number';
    
    if ((hasLike && likeCount > 0) || (hasReply && replyCount > 0) || (hasRepost && repostCount > 0)) {
      return { prefix: 'thread', container: thread };
    }
  }
  
  // Check post object
  if (item.post) {
    const post = item.post;
    const hasLike = typeof post.like_count === 'number' || typeof post.likes === 'number';
    const hasReply = typeof post.reply_count === 'number' || typeof post.comment_count === 'number';
    const hasRepost = typeof post.repost_count === 'number' || typeof post.reposts === 'number';
    
    if ((hasLike && likeCount > 0) || (hasReply && replyCount > 0) || (hasRepost && repostCount > 0)) {
      return { prefix: 'post', container: post };
    }
  }
  
  // Check top-level (if counts are directly on item)
  const hasLike = typeof item.like_count === 'number' || typeof item.likes === 'number' || typeof item.num_likes === 'number';
  const hasReply = typeof item.reply_count === 'number' || typeof item.comment_count === 'number' || typeof item.direct_reply_count === 'number';
  const hasRepost = typeof item.repost_count === 'number' || typeof item.reposts === 'number' || typeof item.reshare_count === 'number';
  
  if ((hasLike && likeCount > 0) || (hasReply && replyCount > 0) || (hasRepost && repostCount > 0)) {
    return { prefix: '', container: item };
  }
  
  // Default: return top-level if we have any counts
  if (likeCount > 0 || replyCount > 0 || repostCount > 0) {
    return { prefix: '', container: item };
  }
  
  return { prefix: '', container: item };
}

/**
 * Normalize feed item from any source into standard format
 * WHY: Different sources (GraphQL, Relay, DOM) have different structures
 * STABLE: Output format is consistent regardless of source
 */
export function normalizeFeedItem(rawItem, isFirstItem = false) {
  // Handle different input structures
  const item = rawItem || {};

  // Extract basic fields
  const postId = extractPostId(item);
  const userInfo = normalizeUserInfo(item);
  const username = userInfo.username;
  const text = extractText(item);
  
  // Debug: Log if username is missing (only for first few items to avoid spam)
  if (!username && isFirstItem) {
    console.log('[USER DEBUG] Username not found in item. Item keys:', Object.keys(item).slice(0, 20));
    console.log('[USER DEBUG] User object:', item.user ? Object.keys(item.user).slice(0, 10) : 'no user object');
    console.log('[USER DEBUG] UserInfo extracted:', userInfo);
    
    // Deep debug: Check all possible username locations
    const usernamePaths = [
      'username', 'user.username', 'owner.username', 'author.username',
      'user.user.username', 'thread.user.username', 'text_post_app_info.user.username',
      'posted_by.username', 'thread_author.username', 'creator.username'
    ];
    
    console.log('[USER DEBUG] Checking username paths:');
    let foundUsernamePath = false;
    for (const path of usernamePaths) {
      const parts = path.split('.');
      let value = item;
      let exists = true;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          value = null;
          exists = false;
          break;
        }
      }
      if (value) {
        console.log(`[USER DEBUG] ✅ Found value at "${path}": ${value}`);
        foundUsernamePath = true;
      } else if (isFirstItem) {
        console.log(`[USER DEBUG] ❌ Path "${path}": ${exists ? 'exists but is null/undefined' : 'does not exist'}`);
      }
    }
    if (!foundUsernamePath && isFirstItem) {
      console.log(`[USER DEBUG] ⚠️ No username found in any of the ${usernamePaths.length} paths checked`);
    }
    
    // Check for user references (__ref)
    if (item.user && typeof item.user === 'object') {
      console.log('[USER DEBUG] User object type:', typeof item.user);
      console.log('[USER DEBUG] User object keys:', Object.keys(item.user));
      if (item.user.__ref) {
        console.log(`[USER DEBUG] User has __ref: ${item.user.__ref}`);
      }
    }
    
    // Check for text
    if (!text) {
      console.log('[TEXT DEBUG] Text not found. Checking text paths:');
      const textPaths = [
        'text', 'caption', 'content', 'text_content',
        'caption.text', 'thread.text', 'post.text', 'body.text',
        'text_post_app_info.text', 'media_info.caption.text',
        'thread.caption.text', 'post.caption.text'
      ];
      let foundTextPath = false;
      for (const path of textPaths) {
        const parts = path.split('.');
        let value = item;
        let exists = true;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = value[part];
          } else {
            value = null;
            exists = false;
            break;
          }
        }
        if (value) {
          const textPreview = typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value).substring(0, 100);
          console.log(`[TEXT DEBUG] ✅ Found value at "${path}": ${textPreview}`);
          foundTextPath = true;
        } else if (isFirstItem) {
          console.log(`[TEXT DEBUG] ❌ Path "${path}": ${exists ? 'exists but is null/undefined' : 'does not exist'}`);
        }
      }
      if (!foundTextPath && isFirstItem) {
        console.log(`[TEXT DEBUG] ⚠️ No text found in any of the ${textPaths.length} paths checked`);
        console.log(`[TEXT DEBUG] Item structure sample:`, JSON.stringify(item).substring(0, 500));
      }
    }
  }

  // Extract counts
  const likeCount = getCount(item, [
    'like_count',
    'likes',
    'num_likes',
    'reaction_count',
    'edge_media_preview_like.count',
    'edge_liked_by.count',
    'thread.like_count',
    'post.like_count',
    // Threads-specific fields
    'thread.likes',
    'post.likes',
    'num_likes',
    // Check nested structures
    'thread.edge_media_preview_like.count',
    'post.edge_media_preview_like.count',
    // Check for counts in composite keys
    'thread.num_likes',
    'post.num_likes',
    // Check text_post_app_info (Threads stores counts here)
    'text_post_app_info.like_count',
    'text_post_app_info.num_likes'
  ], 'like');
  
  // Debug: If like count is suspiciously low (0 or 1), log item structure
  if (likeCount <= 1 && postId) {
    const itemStr = JSON.stringify(item).substring(0, 800);
    if (itemStr.includes('like') || itemStr.includes('count')) {
      console.log(`[COUNT DEBUG] Post ${postId} has like_count=${likeCount}. Checking structure...`);
      console.log(`[COUNT DEBUG] Item keys:`, Object.keys(item).slice(0, 20));
      // Try to find any count-like values
      const allKeys = Object.keys(item).join(' ').toLowerCase();
      if (allKeys.includes('like') || allKeys.includes('count')) {
        console.log(`[COUNT DEBUG] Item structure sample:`, itemStr);
      }
    }
  }

  const replyCount = getCount(item, [
    'reply_count',
    'comments',
    'num_replies',
    'comment_count',
    'direct_reply_count',
    'edge_media_to_comment.count',
    'thread.reply_count',
    'post.reply_count',
    // Check text_post_app_info (Threads stores counts here)
    'text_post_app_info.reply_count',
    'text_post_app_info.direct_reply_count',
    'text_post_app_info.num_replies'
  ], 'reply');

  const repostCount = getCount(item, [
    'repost_count',
    'reposts',
    'num_reposts',
    'quote_count',
    'reshare_count',
    'thread.repost_count',
    'post.repost_count',
    // Check text_post_app_info (Threads stores counts here)
    'text_post_app_info.repost_count',
    'text_post_app_info.quote_count',
    'text_post_app_info.reshare_count',
    'text_post_app_info.num_reposts'
  ]);

  // Determine which object contains the counts (for share_count extraction)
  const countsContainer = findCountsContainer(item, likeCount, replyCount, repostCount);

  const viewCount = getCount(item, [
    'view_count',
    'video_view_count',
    'views',
    'num_views',
    'video_views',
    'play_count',
    'impressions',
    'thread.view_count',
    'post.view_count',
    'text_post_app_info.view_count',
    'text_post_app_info.video_view_count',
    'text_post_app_info.views'
  ], 'view');

  // Debug view_count: Log all fields containing "view" if viewCount is 0
  // Especially important for video posts (media_type = 2 or has video_versions)
  const isVideoPost = item.media_type === 2 || (item.video_versions && Array.isArray(item.video_versions) && item.video_versions.length > 0);
  if (viewCount === 0 && (isFirstItem || isVideoPost)) {
    const findViewFields = (obj, path = '', depth = 0) => {
      if (depth > 5) return [];
      const fields = [];
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        // Search for view, play, impression, watch, stream, reach, engagement
        if (lowerKey.includes('view') || lowerKey.includes('play') || lowerKey.includes('impression') || 
            lowerKey.includes('watch') || lowerKey.includes('stream') || lowerKey.includes('reach') ||
            lowerKey.includes('engagement') || lowerKey.includes('seen') || lowerKey.includes('visit')) {
          const fullPath = path ? `${path}.${key}` : key;
          const value = obj[key];
          if (typeof value === 'number') {
            fields.push({ path: fullPath, value: value });
          } else if (typeof value === 'object' && value !== null) {
            fields.push(...findViewFields(value, fullPath, depth + 1));
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fields.push(...findViewFields(value, path ? `${path}.${key}` : key, depth + 1));
        }
      }
      return fields;
    };
    const viewFields = findViewFields(item);
    if (viewFields.length > 0) {
      console.log(`[VIEW DEBUG] Post ${postId} (${isVideoPost ? 'VIDEO' : 'NON-VIDEO'}): Found view-related fields:`, viewFields.slice(0, 15));
    } else {
      console.log(`[VIEW DEBUG] Post ${postId} (${isVideoPost ? 'VIDEO' : 'NON-VIDEO'}): No view-related fields found in item`);
      // For video posts, also log media_type and video_versions structure
      if (isVideoPost) {
        console.log(`[VIEW DEBUG] Video post structure: media_type=${item.media_type}, has_video_versions=${!!item.video_versions}, video_versions_length=${item.video_versions?.length || 0}`);
        // Check if view count might be in video_versions
        if (item.video_versions && Array.isArray(item.video_versions)) {
          const videoFields = findViewFields(item.video_versions);
          if (videoFields.length > 0) {
            console.log(`[VIEW DEBUG] Found view-related fields in video_versions:`, videoFields.slice(0, 10));
          }
        }
      }
    }
  }

  // share_count: Extract share count (different from repost_count)
  // NOTE: share_count and repost_count are different metrics in Threads
  // NOTE: Threads uses 'reshare_count' in text_post_app_info for share count
  // Priority: Find share_count in the same object that contains other counts
  const shareCountPaths = [];
  
  // If we found counts in a specific container, prioritize that container
  if (countsContainer.prefix) {
    const prefix = countsContainer.prefix;
    shareCountPaths.push(
      `${prefix}.reshare_count`,
      `${prefix}.share_count`,
      `${prefix}.shares`
    );
  }
  
  // Add standard paths (with priority for text_post_app_info and top-level)
  shareCountPaths.push(
    'text_post_app_info.reshare_count',
    'reshare_count', // Top-level reshare_count (seen in debug logs)
    'text_post_app_info.share_count',
    'share_count',
    'text_post_app_info.shares',
    'shares',
    'num_shares',
    'thread.share_count',
    'post.share_count',
    // Also check in thread_items.post.text_post_app_info (nested structure)
    'thread_items.0.post.text_post_app_info.reshare_count',
    'thread_items.0.text_post_app_info.reshare_count'
  );
  
  let shareCount = getCount(item, shareCountPaths, 'share');
  
  // Check if we have other counts (to determine if item has data)
  // This must be defined before use in the fallback logic below
  const hasOtherCounts = likeCount > 0 || replyCount > 0 || repostCount > 0;
  
  // Fallback: If getCount didn't find it, try direct extraction from common locations
  // This handles cases where reshare_count exists but paths don't match exactly
  if (shareCount === 0 && hasOtherCounts) {
    // Try direct extraction from text_post_app_info (most common location)
    if (item.text_post_app_info?.reshare_count && typeof item.text_post_app_info.reshare_count === 'number') {
      shareCount = item.text_post_app_info.reshare_count;
      if (isFirstItem) {
        console.log(`[SHARE DEBUG] Post ${postId}: Found reshare_count via direct extraction from text_post_app_info: ${shareCount}`);
      }
    }
    // Try from thread_items.post.text_post_app_info
    else if (item.thread_items?.[0]?.post?.text_post_app_info?.reshare_count && typeof item.thread_items[0].post.text_post_app_info.reshare_count === 'number') {
      shareCount = item.thread_items[0].post.text_post_app_info.reshare_count;
      if (isFirstItem) {
        console.log(`[SHARE DEBUG] Post ${postId}: Found reshare_count via direct extraction from thread_items[0].post.text_post_app_info: ${shareCount}`);
      }
    }
    // Try top-level reshare_count
    else if (item.reshare_count && typeof item.reshare_count === 'number') {
      shareCount = item.reshare_count;
      if (isFirstItem) {
        console.log(`[SHARE DEBUG] Post ${postId}: Found reshare_count via direct extraction from top-level: ${shareCount}`);
      }
    }
  }
  
  // Debug: If shareCount is still 0 but we have other counts, check if reshare_count exists directly
  if (shareCount === 0 && hasOtherCounts && isFirstItem) {
    // Direct check for reshare_count in common locations
    const directChecks = {
      'item.reshare_count': item.reshare_count,
      'item.text_post_app_info.reshare_count': item.text_post_app_info?.reshare_count,
      'item.thread_items[0].post.text_post_app_info.reshare_count': item.thread_items?.[0]?.post?.text_post_app_info?.reshare_count,
      'item.thread_items[0].text_post_app_info.reshare_count': item.thread_items?.[0]?.text_post_app_info?.reshare_count
    };
    const foundDirect = Object.entries(directChecks).find(([path, value]) => typeof value === 'number' && value > 0);
    if (foundDirect) {
      console.log(`[SHARE DEBUG] Post ${postId}: Found reshare_count via direct check: ${foundDirect[0]} = ${foundDirect[1]}`);
    }
  }

  // Debug share_count: Log all fields containing "share" if shareCount is still 0
  // BUT only if we have at least one of the other counts (like, reply, repost)
  // This ensures we only debug posts that should have share_count
  // Note: hasOtherCounts already defined above
  if (shareCount === 0 && hasOtherCounts && shareDebugCount < 3) {
    shareDebugCount++;
    console.log(`[SHARE DEBUG] Post ${postId}: shareCount=0 but has other counts (like=${likeCount}, reply=${replyCount}, repost=${repostCount})`);
    console.log(`[SHARE DEBUG] Post ${postId}: Counts container: prefix="${countsContainer.prefix}", container keys:`, Object.keys(countsContainer.container).slice(0, 20));
    
    const findShareFields = (obj, path = '', depth = 0) => {
      if (depth > 5) return [];
      const fields = [];
      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('share') || lowerKey.includes('repost') || lowerKey.includes('quote') || lowerKey.includes('reshare')) {
          const fullPath = path ? `${path}.${key}` : key;
          const value = obj[key];
          if (typeof value === 'number') {
            fields.push({ path: fullPath, value: value });
          } else if (value !== null && value !== undefined) {
            // Log even if null/undefined to see structure
            fields.push({ path: fullPath, value: value, type: typeof value });
            if (typeof value === 'object' && !Array.isArray(value)) {
              fields.push(...findShareFields(value, fullPath, depth + 1));
            }
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          fields.push(...findShareFields(value, path ? `${path}.${key}` : key, depth + 1));
        }
      }
      return fields;
    };
    // First, check the container that has other counts (most likely place for share_count)
    const containerShareFields = findShareFields(countsContainer.container, countsContainer.prefix || 'item', 0);
    if (containerShareFields.length > 0) {
      console.log(`[SHARE DEBUG] Post ${postId}: Found share-related fields in counts container (${countsContainer.prefix || 'top-level'}):`, containerShareFields.slice(0, 15));
    } else {
      console.log(`[SHARE DEBUG] Post ${postId}: No share-related fields found in counts container (${countsContainer.prefix || 'top-level'})`);
      // Log all keys in the container to see what's available
      const containerKeys = Object.keys(countsContainer.container).slice(0, 30);
      console.log(`[SHARE DEBUG] Post ${postId}: Container keys:`, containerKeys);
      // Also log keys that contain "count" to see all count fields
      const countKeys = containerKeys.filter(k => k.toLowerCase().includes('count'));
      if (countKeys.length > 0) {
        console.log(`[SHARE DEBUG] Post ${postId}: Count-related keys in container:`, countKeys);
        const countValues = {};
        for (const key of countKeys) {
          countValues[key] = countsContainer.container[key];
        }
        console.log(`[SHARE DEBUG] Post ${postId}: Count values in container:`, countValues);
      }
    }
    
    // Also check the entire item for share-related fields (fallback)
    const shareFields = findShareFields(item);
    if (shareFields.length > 0) {
      console.log(`[SHARE DEBUG] Post ${postId}: Found share-related fields in entire item:`, shareFields.slice(0, 10));
    }
    
    // Specifically check text_post_app_info for share-related fields (if different from container)
    if (item.text_post_app_info && countsContainer.prefix !== 'text_post_app_info') {
      const textAppInfoFields = findShareFields(item.text_post_app_info, 'text_post_app_info', 0);
      if (textAppInfoFields.length > 0) {
        console.log(`[SHARE DEBUG] Post ${postId}: Found share-related fields in text_post_app_info:`, textAppInfoFields.slice(0, 10));
      }
      // Also log all keys in text_post_app_info to see structure
      const textAppInfoKeys = Object.keys(item.text_post_app_info).filter(k => 
        k.toLowerCase().includes('share') || k.toLowerCase().includes('repost') || k.toLowerCase().includes('count')
      );
      if (textAppInfoKeys.length > 0) {
        console.log(`[SHARE DEBUG] Post ${postId}: text_post_app_info keys with share/repost/count:`, textAppInfoKeys);
        // Log values for these keys
        const textAppInfoValues = {};
        for (const key of textAppInfoKeys) {
          textAppInfoValues[key] = item.text_post_app_info[key];
        }
        console.log(`[SHARE DEBUG] Post ${postId}: text_post_app_info share-related values:`, textAppInfoValues);
      }
    }
  }

  // Extract media URLs
  // Enable debug for items with suspiciously low counts or missing media
  // Always debug first item to understand structure
  const shouldDebugMedia = !postId || item.like_count <= 1 || isFirstItem;
  const mediaUrls = extractMediaUrls(item, shouldDebugMedia, isFirstItem);
  
  // Debug: Log if media URLs were found (always log for first item)
  if (shouldDebugMedia || isFirstItem) {
    if (mediaUrls.length > 0) {
      console.log(`[MEDIA DEBUG] Post ${postId}: extractMediaUrls found ${mediaUrls.length} URLs:`, mediaUrls.slice(0, 2));
    } else {
      console.log(`[MEDIA DEBUG] Post ${postId}: extractMediaUrls found 0 URLs`);
    }
  }

  // Extract timestamp
  const timestamp = extractTimestamp(item);

  // Extract user information (already extracted above, reuse it)
  // userInfo is already defined at line 338

  // Extract post metadata
  const postMetadata = extractPostMetadata(item, postId, username);

  // Extract text entities
  const textEntities = extractTextEntities(text, item);

  // Extract media metadata
  const mediaType = determineMediaType(item, mediaUrls);
  const videoDuration = extractVideoDuration(item);

  // Return normalized item with all fields
  return {
    post_id: postId,
    username: username,
    text: text,
    like_count: likeCount,
    reply_count: replyCount,
    repost_count: repostCount,
    media_urls: mediaUrls,
    timestamp: timestamp,
    timestamp_iso: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    // Additional user information
    user_id: userInfo.user_id,
    user_display_name: userInfo.user_display_name,
    user_avatar_url: userInfo.user_avatar_url,
    is_verified: userInfo.is_verified,
    // Post metadata
    post_url: postMetadata.post_url,
    shortcode: postMetadata.shortcode, // Include shortcode if available
    is_reply: postMetadata.is_reply,
    parent_post_id: postMetadata.parent_post_id,
    thread_id: postMetadata.thread_id,
    quoted_post: postMetadata.quoted_post,
    // Text entities
    hashtags: textEntities.hashtags,
    mentions: textEntities.mentions,
    links: textEntities.links,
    // Media metadata
    media_type: mediaType,
    video_duration: videoDuration,
    // Additional counts
    view_count: viewCount,
    share_count: shareCount
  };
}

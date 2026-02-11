/**
 * User Information Normalizer
 * 
 * Extracts user-related information from post items
 */

/**
 * Extract user ID from item
 */
export function extractUserId(item) {
  return item.user?.id ||
         item.user?.pk ||
         item.owner?.id ||
         item.owner?.pk ||
         item.author?.id ||
         item.author?.pk ||
         item.posted_by?.id ||
         item.thread_author?.id ||
         item.creator?.id ||
         item.user?.user?.id ||
         item.thread?.user?.id ||
         null;
}

/**
 * Extract user display name (full name) from item
 */
export function extractUserDisplayName(item) {
  return item.user?.full_name ||
         item.user?.name ||
         item.owner?.full_name ||
         item.owner?.name ||
         item.author?.full_name ||
         item.author?.name ||
         item.posted_by?.full_name ||
         item.thread_author?.full_name ||
         item.creator?.full_name ||
         item.user?.user?.full_name ||
         item.thread?.user?.full_name ||
         null;
}

/**
 * Extract user avatar URL from item
 */
export function extractUserAvatarUrl(item) {
  return item.user?.profile_pic_url ||
         item.user?.profile_picture_url ||
         item.user?.profile_pic_url_hd ||
         item.owner?.profile_pic_url ||
         item.owner?.profile_picture_url ||
         item.author?.profile_pic_url ||
         item.posted_by?.profile_pic_url ||
         item.thread_author?.profile_pic_url ||
         item.creator?.profile_pic_url ||
         item.user?.user?.profile_pic_url ||
         item.thread?.user?.profile_pic_url ||
         null;
}

/**
 * Extract is_verified status from item
 */
export function extractIsVerified(item) {
  return item.user?.is_verified ||
         item.user?.is_verified_account ||
         item.user?.verified ||
         item.owner?.is_verified ||
         item.owner?.is_verified_account ||
         item.author?.is_verified ||
         item.posted_by?.is_verified ||
         item.thread_author?.is_verified ||
         item.creator?.is_verified ||
         item.user?.user?.is_verified ||
         item.thread?.user?.is_verified ||
         false;
}

/**
 * Extract username from item
 */
export function extractUsername(item) {
  // Try multiple paths to find username
  // Threads may store username in various locations
  return item.username ||
         item.user?.username ||
         item.owner?.username ||
         item.author?.username ||
         item.user?.user?.username ||
         item.posted_by?.username ||
         item.thread_author?.username ||
         item.creator?.username ||
         item.thread?.user?.username ||
         // Check for username in nested structures
         item.user?.user?.user?.username ||
         item.thread?.thread?.user?.username ||
         // Check for username in text_post_app_info or similar
         item.text_post_app_info?.user?.username ||
         item.media_info?.user?.username ||
         // Check for username in composite keys (if item is from composite key)
         (item.id && item.id.includes('_') ? null : null) || // Skip if composite key itself
         // Try to extract from URL if present
         (item.url && item.url.match(/@([^/]+)/)?.[1]) ||
         (item.post_url && item.post_url.match(/@([^/]+)/)?.[1]) ||
         null;
}

/**
 * Normalize all user information from item
 */
export function normalizeUserInfo(item) {
  return {
    user_id: extractUserId(item),
    user_display_name: extractUserDisplayName(item),
    user_avatar_url: extractUserAvatarUrl(item),
    is_verified: extractIsVerified(item),
    username: extractUsername(item)
  };
}

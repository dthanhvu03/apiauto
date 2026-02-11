/**
 * Post Filter
 * 
 * Filters posts based on various criteria
 */

/**
 * Filter posts based on criteria
 * WHY: Allow users to filter posts by various criteria
 * STABLE: Filter logic is independent of data source
 */
export function filterPosts(posts, criteria = {}) {
  if (!criteria || Object.keys(criteria).length === 0) {
    return posts;
  }

  return posts.filter(post => {
    // Filter by minimum like count
    if (criteria.min_likes !== undefined && post.like_count < criteria.min_likes) {
      return false;
    }

    // Filter by maximum like count
    if (criteria.max_likes !== undefined && post.like_count > criteria.max_likes) {
      return false;
    }

    // Filter by username (exact match or contains)
    if (criteria.username) {
      const usernameFilter = criteria.username.toLowerCase();
      const postUsername = (post.username || '').toLowerCase();
      if (criteria.username_exact) {
        if (postUsername !== usernameFilter) return false;
      } else {
        if (!postUsername.includes(usernameFilter)) return false;
      }
    }

    // Filter by text content (contains)
    if (criteria.text_contains) {
      const textFilter = criteria.text_contains.toLowerCase();
      const postText = (post.text || '').toLowerCase();
      if (!postText.includes(textFilter)) return false;
    }

    // Filter by has media
    if (criteria.has_media !== undefined) {
      const hasMedia = post.media_urls && post.media_urls.length > 0;
      if (criteria.has_media && !hasMedia) return false;
      if (!criteria.has_media && hasMedia) return false;
    }

    // Filter by minimum reply count
    if (criteria.min_replies !== undefined && post.reply_count < criteria.min_replies) {
      return false;
    }

    // Filter by minimum repost count
    if (criteria.min_reposts !== undefined && post.repost_count < criteria.min_reposts) {
      return false;
    }

    // Filter by minimum share count
    if (criteria.min_shares !== undefined && (post.share_count || 0) < criteria.min_shares) {
      return false;
    }

    // Filter by maximum share count
    if (criteria.max_shares !== undefined && (post.share_count || 0) > criteria.max_shares) {
      return false;
    }

    // Filter by timestamp (after date)
    if (criteria.after_timestamp) {
      const afterTs = typeof criteria.after_timestamp === 'number' 
        ? criteria.after_timestamp 
        : Math.floor(new Date(criteria.after_timestamp).getTime() / 1000);
      if (!post.timestamp || post.timestamp < afterTs) return false;
    }

    // Filter by timestamp (before date)
    if (criteria.before_timestamp) {
      const beforeTs = typeof criteria.before_timestamp === 'number'
        ? criteria.before_timestamp
        : Math.floor(new Date(criteria.before_timestamp).getTime() / 1000);
      if (!post.timestamp || post.timestamp > beforeTs) return false;
    }

    return true;
  });
}

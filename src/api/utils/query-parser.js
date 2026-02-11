/**
 * Query Parser Utilities
 * 
 * Functions for parsing query parameters into filter criteria
 */

/**
 * Parse query parameters into filter criteria
 * @param {Object} query - Query parameters object
 * @returns {Object} Filter criteria object
 */
export function parseFilterCriteria(query) {
  const criteria = {};

  // Numeric filters
  if (query.min_likes !== undefined) {
    criteria.min_likes = parseInt(query.min_likes, 10);
    if (isNaN(criteria.min_likes)) delete criteria.min_likes;
  }
  if (query.max_likes !== undefined) {
    criteria.max_likes = parseInt(query.max_likes, 10);
    if (isNaN(criteria.max_likes)) delete criteria.max_likes;
  }
  if (query.min_replies !== undefined) {
    criteria.min_replies = parseInt(query.min_replies, 10);
    if (isNaN(criteria.min_replies)) delete criteria.min_replies;
  }
  if (query.min_reposts !== undefined) {
    criteria.min_reposts = parseInt(query.min_reposts, 10);
    if (isNaN(criteria.min_reposts)) delete criteria.min_reposts;
  }

  // Boolean filters
  if (query.has_media !== undefined) {
    criteria.has_media = query.has_media === 'true' || query.has_media === true;
  }

  // String filters
  if (query.username) {
    criteria.username = query.username;
  }
  if (query.text_contains) {
    criteria.text_contains = query.text_contains;
  }

  // Timestamp filters
  if (query.after_timestamp !== undefined) {
    criteria.after_timestamp = parseInt(query.after_timestamp, 10);
    if (isNaN(criteria.after_timestamp)) delete criteria.after_timestamp;
  }
  if (query.before_timestamp !== undefined) {
    criteria.before_timestamp = parseInt(query.before_timestamp, 10);
    if (isNaN(criteria.before_timestamp)) delete criteria.before_timestamp;
  }

  return criteria;
}

/**
 * Parse limit from query
 * @param {Object} query - Query parameters object
 * @returns {number|null} Limit value or null
 */
export function parseLimit(query) {
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    return isNaN(limit) ? null : limit;
  }
  return null;
}

/**
 * Text Entity Normalizer
 * 
 * Extracts hashtags, mentions, and links from text
 */

/**
 * Extract hashtags from text using regex
 */
export function extractHashtags(textStr) {
  if (!textStr || typeof textStr !== 'string') return [];
  const hashtagRegex = /#(\w+)/g;
  const matches = textStr.match(hashtagRegex);
  return matches ? matches.map(tag => tag.substring(1)) : []; // Remove # symbol
}

/**
 * Extract mentions from text using regex
 */
export function extractMentions(textStr) {
  if (!textStr || typeof textStr !== 'string') return [];
  const mentionRegex = /@(\w+)/g;
  const matches = textStr.match(mentionRegex);
  return matches ? matches.map(mention => mention.substring(1)) : []; // Remove @ symbol
}

/**
 * Extract links from text using regex
 */
export function extractLinks(textStr) {
  if (!textStr || typeof textStr !== 'string') return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = textStr.match(urlRegex);
  return matches || [];
}

/**
 * Extract all text entities (hashtags, mentions, links) from text and structured data
 */
export function extractTextEntities(text, item = null) {
  const hashtags = extractHashtags(text);
  const mentions = extractMentions(text);
  const links = extractLinks(text);

  // Also check for entities in text_post_app_info or other structured fields
  if (item?.text_post_app_info) {
    // Check for structured entities
    if (item.text_post_app_info.hashtags && Array.isArray(item.text_post_app_info.hashtags)) {
      const structuredHashtags = item.text_post_app_info.hashtags
        .map(tag => tag.name || tag.text || tag)
        .filter(Boolean);
      hashtags.push(...structuredHashtags);
    }
    if (item.text_post_app_info.mentions && Array.isArray(item.text_post_app_info.mentions)) {
      const structuredMentions = item.text_post_app_info.mentions
        .map(mention => mention.username || mention.name || mention)
        .filter(Boolean);
      mentions.push(...structuredMentions);
    }
  }

  // Remove duplicates
  return {
    hashtags: [...new Set(hashtags)],
    mentions: [...new Set(mentions)],
    links: [...new Set(links)]
  };
}

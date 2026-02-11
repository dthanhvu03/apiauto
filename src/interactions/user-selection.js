/**
 * User Selection and Commenting Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to select users from feed
 * and comment on their posts.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { extractFeedData, extractUserPosts } from '../extractor.js';
import { filterPosts } from '../filters/post-filter.js';
import { commentOnMultiplePosts, selectRandomPosts } from './feed-browsing.js';
import { delay, log, LOG_LEVELS } from './utils.js';
import { launchBrowser, closeBrowser } from '../browser/browser-manager.js';
import { ensureLoggedIn } from './session.js';

/**
 * Extract unique users from feed data
 * @param {Array} posts - Array of post objects
 * @returns {Array} Array of unique usernames
 */
export function extractUsersFromFeed(posts) {
  if (!posts || posts.length === 0) {
    return [];
  }

  const usernames = new Set();
  for (const post of posts) {
    if (post.username) {
      usernames.add(post.username);
    }
  }

  return Array.from(usernames);
}

/**
 * Select a user from feed (random or by username)
 * @param {Array} posts - Array of post objects from feed
 * @param {string} username - Specific username to select (optional, if not provided, selects randomly)
 * @returns {string|null} Selected username or null if no users found
 */
export function selectUserFromFeed(posts, username = null) {
  const users = extractUsersFromFeed(posts);

  if (users.length === 0) {
    log(LOG_LEVELS.WARN, 'No users found in feed');
    return null;
  }

  if (username) {
    // Check if specified username exists
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const found = users.find(u => u.toLowerCase() === cleanUsername);
    if (found) {
      log(LOG_LEVELS.INFO, `Selected user: @${found}`, { username: found });
      return found;
    } else {
      log(LOG_LEVELS.WARN, `User @${username} not found in feed, selecting randomly`);
    }
  }

  // Select random user
  const randomUser = users[Math.floor(Math.random() * users.length)];
  log(LOG_LEVELS.INFO, `Randomly selected user: @${randomUser}`, {
    totalUsers: users.length,
    selected: randomUser
  });

  return randomUser;
}

/**
 * Comment on posts from a specific user
 * @param {string} username - Username to comment on posts from
 * @param {Object} options - Options
 * @param {Object} options.filterCriteria - Filter criteria for posts
 * @param {number} options.maxPostsToComment - Maximum number of posts to comment on (null = all filtered posts)
 * @param {boolean} options.randomSelection - Whether to select posts randomly (default: true)
 * @param {Array} options.commentTemplates - Custom comment templates
 * @param {number} options.commentDelayMin - Minimum delay between comments (ms)
 * @param {number} options.commentDelayMax - Maximum delay between comments (ms)
 * @param {number} options.maxItems - Maximum items to extract from user profile
 * @returns {Promise<Object>} Result object with statistics
 */
export async function commentOnUserPosts(username, options = {}) {
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  if (!username) {
    throw new Error('Username is required');
  }

  const cleanUsername = username.replace(/^@/, '');
  const config = CONFIG.interactions.feedBrowsing || {};
  const filterCriteria = options.filterCriteria || config.filterCriteria || {};
  const maxPostsToComment = options.maxPostsToComment !== undefined 
    ? options.maxPostsToComment 
    : (config.maxPostsToComment !== undefined ? config.maxPostsToComment : null);
  const randomSelection = options.randomSelection !== undefined 
    ? options.randomSelection 
    : (config.randomSelection !== undefined ? config.randomSelection : true);
  const maxItems = options.maxItems || CONFIG.extraction.maxItems;

  log(LOG_LEVELS.INFO, `Starting to comment on posts from user @${cleanUsername}`, {
    username: cleanUsername,
    filterCriteria,
    maxPostsToComment,
    randomSelection
  });

  const accountId = options.accountId || null;
  const profilePath = options.profilePath || null;
  const { browser, context } = await launchBrowser(accountId, profilePath);
  const page = await context.newPage();

  try {
    // Ensure logged in
    const loginCheck = await ensureLoggedIn(page, context, accountId);
    if (!loginCheck.success) {
      throw new Error(`Login required: ${loginCheck.error}`);
    }

    // Extract user posts
    log(LOG_LEVELS.INFO, `Extracting posts from user @${cleanUsername}...`);
    const allPosts = await extractUserPosts(cleanUsername, {
      accountId,
      profilePath,
      maxItems,
      browser,
      context
    });

    log(LOG_LEVELS.INFO, `Extracted ${allPosts.length} posts from @${cleanUsername}`);

    if (allPosts.length === 0) {
      log(LOG_LEVELS.WARN, `No posts found for user @${cleanUsername}`);
      return {
        success: true,
        username: cleanUsername,
        totalExtracted: 0,
        totalFiltered: 0,
        totalCommented: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    // Filter posts
    let filteredPosts = filterPosts(allPosts, filterCriteria);
    log(LOG_LEVELS.INFO, `Filtered to ${filteredPosts.length} posts matching criteria`);

    if (filteredPosts.length === 0) {
      log(LOG_LEVELS.WARN, `No posts from @${cleanUsername} match the filter criteria`);
      return {
        success: true,
        username: cleanUsername,
        totalExtracted: allPosts.length,
        totalFiltered: 0,
        totalCommented: 0,
        successful: 0,
        failed: 0,
        results: []
      };
    }

    // Select posts to comment on
    let postsToComment = filteredPosts;
    if (maxPostsToComment !== null && maxPostsToComment < filteredPosts.length) {
      if (randomSelection) {
        postsToComment = selectRandomPosts(filteredPosts, maxPostsToComment);
        log(LOG_LEVELS.INFO, `Randomly selected ${postsToComment.length} posts to comment on`);
      } else {
        postsToComment = filteredPosts.slice(0, maxPostsToComment);
        log(LOG_LEVELS.INFO, `Selected first ${postsToComment.length} posts to comment on`);
      }
    }

    // Comment on selected posts
    const commentResults = await commentOnMultiplePosts(page, postsToComment, {
      accountId,
      commentTemplates: options.commentTemplates,
      commentDelayMin: options.commentDelayMin,
      commentDelayMax: options.commentDelayMax
    });

    return {
      success: true,
      username: cleanUsername,
      totalExtracted: allPosts.length,
      totalFiltered: filteredPosts.length,
      totalCommented: postsToComment.length,
      successful: commentResults.successful,
      failed: commentResults.failed,
      results: commentResults.results
    };

  } catch (error) {
    log(LOG_LEVELS.ERROR, `Error commenting on posts from user @${cleanUsername}`, {
      username: cleanUsername,
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    await closeBrowser(browser, context);
  }
}

/**
 * Select a user from feed and comment on their posts
 * @param {Object} options - Options
 * @param {string} options.username - Specific username to select (optional, if not provided, selects randomly)
 * @param {string} options.targetUrl - Target URL for feed extraction (default: home feed)
 * @param {number} options.maxItems - Maximum items to extract from feed
 * @param {Object} options.filterCriteria - Filter criteria for user posts
 * @param {number} options.maxPostsToComment - Maximum number of posts to comment on
 * @param {boolean} options.randomSelection - Whether to select posts randomly
 * @param {Array} options.commentTemplates - Custom comment templates
 * @param {number} options.commentDelayMin - Minimum delay between comments (ms)
 * @param {number} options.commentDelayMax - Maximum delay between comments (ms)
 * @returns {Promise<Object>} Result object with statistics
 */
export async function selectUserAndComment(options = {}) {
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  const targetUrl = options.targetUrl || CONFIG.threads.url;
  const maxItems = options.maxItems || CONFIG.extraction.maxItems;
  const username = options.username || null;

  log(LOG_LEVELS.INFO, 'Starting user selection and commenting', {
    targetUrl,
    username: username || 'random'
  });

  const accountId = options.accountId || null;
  const profilePath = options.profilePath || null;
  // Extract feed data first (extractFeedData creates its own browser)
  log(LOG_LEVELS.INFO, 'Extracting feed data to find users...', { targetUrl, accountId });
  const feedPosts = await extractFeedData({
    accountId,
    profilePath,
    targetUrl,
    maxItems
  });

  log(LOG_LEVELS.INFO, `Extracted ${feedPosts.length} posts from feed`);

  // Select user
  const selectedUsername = selectUserFromFeed(feedPosts, username);
  if (!selectedUsername) {
    throw new Error('No users found in feed');
  }

  try {
    // Comment on user posts
    const result = await commentOnUserPosts(selectedUsername, {
      accountId,
      profilePath,
      filterCriteria: options.filterCriteria,
      maxPostsToComment: options.maxPostsToComment,
      randomSelection: options.randomSelection,
      commentTemplates: options.commentTemplates,
      commentDelayMin: options.commentDelayMin,
      commentDelayMax: options.commentDelayMax,
      maxItems: options.userMaxItems
    });

    return {
      success: true,
      selectedUsername,
      ...result
    };

  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error during user selection and commenting', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

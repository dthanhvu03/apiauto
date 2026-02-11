/**
 * Feed Browsing and Commenting Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to browse feed, filter posts,
 * and comment on multiple posts automatically.
 * Use at your own risk.
 */

import { CONFIG } from '../config.js';
import { extractFeedData } from '../extractor.js';
import { filterPosts } from '../filters/post-filter.js';
import { commentOnPost } from './comment.js';
import { delay, log, LOG_LEVELS } from './utils.js';
import { launchBrowser } from '../browser/browser-manager.js';
import { ensureLoggedIn } from './session.js';

/**
 * Select random posts from a list
 * @param {Array} posts - Array of post objects
 * @param {number} count - Number of posts to select (null = all posts)
 * @returns {Array} Selected posts
 */
export function selectRandomPosts(posts, count = null) {
  if (!posts || posts.length === 0) {
    return [];
  }

  // If count is null or >= posts.length, return all posts
  if (count === null || count >= posts.length) {
    return [...posts];
  }

  // Shuffle array and take first N
  const shuffled = [...posts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get comment text from templates
 * @param {Object} post - Post object (for template variables)
 * @param {Array} templates - Array of comment templates
 * @returns {string} Comment text
 */
function getCommentText(post, templates = null) {
  const configTemplates = CONFIG.interactions.feedBrowsing?.commentTemplates || [];
  const availableTemplates = templates || configTemplates;

  if (!availableTemplates || availableTemplates.length === 0) {
    // Default comment if no templates
    return 'Nice post! 👍';
  }

  // Select random template
  const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];

  // Replace template variables
  let comment = template;
  if (post.username) {
    comment = comment.replace(/{username}/g, post.username);
    comment = comment.replace(/{@username}/g, `@${post.username}`);
  }
  if (post.text) {
    // Truncate post text if used in template
    const postTextPreview = post.text.length > 50 
      ? post.text.substring(0, 50) + '...' 
      : post.text;
    comment = comment.replace(/{postText}/g, postTextPreview);
  }

  return comment;
}

/**
 * Comment on multiple posts
 * @param {Page} page - Playwright page object
 * @param {Array} posts - Array of post objects to comment on
 * @param {Object} options - Options
 * @param {Array} options.commentTemplates - Custom comment templates
 * @param {number} options.commentDelayMin - Minimum delay between comments (ms)
 * @param {number} options.commentDelayMax - Maximum delay between comments (ms)
 * @returns {Promise<Object>} Result object with statistics
 */
export async function commentOnMultiplePosts(page, posts, options = {}) {
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  if (!posts || posts.length === 0) {
    return {
      success: true,
      total: 0,
      successful: 0,
      failed: 0,
      results: []
    };
  }

  const config = CONFIG.interactions.feedBrowsing || {};
  const commentDelayMin = options.commentDelayMin || config.commentDelayMin || 5000;
  const commentDelayMax = options.commentDelayMax || config.commentDelayMax || 15000;
  const commentTemplates = options.commentTemplates || null;
  const accountId = options.accountId || null;

  // Ensure logged in
  const context = page.context();
  const loginCheck = await ensureLoggedIn(page, context, accountId);
  if (!loginCheck.success) {
    throw new Error(`Login required: ${loginCheck.error}`);
  }

  const results = [];
  let successful = 0;
  let failed = 0;

  log(LOG_LEVELS.INFO, `Starting to comment on ${posts.length} posts`, {
    total: posts.length
  });
  console.log(`\n💬 Starting to comment on ${posts.length} posts...\n`);

  for (let i = 0; i < posts.length; i++) {
    try {
      const post = posts[i];
      if (!post) {
        console.warn(`[COMMENT] Post at index ${i} is null or undefined, skipping...`);
        failed++;
        results.push({
          postId: null,
          username: null,
          text: null,
          success: false,
          error: 'Post is null or undefined',
          comment: null
        });
        continue;
      }
      
      const postId = post.post_id || post.id;
      if (!postId) {
        log(LOG_LEVELS.WARN, `Skipping post without postId`, { post });
        console.log(`⚠️  Skipping post ${i + 1}: No postId found`);
        failed++;
        results.push({
          postId: null,
          username: post.username || null,
          text: post.text || null,
          success: false,
          error: 'Post ID not found',
          comment: null
        });
        continue;
      }
      
      const username = post.username || null;
      const shortcode = post.shortcode || null;
      const postUrl = post.url || post.post_url || (username && shortcode 
        ? `${CONFIG.threads.url}/@${username}/post/${shortcode}`
        : null);
      // Get comment text
      const commentText = getCommentText(post, commentTemplates);

      log(LOG_LEVELS.INFO, `Commenting on post ${i + 1}/${posts.length}`, {
        postId,
        username,
        comment: commentText.substring(0, 50) + '...'
      });
      console.log(`\n[${i + 1}/${posts.length}] 💬 Commenting on post ${postId} (@${username || 'unknown'})`);
      console.log(`   Comment: "${commentText}"`);
      console.log(`   URL: ${postUrl || 'N/A'}`);

      // Comment on post
      // Note: commentOnPost will try to extract username and text from page if not provided
      const result = await commentOnPost(page, postId, commentText, {
        username,
        shortcode,
        postUrl
      });
      
      // Update username and text from result if extracted from page
      const finalUsername = result.username || username;
      const finalText = result.text || post.text;
      
      // Update post data with extracted info if available
      if (finalUsername && !post.username) {
        post.username = finalUsername;
      }
      if (finalText && !post.text) {
        post.text = finalText;
      }
      
      if (result.success) {
        successful++;
        log(LOG_LEVELS.INFO, `Successfully commented on post ${postId}`, {
          postId,
          username: finalUsername
        });
        console.log(`   ✅ Successfully commented!`);
        if (finalUsername && finalUsername !== 'unknown') {
          console.log(`   👤 Username: @${finalUsername}`);
        }
        if (finalText) {
          console.log(`   📝 Post text: ${finalText.substring(0, 60)}${finalText.length > 60 ? '...' : ''}`);
        }
      } else {
        failed++;
        log(LOG_LEVELS.ERROR, `Failed to comment on post ${postId}`, {
          postId,
          username: finalUsername,
          error: result.error
        });
        console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);
      }

      // Safely handle result data
      results.push({
        postId: postId || 'unknown',
        username: finalUsername || null,
        text: finalText || null,
        success: result ? result.success : false,
        error: result && result.error ? result.error : null,
        comment: commentText || null
      });
      
      // Update post object for future reference
      if (finalUsername && !post.username) {
        post.username = finalUsername;
      }
      if (finalText && !post.text) {
        post.text = finalText;
      }

      // Random delay between comments (except for last post)
      if (i < posts.length - 1) {
        try {
          const delayMs = Math.floor(
            Math.random() * (commentDelayMax - commentDelayMin) + commentDelayMin
          );
          log(LOG_LEVELS.DEBUG, `Waiting ${delayMs}ms before next comment`);
          const delaySeconds = Math.round(delayMs / 1000);
          console.log(`   ⏳ Waiting ${delaySeconds} seconds before next comment...`);
          await delay(delayMs);
        } catch (delayError) {
          console.warn(`[COMMENT] Error during delay: ${delayError.message}`);
          // Continue anyway
        }
      }

    } catch (error) {
      failed++;
      const errorPost = posts[i] || {};
      const errorPostId = errorPost.post_id || errorPost.id || 'unknown';
      const errorUsername = errorPost.username || null;
      
      log(LOG_LEVELS.ERROR, `Error commenting on post ${errorPostId}`, {
        postId: errorPostId,
        username: errorUsername,
        error: error.message
      });
      
      console.error(`[COMMENT] Error processing post at index ${i}: ${error.message}`);
      if (error.stack) {
        console.error(`[COMMENT] Stack trace:`, error.stack);
      }
      
      results.push({
        postId: errorPostId,
        username: errorUsername,
        text: errorPost.text || null,
        success: false,
        error: error.message || 'Unknown error',
        comment: null
      });
      
      // Continue to next post
      continue;
      results.push({
        postId,
        username,
        success: false,
        error: error.message
      });
    }
  }

  log(LOG_LEVELS.INFO, `Finished commenting on posts`, {
    total: posts.length,
    successful,
    failed
  });
  console.log(`\n✅ Finished commenting on posts:`);
  console.log(`   Total: ${posts.length}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);

  return {
    success: true,
    total: posts.length,
    successful,
    failed,
    results
  };
}

/**
 * Browse feed and comment on filtered/random posts
 * @param {Object} options - Options
 * @param {Object} options.filterCriteria - Filter criteria for posts
 * @param {number} options.maxPostsToComment - Maximum number of posts to comment on (null = all filtered posts)
 * @param {boolean} options.randomSelection - Whether to select posts randomly (default: true)
 * @param {Array} options.commentTemplates - Custom comment templates
 * @param {number} options.commentDelayMin - Minimum delay between comments (ms)
 * @param {number} options.commentDelayMax - Maximum delay between comments (ms)
 * @param {string} options.targetUrl - Target URL (default: home feed)
 * @param {number} options.maxItems - Maximum items to extract from feed
 * @returns {Promise<Object>} Result object with statistics
 */
export async function browseFeedAndComment(options = {}) {
  // Validate options
  if (!options || typeof options !== 'object') {
    throw new Error('Options must be an object');
  }
  if (!CONFIG.interactions.enabled) {
    throw new Error('Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.');
  }

  const config = CONFIG.interactions.feedBrowsing || {};
  const filterCriteria = options.filterCriteria || config.filterCriteria || {};
  const maxPostsToComment = options.maxPostsToComment !== undefined 
    ? options.maxPostsToComment 
    : (config.maxPostsToComment !== undefined ? config.maxPostsToComment : null);
  const randomSelection = options.randomSelection !== undefined 
    ? options.randomSelection 
    : (config.randomSelection !== undefined ? config.randomSelection : true);
  const targetUrl = options.targetUrl || CONFIG.threads.url;
  const maxItems = options.maxItems || CONFIG.extraction.maxItems;

  log(LOG_LEVELS.INFO, 'Starting feed browsing and commenting', {
    filterCriteria,
    maxPostsToComment,
    randomSelection,
    targetUrl
  });

  // Extract feed data first (extractFeedData creates its own browser)
  const accountId = options.accountId || null;
  const profilePath = options.profilePath || null;
  log(LOG_LEVELS.INFO, 'Extracting feed data...', { targetUrl, accountId });
  const allPosts = await extractFeedData({
    accountId,
    profilePath,
    targetUrl,
    maxItems
  });

    log(LOG_LEVELS.INFO, `Extracted ${allPosts.length} posts from feed`);
    console.log(`\n📊 Extracted ${allPosts.length} posts from feed`);

    // Filter posts
    let filteredPosts = [];
    try {
      filteredPosts = filterPosts(allPosts, filterCriteria);
      if (!Array.isArray(filteredPosts)) {
        console.warn('[BROWSE] filterPosts did not return an array, using empty array');
        filteredPosts = [];
      }
    } catch (filterError) {
      console.error(`[BROWSE] Error filtering posts: ${filterError.message}`);
      if (filterError.stack) {
        console.error(`[BROWSE] Stack trace:`, filterError.stack);
      }
      // Continue with empty array if filtering fails
      filteredPosts = [];
    }
    
    log(LOG_LEVELS.INFO, `Filtered to ${filteredPosts.length} posts matching criteria`);
    console.log(`🔍 Filtered to ${filteredPosts.length} posts matching criteria (min_likes: ${filterCriteria.min_likes || 'N/A'})`);

    if (filteredPosts.length === 0) {
      log(LOG_LEVELS.WARN, 'No posts match the filter criteria');
      console.log('⚠️  No posts match the filter criteria. Try adjusting filterCriteria (e.g., lower min_likes)');
      return {
        success: true,
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
        console.log(`🎲 Randomly selected ${postsToComment.length} posts to comment on`);
      } else {
        postsToComment = filteredPosts.slice(0, maxPostsToComment);
        log(LOG_LEVELS.INFO, `Selected first ${postsToComment.length} posts to comment on`);
        console.log(`📝 Selected first ${postsToComment.length} posts to comment on`);
      }
    } else {
      console.log(`📝 Will comment on all ${postsToComment.length} filtered posts`);
    }

    // Show selected posts
    console.log('\n📋 Selected posts to comment:');
    postsToComment.forEach((post, i) => {
      console.log(`   ${i + 1}. Post ${post.post_id || post.id} (@${post.username || 'unknown'}) - ${post.like_count || 0} likes`);
    });
    console.log('\n💬 Starting commenting process...\n');

  // Now create browser for commenting
  let browser, context, page;
  try {
    const browserData = await launchBrowser(accountId, profilePath);
    browser = browserData.browser;
    context = browserData.context;
    page = await context.newPage();
  } catch (browserError) {
    console.error(`[BROWSE] Error launching browser: ${browserError.message}`);
    throw new Error(`Failed to launch browser: ${browserError.message}`);
  }

  try {
    // Ensure logged in
    let loginCheck;
    try {
      loginCheck = await ensureLoggedIn(page, context, accountId);
    } catch (loginError) {
      console.error(`[BROWSE] Error checking login: ${loginError.message}`);
      throw new Error(`Login check failed: ${loginError.message}`);
    }
    
    if (!loginCheck || !loginCheck.success) {
      throw new Error(`Login required: ${loginCheck?.error || 'Unknown error'}`);
    }

    // Comment on selected posts
    let commentResults;
    try {
      commentResults = await commentOnMultiplePosts(page, postsToComment, {
        accountId,
        commentTemplates: options.commentTemplates,
        commentDelayMin: options.commentDelayMin,
        commentDelayMax: options.commentDelayMax
      });
    } catch (commentError) {
      console.error(`[BROWSE] Error during commenting: ${commentError.message}`);
      if (commentError.stack) {
        console.error(`[BROWSE] Stack trace:`, commentError.stack);
      }
      // Return partial results if available
      throw new Error(`Commenting failed: ${commentError.message}`);
    }

    return {
      success: true,
      totalExtracted: allPosts.length,
      totalFiltered: filteredPosts.length,
      totalCommented: postsToComment.length,
      successful: commentResults.successful,
      failed: commentResults.failed,
      results: commentResults.results
    };

  } catch (error) {
    log(LOG_LEVELS.ERROR, 'Error during feed browsing and commenting', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    await browser.close();
  }
}

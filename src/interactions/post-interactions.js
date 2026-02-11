/**
 * Post Interactions Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to interact with Threads posts.
 * Use at your own risk.
 * 
 * NOTE: This file now acts as a re-export hub for backward compatibility.
 * The actual implementations have been split into separate feature-specific files:
 * - session.js: Session management
 * - like.js: Like/unlike functionality
 * - comment.js: Comment functionality
 * - repost.js: Repost/quote functionality and repost status checking
 * - unrepost.js: Unrepost functionality
 * - share.js: Share functionality
 * - post-status.js: Post interaction status checking
 * - post-helpers.js: Helper functions
 * - feed-browsing.js: Feed browsing and commenting functionality
 * - user-selection.js: User selection and commenting functionality
 */

// Session management
export {
  saveSession,
  loadSession,
  checkIfLoggedIn,
  loginToThreads,
  ensureLoggedIn
} from './session.js';

// Like/Unlike
export {
  likePost,
  unlikePost
} from './like.js';

// Comment
export {
  commentOnPost
} from './comment.js';

// Repost/Quote
export {
  repostPost,
  quotePost,
  getRepostStatus
} from './repost.js';

// Unrepost
export {
  unrepostPost
} from './unrepost.js';

// Share
export {
  sharePost
} from './share.js';

// Status
export {
  getPostInteractionStatus
} from './post-status.js';

// Feed Browsing
export {
  browseFeedAndComment,
  selectRandomPosts,
  commentOnMultiplePosts
} from './feed-browsing.js';

// User Selection
export {
  selectUserFromFeed,
  extractUsersFromFeed,
  commentOnUserPosts,
  selectUserAndComment
} from './user-selection.js';

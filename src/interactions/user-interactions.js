/**
 * User Interactions Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to interact with Threads users.
 * Use at your own risk.
 * 
 * NOTE: This file now acts as a re-export hub for backward compatibility.
 * The actual implementations have been split into separate feature-specific files:
 * - user-helpers.js: Helper functions for user interactions
 * - follow.js: Follow functionality
 * - unfollow.js: Unfollow functionality
 * - user-status.js: Status checking
 */

// Follow/Unfollow
export {
  followUser
} from './follow.js';

export {
  unfollowUser
} from './unfollow.js';

// Status
export {
  getUserFollowStatus
} from './user-status.js';

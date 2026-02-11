/**
 * User Follow Status Module
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This module provides functionality to check follow status of Threads users.
 * Use at your own risk.
 */

import { 
  log, 
  LOG_LEVELS, 
  retryWithBackoff, 
  validateUsername
} from './utils.js';
import { classifyError } from './errors.js';
import { navigateToUserProfile, getFollowButton } from './user-helpers.js';

/**
 * Get follow status for a user
 * @param {Page} page - Playwright page object
 * @param {string} username - Username to check
 * @returns {Promise<Object>} Status object
 */
export async function getUserFollowStatus(page, username) {
  const actionContext = { action: 'get-follow-status', username };

  try {
    const cleanUsername = validateUsername(username);

    // Navigate to user profile
    const navSuccess = await retryWithBackoff(
      () => navigateToUserProfile(page, cleanUsername),
      { maxRetries: 2, context: actionContext }
    ).catch(() => false);

    if (!navSuccess) {
      return { success: false, error: 'Failed to navigate to user profile' };
    }

    const buttonResult = await getFollowButton(page, cleanUsername);
    const isFollowing = buttonResult ? buttonResult.isFollowing : null;

    return {
      success: true,
      isFollowing: isFollowing,
      canInteract: buttonResult !== null
    };
  } catch (error) {
    const classifiedError = classifyError(error, actionContext);
    log(LOG_LEVELS.ERROR, `Error getting follow status`, {
      ...actionContext,
      error: classifiedError.message
    });
    return { success: false, error: classifiedError.message };
  }
}

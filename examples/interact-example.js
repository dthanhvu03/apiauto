/**
 * Example: Using Post Interactions
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This example demonstrates how to use the like and comment features.
 * 
 * WARNING:
 * - Enable interactions in config.js: CONFIG.interactions.enabled = true
 * - Use at your own risk
 * - May result in account restrictions or bans
 */

import { CONFIG } from '../src/config.js';
import { launchBrowser } from '../src/browser/browser-manager.js';
import { 
  likePost, 
  unlikePost, 
  commentOnPost, 
  getPostInteractionStatus, 
  loginToThreads,
  repostPost,
  quotePost,
  unrepostPost,
  sharePost,
  getRepostStatus
} from '../src/interactions/post-interactions.js';
import {
  followUser,
  unfollowUser,
  getUserFollowStatus
} from '../src/interactions/user-interactions.js';
import { decodeShortcode } from '../src/utils/shortcode-encoder.js';

// Check if interactions are enabled
if (!CONFIG.interactions.enabled) {
  console.error('❌ Interactions are disabled!');
  console.log('To enable, set CONFIG.interactions.enabled = true in src/config.js');
  console.log('⚠️  WARNING: This violates the read-only principle of this tool');
  process.exit(1);
}

// Check if login credentials are set
if (!CONFIG.interactions.login.username || !CONFIG.interactions.login.password) {
  console.warn('⚠️  WARNING: Login credentials not set!');
  console.log('Set THREADS_USERNAME and THREADS_PASSWORD environment variables,');
  console.log('or set CONFIG.interactions.login.username and password in src/config.js');
  console.log('');
  console.log('Example:');
  console.log('  export THREADS_USERNAME="your_username"');
  console.log('  export THREADS_PASSWORD="your_password"');
  console.log('');
  console.log('Or in src/config.js:');
  console.log('  login: {');
  console.log('    username: "your_username",');
  console.log('    password: "your_password"');
  console.log('  }');
  console.log('');
}

/**
 * Example 1: Like a post by post ID
 */
async function exampleLikePost() {
  console.log('\n📝 Example 1: Like a post by post ID\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    // Example post ID (replace with actual post ID)
    const postId = '3817952812169631580';
    
    console.log(`Attempting to like post: ${postId}`);
    const result = await likePost(page, postId);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyLiked) {
        console.log('   Post was already liked');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 2: Like a post by URL
 * 
 * Note: This example extracts postId from URL by decoding the shortcode.
 * If you already know the postId, you can pass it directly.
 */
async function exampleLikePostByUrl() {
  console.log('\n📝 Example 2: Like a post by URL\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postUrl = 'https://www.threads.net/@may__lily/post/DT8F9qykxdc';
    
    // Extract shortcode from URL
    const urlMatch = postUrl.match(/\/post\/([A-Za-z0-9_-]+)/);
    let postId = null;
    
    if (urlMatch) {
      const shortcode = urlMatch[1];
      try {
        // Try to decode shortcode to postId
        postId = decodeShortcode(shortcode, 'base64url').toString();
        console.log(`Extracted postId from shortcode: ${postId}`);
      } catch (error) {
        console.warn(`Could not decode shortcode ${shortcode}, will use URL directly`);
        // If decoding fails, we can still use the URL, but need a postId
        // For this example, we'll use a known postId or extract from URL
        // In practice, you might need to navigate to the page first to get postId
        console.warn('⚠️  Note: postId is required. Using known postId for this example.');
        postId = '3817952812169631580'; // Fallback to known postId
      }
    }
    
    if (!postId) {
      throw new Error('Could not extract postId from URL. Please provide postId directly.');
    }
    
    console.log(`Attempting to like post: ${postUrl}`);
    console.log(`Using postId: ${postId}`);
    const result = await likePost(page, postId, { postUrl });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 3: Unlike a post
 */
async function exampleUnlikePost() {
  console.log('\n📝 Example 3: Unlike a post\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    
    console.log(`Attempting to unlike post: ${postId}`);
    const result = await unlikePost(page, postId);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyUnliked) {
        console.log('   Post was not liked');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 4: Comment on a post
 */
async function exampleComment() {
  console.log('\n📝 Example 4: Comment on a post\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const commentText = 'i love you';
    
    console.log(`Attempting to comment on post: ${postId}`);
    console.log(`Comment: "${commentText}"`);
    const result = await commentOnPost(page, postId, commentText);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 5: Check interaction status
 */
async function exampleCheckStatus() {
  console.log('\n📝 Example 5: Check interaction status\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    
    console.log(`Checking interaction status for post: ${postId}`);
    const result = await getPostInteractionStatus(page, postId);
    
    if (result.success) {
      console.log('✅ Status retrieved:');
      console.log(`   Is Liked: ${result.isLiked}`);
      console.log(`   Can Interact: ${result.canInteract}`);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example: Manual login
 */
async function exampleLogin() {
  console.log('\n📝 Example: Manual Login\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const username = CONFIG.interactions.login.username || 'your_username';
    const password = CONFIG.interactions.login.password || 'your_password';
    
    if (username === 'your_username' || password === 'your_password') {
      console.error('❌ Please set login credentials first!');
      return;
    }
    
    console.log(`Attempting to login as: ${username}`);
    const result = await loginToThreads(page, username, password);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyLoggedIn) {
        console.log('   Already logged in');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 6: Repost a post
 */
async function exampleRepost() {
  console.log('\n📝 Example 6: Repost a post\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const username = 'may__lily';
    const shortcode = 'DT8F9qykxdc';
    
    console.log(`Attempting to repost post: ${postId}`);
    const result = await repostPost(page, postId, {
      username,
      shortcode
    });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyReposted) {
        console.log('   Post was already reposted');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 7: Quote a post with comment
 */
async function exampleQuote() {
  console.log('\n📝 Example 7: Quote a post with comment\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const quoteText = 'Great insights! 💡';
    const username = 'may__lily';
    const shortcode = 'DT8F9qykxdc';
    
    console.log(`Attempting to quote post: ${postId}`);
    console.log(`Quote text: "${quoteText}"`);
    const result = await quotePost(page, postId, quoteText, {
      username,
      shortcode
    });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 8: Unrepost a post
 */
async function exampleUnrepost() {
  console.log('\n📝 Example 8: Unrepost a post\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const username = 'may__lily';
    const shortcode = 'DT8F9qykxdc';
    
    console.log(`Attempting to unrepost post: ${postId}`);
    const result = await unrepostPost(page, postId, {
      username,
      shortcode
    });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyUnreposted) {
        console.log('   Post was not reposted');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 9: Share a post
 */
async function exampleShare() {
  console.log('\n📝 Example 9: Share a post (copy link)\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const username = 'may__lily';
    const shortcode = 'DT8F9qykxdc';
    
    console.log(`Attempting to share post: ${postId}`);
    const result = await sharePost(page, postId, 'copy', {
      username,
      shortcode
    });
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      console.log(`   Platform: ${result.platform || 'copy'}`);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 10: Follow a user
 */
async function exampleFollow() {
  console.log('\n📝 Example 10: Follow a user\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const username = 'may__lily';
    
    console.log(`Attempting to follow user: @${username}`);
    const result = await followUser(page, username);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyFollowing) {
        console.log('   User is already being followed');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 11: Unfollow a user
 */
async function exampleUnfollow() {
  console.log('\n📝 Example 11: Unfollow a user\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const username = 'may__lily';
    
    console.log(`Attempting to unfollow user: @${username}`);
    const result = await unfollowUser(page, username);
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      if (result.alreadyUnfollowed) {
        console.log('   User is not being followed');
      }
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 12: Check follow status
 */
async function exampleFollowStatus() {
  console.log('\n📝 Example 12: Check follow status\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const username = 'may__lily';
    
    console.log(`Checking follow status for user: @${username}`);
    const result = await getUserFollowStatus(page, username);
    
    if (result.success) {
      console.log('✅ Status retrieved:');
      console.log(`   Is Following: ${result.isFollowing ? 'Yes' : 'No'}`);
      console.log(`   Can Interact: ${result.canInteract ? 'Yes' : 'No'}`);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Example 13: Check repost status
 */
async function exampleRepostStatus() {
  console.log('\n📝 Example 13: Check repost status\n');
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    const postId = '3817952812169631580';
    const username = 'may__lily';
    const shortcode = 'DT8F9qykxdc';
    
    console.log(`Checking repost status for post: ${postId}`);
    const result = await getRepostStatus(page, postId, {
      username,
      shortcode
    });
    
    if (result.success) {
      console.log('✅ Status retrieved:');
      console.log(`   Is Reposted: ${result.isReposted ? 'Yes' : 'No'}`);
      console.log(`   Can Interact: ${result.canInteract ? 'Yes' : 'No'}`);
    } else {
      console.error('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * Main function - run examples
 */
async function main() {
  console.log('🚀 Post Interactions Examples');
  console.log('⚠️  WARNING: This feature violates the read-only principle');
  console.log('   Use at your own risk!\n');

  // Uncomment the example you want to run:
  
  // await exampleLogin(); // Login manually first
  // await exampleLikePost();
  // await exampleLikePostByUrl();
  // await exampleUnlikePost();
  // await exampleComment();
  // await exampleCheckStatus();
  // await exampleRepost();
  // await exampleQuote();
  // await exampleUnrepost();
  // await exampleShare();
  // await exampleFollow();
  // await exampleUnfollow();
  // await exampleFollowStatus();
  // await exampleRepostStatus();

  console.log('\n💡 Uncomment examples in the code to run them');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleLogin,
  exampleLikePost,
  exampleLikePostByUrl,
  exampleUnlikePost,
  exampleComment,
  exampleCheckStatus,
  exampleRepost,
  exampleQuote,
  exampleUnrepost,
  exampleShare,
  exampleFollow,
  exampleUnfollow,
  exampleFollowStatus,
  exampleRepostStatus
};

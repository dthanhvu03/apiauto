/**
 * Quick Test Script for New Interaction Features
 * 
 * This script tests the new interaction features:
 * - Repost/Quote/Share
 * - Follow/Unfollow
 * 
 * ⚠️ WARNING: This will perform actual actions on Threads
 * Use with a test account only!
 */

import { CONFIG } from './src/config.js';
import { launchBrowser } from './src/browser/browser-manager.js';
import { 
  repostPost,
  quotePost,
  sharePost,
  getPostInteractionStatus
} from './src/interactions/post-interactions.js';
import {
  followUser,
  unfollowUser,
  getUserFollowStatus
} from './src/interactions/user-interactions.js';

// Test configuration
const TEST_CONFIG = {
  // Test post (replace with a real post ID)
  testPostId: '3817952812169631580',
  testPostUrl: null, // Optional: direct URL
  testUsername: 'may__lily', // Optional: for constructing URL
  testShortcode: 'DT8F9qykxdc', // Optional: for constructing URL
  
  // Test user to follow/unfollow
  testUserToFollow: 'may__lily',
  
  // Which tests to run
  tests: {
    repost: false,      // Set to true to test repost
    quote: false,       // Set to true to test quote
    share: false,       // Set to true to test share
    follow: false,      // Set to true to test follow
    unfollow: false,    // Set to true to test unfollow
    followStatus: false  // Set to true to test follow status check
  }
};

/**
 * Test repost functionality
 */
async function testRepost(page) {
  console.log('\n📋 Testing Repost...');
  console.log('─'.repeat(50));
  
  try {
    console.log(`   Post ID: ${TEST_CONFIG.testPostId}`);
    console.log(`   URL: https://www.threads.net/@${TEST_CONFIG.testUsername}/post/${TEST_CONFIG.testShortcode}`);
    console.log('   Looking for repost button...');
    
    const result = await repostPost(page, TEST_CONFIG.testPostId, {
      username: TEST_CONFIG.testUsername,
      shortcode: TEST_CONFIG.testShortcode,
      postUrl: TEST_CONFIG.testPostUrl
    });
    
    if (result.success) {
      console.log('✅ Repost test PASSED');
      console.log(`   Message: ${result.message}`);
      if (result.alreadyReposted) {
        console.log('   ⚠️  Post is already reposted');
      }
      if (result.verified !== undefined) {
        console.log(`   Verified: ${result.verified ? 'Yes' : 'No (uncertain)'}`);
      }
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Repost test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
      console.log(`   Recoverable: ${result.recoverable ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('❌ Repost test ERROR');
    console.log(`   ${error.message}`);
    if (error.stack) {
      console.log(`   Stack: ${error.stack.split('\n')[1]}`);
    }
  }
}

/**
 * Test quote functionality
 */
async function testQuote(page) {
  console.log('\n📋 Testing Quote...');
  console.log('─'.repeat(50));
  
  try {
    const quoteText = 'Test quote from automation script 🤖';
    const result = await quotePost(page, TEST_CONFIG.testPostId, quoteText, {
      username: TEST_CONFIG.testUsername,
      shortcode: TEST_CONFIG.testShortcode,
      postUrl: TEST_CONFIG.testPostUrl
    });
    
    if (result.success) {
      console.log('✅ Quote test PASSED');
      console.log(`   Message: ${result.message}`);
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Quote test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
      console.log(`   Recoverable: ${result.recoverable ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('❌ Quote test ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Test share functionality
 */
async function testShare(page) {
  console.log('\n📋 Testing Share...');
  console.log('─'.repeat(50));
  
  try {
    const result = await sharePost(page, TEST_CONFIG.testPostId, 'copy', {
      username: TEST_CONFIG.testUsername,
      shortcode: TEST_CONFIG.testShortcode,
      postUrl: TEST_CONFIG.testPostUrl
    });
    
    if (result.success) {
      console.log('✅ Share test PASSED');
      console.log(`   Message: ${result.message}`);
      console.log(`   Platform: ${result.platform || 'N/A'}`);
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Share test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
      console.log(`   Recoverable: ${result.recoverable ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('❌ Share test ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Test follow functionality
 */
async function testFollow(page) {
  console.log('\n📋 Testing Follow...');
  console.log('─'.repeat(50));
  
  try {
    const result = await followUser(page, TEST_CONFIG.testUserToFollow);
    
    if (result.success) {
      console.log('✅ Follow test PASSED');
      console.log(`   Message: ${result.message}`);
      if (result.alreadyFollowing) {
        console.log('   ⚠️  User is already being followed');
      }
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Follow test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
      console.log(`   Recoverable: ${result.recoverable ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('❌ Follow test ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Test unfollow functionality
 */
async function testUnfollow(page) {
  console.log('\n📋 Testing Unfollow...');
  console.log('─'.repeat(50));
  
  try {
    const result = await unfollowUser(page, TEST_CONFIG.testUserToFollow);
    
    if (result.success) {
      console.log('✅ Unfollow test PASSED');
      console.log(`   Message: ${result.message}`);
      if (result.alreadyUnfollowed) {
        console.log('   ⚠️  User is not being followed');
      }
      if (result.duration) {
        console.log(`   Duration: ${result.duration}ms`);
      }
    } else {
      console.log('❌ Unfollow test FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Error Code: ${result.errorCode || 'N/A'}`);
      console.log(`   Recoverable: ${result.recoverable ? 'Yes' : 'No'}`);
    }
  } catch (error) {
    console.log('❌ Unfollow test ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Test follow status check
 */
async function testFollowStatus(page) {
  console.log('\n📋 Testing Follow Status Check...');
  console.log('─'.repeat(50));
  
  try {
    const result = await getUserFollowStatus(page, TEST_CONFIG.testUserToFollow);
    
    if (result.success) {
      console.log('✅ Follow Status test PASSED');
      console.log(`   Is Following: ${result.isFollowing ? 'Yes' : 'No'}`);
      console.log(`   Can Interact: ${result.canInteract ? 'Yes' : 'No'}`);
    } else {
      console.log('❌ Follow Status test FAILED');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Follow Status test ERROR');
    console.log(`   ${error.message}`);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Testing New Interaction Features');
  console.log('═'.repeat(50));
  console.log('⚠️  WARNING: This will perform actual actions on Threads');
  console.log('   Use with a test account only!\n');
  
  // Check if interactions are enabled
  if (!CONFIG.interactions.enabled) {
    console.error('❌ Interactions are disabled!');
    console.error('   Set CONFIG.interactions.enabled = true in src/config.js');
    process.exit(1);
  }
  
  // Check if any tests are enabled
  const hasTests = Object.values(TEST_CONFIG.tests).some(v => v === true);
  if (!hasTests) {
    console.log('ℹ️  No tests enabled. Edit TEST_CONFIG.tests in this file to enable tests.');
    console.log('   Example: tests: { repost: true, follow: true }');
    process.exit(0);
  }
  
  console.log('📝 Test Configuration:');
  console.log(`   Post ID: ${TEST_CONFIG.testPostId}`);
  console.log(`   Test User: @${TEST_CONFIG.testUserToFollow}`);
  console.log(`   Enabled Tests: ${Object.entries(TEST_CONFIG.tests)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name)
    .join(', ')}`);
  console.log('');
  
  // Option to run in non-headless mode to see browser
  const showBrowser = process.env.SHOW_BROWSER === 'true' || process.argv.includes('--show-browser');
  if (showBrowser) {
    console.log('👀 Running in visible mode (browser will be shown)');
    console.log('   To run in visible mode: SHOW_BROWSER=true node test-interactions.js');
    console.log('   Or: node test-interactions.js --show-browser\n');
  }
  
  // Temporarily override headless setting if showBrowser is true
  const originalHeadless = CONFIG.browser.headless;
  if (showBrowser) {
    CONFIG.browser.headless = false;
  }
  
  const { browser, context } = await launchBrowser();
  const page = await context.newPage();
  
  // Restore original setting
  if (showBrowser) {
    CONFIG.browser.headless = originalHeadless;
  }
  
  try {
    // Run enabled tests
    if (TEST_CONFIG.tests.repost) {
      await testRepost(page);
    }
    
    if (TEST_CONFIG.tests.quote) {
      await testQuote(page);
    }
    
    if (TEST_CONFIG.tests.share) {
      await testShare(page);
    }
    
    if (TEST_CONFIG.tests.follow) {
      await testFollow(page);
    }
    
    if (TEST_CONFIG.tests.unfollow) {
      await testUnfollow(page);
    }
    
    if (TEST_CONFIG.tests.followStatus) {
      await testFollowStatus(page);
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log('✅ All enabled tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await browser.close();
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests, TEST_CONFIG };

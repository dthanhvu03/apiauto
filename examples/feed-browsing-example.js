/**
 * Example: Feed Browsing and Commenting
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This example demonstrates how to use the feed browsing and commenting features:
 * 1. Browse feed, filter posts, and comment randomly
 * 2. Select a user from feed and comment on their posts
 * 
 * WARNING:
 * - Enable interactions in config.js: CONFIG.interactions.enabled = true
 * - Use at your own risk
 * - May result in account restrictions or bans
 */

import { CONFIG } from '../src/config.js';
import {
  browseFeedAndComment,
  selectUserAndComment,
  commentOnUserPosts,
  selectUserFromFeed,
  extractUsersFromFeed,
  loginToThreads,
  loadSession,
  saveSession,
  checkIfLoggedIn
} from '../src/interactions/post-interactions.js';
import { extractFeedData } from '../src/extractor.js';
import { filterPosts } from '../src/filters/post-filter.js';
import { launchBrowser } from '../src/browser/browser-manager.js';

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
}

/**
 * Helper function to ensure login before running examples
 */
async function ensureLogin() {
  const username = CONFIG.interactions.login.username;
  const password = CONFIG.interactions.login.password;

  if (!username || !password || username === 'your_username' || password === 'your_password') {
    console.error('❌ Login credentials not set!');
    console.log('Please set CONFIG.interactions.login.username and password in src/config.js');
    console.log('or set THREADS_USERNAME and THREADS_PASSWORD environment variables');
    return false;
  }

  console.log('🔐 Checking login status...');

  const { browser, context } = await launchBrowser();
  const page = await context.newPage();

  try {
    // Try to load saved session first
    const sessionLoaded = await loadSession(context, CONFIG.interactions.login.sessionStoragePath);

    if (sessionLoaded) {
      // Check if session is still valid
      const isLoggedIn = await checkIfLoggedIn(page, false);

      if (isLoggedIn) {
        console.log('✅ Using saved session');
        await browser.close();
        return true;
      } else {
        console.log('⚠️  Saved session expired, logging in again...');
      }
    }

    // Login if needed
    console.log(`🔑 Logging in as: ${username}`);
    const result = await loginToThreads(page, username, password);

    if (result.success) {
      console.log('✅ Login successful!');
      if (result.alreadyLoggedIn) {
        console.log('   (Already logged in)');
      }

      // Save session
      await saveSession(context, CONFIG.interactions.login.sessionStoragePath);
      console.log('💾 Session saved');

      await browser.close();
      return true;
    } else {
      console.error('❌ Login failed:', result.error);
      await browser.close();
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    await browser.close();
    return false;
  }
}

/**
 * Example 1: Browse feed and comment on filtered posts
 */
async function exampleBrowseFeedAndComment() {
  console.log('\n📝 Example 1: Browse feed and comment on filtered posts\n');

  try {
    console.log('⏳ Starting feed extraction and commenting process...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction and commenting delays\n');

    /**
     * browseFeedAndComment() trả về object với các fields:
     * 
     * {
     *   success: boolean,              // true nếu thành công
     *   totalExtracted: number,        // Tổng số posts đã extract từ feed
     *   totalFiltered: number,        // Số posts sau khi filter theo criteria
     *   totalCommented: number,        // Số posts đã comment (có thể < totalFiltered nếu có maxPostsToComment)
     *   successful: number,            // Số comments thành công
     *   failed: number,                // Số comments thất bại
     *   results: Array<CommentResult>  // Chi tiết từng comment result
     * }
     * 
     * Mỗi CommentResult trong results array có:
     * {
     *   postId: string,        // Post ID
     *   username: string|null, // Username của post author (có thể null)
     *   text: string|null,     // Text content của post (có thể null)
     *   success: boolean,      // true nếu comment thành công
     *   error: string|null,    // Error message nếu thất bại
     *   comment: string|null   // Comment text đã post
     * }
     */
    const result = await browseFeedAndComment({
      // Filter criteria - only comment on posts with >= 10 likes
      filterCriteria: {
        min_likes: 500
      },
      // Comment on maximum 3 posts (reduce to avoid rate limiting)
      maxPostsToComment:80,
      // Select posts randomly
      randomSelection: true,
      // Limit feed extraction to avoid timeout (reduce if still timing out)
      maxItems: 500,  
      // Custom comment templates (optional)
      commentTemplates: [
        'ủa đúng k ta',
        'có ai thấy giống v k',
        'này là sao trời',
        'coi mà quen ghê',
        'tự nhiên thấy mình trong đó',
        'k biết mn sao chứ t thấy vậy á',
        'cái này bàn đc nè',
        'ai gặp cái này chưa',
        'coi xong là muốn vô đọc cmt liền',
        'ủa r là đúng hay sai v',
        'này mỗi ng mỗi ý á',
        't thấy cũng hợp lý mà',
        'coi tới cuối là hiểu liền',
        'có mình t nghĩ vậy k',
        'này mà nói ra là cãi đc liền',
        'coi mà thấy đúng ghê',
        'mn thấy sao chứ t thấy ok',
        'này là trúng tim đen r',
        'coi mà hơi nhột nhột á',
        'k biết nói sao nhưng thấy quen',
        'coi cái là hiểu liền á',
        'này chắc nhiều ng dính',
        'coi mà gật gù luôn',
        'cmt chắc vui lắm nè',
        'ai rảnh vô bàn thử coi'
      ],


      // Delay between comments (5-15 seconds) - human-like behavior
      commentDelayMin: 5000,
      commentDelayMax: 15000
    });

    console.log('\n✅ Feed browsing and commenting completed:');
    console.log(`   📊 Total posts extracted: ${result.totalExtracted}`);
    console.log(`   🔍 Posts matching filter: ${result.totalFiltered}`);
    console.log(`   💬 Posts commented on: ${result.totalCommented}`);
    console.log(`   ✅ Successful comments: ${result.successful}`);
    console.log(`   ❌ Failed comments: ${result.failed}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📝 Detailed results:');
      result.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const comment = r.comment ? `"${r.comment.substring(0, 30)}${r.comment.length > 30 ? '...' : ''}"` : '';
        const username = r.username && r.username !== 'unknown' ? `@${r.username}` : '@unknown';
        console.log(`   ${i + 1}. Post ${r.postId} (${username}) ${status}`);
        if (r.text) {
          console.log(`      📝 Post: "${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}"`);
        }
        if (comment) console.log(`      💬 Comment: ${comment}`);
        if (r.error) console.log(`      ❌ Error: ${r.error}`);
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
      console.log('   - Rate limiting');
      console.log('   - Post restrictions');
      console.log('   - Network issues');
    }
  } catch (error) {
    console.error('\n❌ Error during feed browsing and commenting:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 2: Browse feed and comment on posts with multiple filters
 */
async function exampleBrowseFeedWithMultipleFilters() {
  console.log('\n📝 Example 2: Browse feed with multiple filters\n');

  try {
    console.log('⏳ Starting feed extraction and commenting process...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction and commenting delays\n');

    const result = await browseFeedAndComment({
      // Multiple filter criteria
      filterCriteria: {
        min_likes: 50,      // Posts with >= 50 likes
        has_media: true,    // AND has media (images/videos)
        min_replies: 5      // AND has >= 5 replies
      },
      maxPostsToComment: 5,
      randomSelection: true
    });

    console.log('\n✅ Feed browsing and commenting completed:');
    console.log(`   📊 Total posts extracted: ${result.totalExtracted}`);
    console.log(`   🔍 Posts matching filter: ${result.totalFiltered}`);
    console.log(`   💬 Posts commented on: ${result.totalCommented}`);
    console.log(`   ✅ Successful comments: ${result.successful}`);
    console.log(`   ❌ Failed comments: ${result.failed}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📝 Detailed results:');
      result.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const comment = r.comment ? `"${r.comment.substring(0, 30)}${r.comment.length > 30 ? '...' : ''}"` : '';
        const username = r.username && r.username !== 'unknown' ? `@${r.username}` : '@unknown';
        console.log(`   ${i + 1}. Post ${r.postId} (${username}) ${status}`);
        if (r.text) {
          console.log(`      📝 Post: "${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}"`);
        }
        if (comment) console.log(`      💬 Comment: ${comment}`);
        if (r.error) console.log(`      ❌ Error: ${r.error}`);
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
      console.log('   - Rate limiting');
      console.log('   - Post restrictions');
      console.log('   - Network issues');
    }
  } catch (error) {
    console.error('\n❌ Error during feed browsing and commenting:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 3: Select a user from feed and comment on their posts
 */
async function exampleSelectUserAndComment() {
  console.log('\n📝 Example 3: Select user from feed and comment on their posts\n');

  try {
    console.log('⏳ Starting user selection and commenting process...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction and commenting delays\n');

    const result = await selectUserAndComment({
      // Select random user (or specify username: 'may__lily')
      username: null, // null = random selection
      // Filter criteria for user posts
      filterCriteria: {
        min_likes: 20
      },
      // Comment on maximum 3 posts from this user
      maxPostsToComment: 3,
      randomSelection: true
    });

    console.log('\n✅ User selection and commenting completed:');
    console.log(`   👤 Selected user: @${result.selectedUsername || result.username}`);
    console.log(`   📊 Total posts extracted: ${result.totalExtracted}`);
    console.log(`   🔍 Posts matching filter: ${result.totalFiltered}`);
    console.log(`   💬 Posts commented on: ${result.totalCommented}`);
    console.log(`   ✅ Successful comments: ${result.successful}`);
    console.log(`   ❌ Failed comments: ${result.failed}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📝 Detailed results:');
      result.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const comment = r.comment ? `"${r.comment.substring(0, 30)}${r.comment.length > 30 ? '...' : ''}"` : '';
        const username = r.username && r.username !== 'unknown' ? `@${r.username}` : '@unknown';
        console.log(`   ${i + 1}. Post ${r.postId} (${username}) ${status}`);
        if (r.text) {
          console.log(`      📝 Post: "${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}"`);
        }
        if (comment) console.log(`      💬 Comment: ${comment}`);
        if (r.error) console.log(`      ❌ Error: ${r.error}`);
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
      console.log('   - Rate limiting');
      console.log('   - Post restrictions');
      console.log('   - Network issues');
    }
  } catch (error) {
    console.error('\n❌ Error during user selection and commenting:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 4: Comment on posts from a specific user
 */
async function exampleCommentOnSpecificUser() {
  console.log('\n📝 Example 4: Comment on posts from specific user\n');

  try {
    console.log('⏳ Starting commenting on user posts...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction and commenting delays\n');

    const username = 'may__lily'; // Replace with actual username

    const result = await commentOnUserPosts(username, {
      filterCriteria: {
        min_likes: 10
      },
      maxPostsToComment: 3,
      randomSelection: true
    });

    console.log('\n✅ Commenting on user posts completed:');
    console.log(`   👤 User: @${result.username}`);
    console.log(`   📊 Total posts extracted: ${result.totalExtracted}`);
    console.log(`   🔍 Posts matching filter: ${result.totalFiltered}`);
    console.log(`   💬 Posts commented on: ${result.totalCommented}`);
    console.log(`   ✅ Successful comments: ${result.successful}`);
    console.log(`   ❌ Failed comments: ${result.failed}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📝 Detailed results:');
      result.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const comment = r.comment ? `"${r.comment.substring(0, 30)}${r.comment.length > 30 ? '...' : ''}"` : '';
        const resultUsername = r.username && r.username !== 'unknown' ? `@${r.username}` : '@unknown';
        console.log(`   ${i + 1}. Post ${r.postId} (${resultUsername}) ${status}`);
        if (r.text) {
          console.log(`      📝 Post: "${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}"`);
        }
        if (comment) console.log(`      💬 Comment: ${comment}`);
        if (r.error) console.log(`      ❌ Error: ${r.error}`);
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
      console.log('   - Rate limiting');
      console.log('   - Post restrictions');
      console.log('   - Network issues');
    }
  } catch (error) {
    console.error('\n❌ Error during commenting on user posts:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 5: Extract users from feed and select one
 */
async function exampleExtractAndSelectUser() {
  console.log('\n📝 Example 5: Extract users from feed and select one\n');

  try {
    console.log('⏳ Starting feed extraction...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction\n');

    // Extract feed data
    console.log('📥 Extracting feed data...');
    const posts = await extractFeedData({
      maxItems: 20 // Extract first 20 posts
    });

    console.log(`\n✅ Feed extraction completed:`);
    console.log(`   📊 Total posts extracted: ${posts.length}`);

    // Show sample posts
    if (posts.length > 0) {
      console.log('\n   📝 Sample posts:');
      posts.slice(0, 5).forEach((post, i) => {
        const username = post.username && post.username !== 'unknown' ? `@${post.username}` : '@unknown';
        const text = post.text ? `"${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}"` : '(no text)';
        const likes = post.like_count || 0;
        const replies = post.reply_count || 0;
        console.log(`   ${i + 1}. ${username} - ${text}`);
        console.log(`      👍 ${likes} likes | 💬 ${replies} replies`);
      });
      if (posts.length > 5) {
        console.log(`   ... and ${posts.length - 5} more posts`);
      }
    }

    // Extract unique users
    const users = extractUsersFromFeed(posts);
    console.log(`\n👥 Unique users found: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n   📋 User list:');
      users.slice(0, 10).forEach((u, i) => {
        const userPosts = posts.filter(p => p.username === u);
        const totalLikes = userPosts.reduce((sum, p) => sum + (p.like_count || 0), 0);
        console.log(`   ${i + 1}. @${u} (${userPosts.length} post${userPosts.length !== 1 ? 's' : ''}, ${totalLikes} total likes)`);
      });
      if (users.length > 10) {
        console.log(`   ... and ${users.length - 10} more users`);
      }
    }

    // Select a user (random or specific)
    const selectedUser = selectUserFromFeed(posts, null); // null = random
    const selectedUserPosts = posts.filter(p => p.username === selectedUser);
    const selectedUserTotalLikes = selectedUserPosts.reduce((sum, p) => sum + (p.like_count || 0), 0);
    
    console.log(`\n🎯 Selected user: @${selectedUser}`);
    console.log(`   📊 Posts in feed: ${selectedUserPosts.length}`);
    console.log(`   👍 Total likes: ${selectedUserTotalLikes}`);
    
    if (selectedUserPosts.length > 0) {
      console.log('\n   📝 Selected user\'s posts in feed:');
      selectedUserPosts.slice(0, 3).forEach((post, i) => {
        const text = post.text ? `"${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}"` : '(no text)';
        const likes = post.like_count || 0;
        const replies = post.reply_count || 0;
        console.log(`   ${i + 1}. ${text}`);
        console.log(`      👍 ${likes} likes | 💬 ${replies} replies`);
      });
      if (selectedUserPosts.length > 3) {
        console.log(`   ... and ${selectedUserPosts.length - 3} more posts`);
      }
    }

    console.log('\n💡 Tip: You can now use commentOnUserPosts() with the selected user');
    console.log('   Example: await commentOnUserPosts(selectedUser, { ... });');

    // Return the selected user for potential use
    return {
      selectedUser,
      totalPosts: posts.length,
      uniqueUsers: users.length,
      selectedUserPostsCount: selectedUserPosts.length,
      posts
    };
  } catch (error) {
    console.error('\n❌ Error during feed extraction and user selection:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    throw error;
  }
}

/**
 * Example 6: Browse feed with custom comment templates
 */
async function exampleCustomCommentTemplates() {
  console.log('\n📝 Example 6: Browse feed with custom comment templates\n');

  try {
    console.log('⏳ Starting feed extraction and commenting process...\n');
    console.log('⚠️  Note: This may take a few minutes due to feed extraction and commenting delays\n');

    const result = await browseFeedAndComment({
      filterCriteria: {
        min_likes: 10
      },
      maxPostsToComment: 2,
      // Custom comment templates with variables
      commentTemplates: [
        'Great post @{username}! 👍',
        'Love this content from @{username}! ❤️',
        'Amazing work @{username}! 🔥',
        'Thanks for sharing @{username}!'
      ]
    });

    console.log('\n✅ Feed browsing and commenting completed:');
    console.log(`   📊 Total posts extracted: ${result.totalExtracted}`);
    console.log(`   🔍 Posts matching filter: ${result.totalFiltered}`);
    console.log(`   💬 Posts commented on: ${result.totalCommented}`);
    console.log(`   ✅ Successful comments: ${result.successful}`);
    console.log(`   ❌ Failed comments: ${result.failed}`);

    if (result.results && result.results.length > 0) {
      console.log('\n   📝 Detailed results:');
      result.results.forEach((r, i) => {
        const status = r.success ? '✅' : '❌';
        const comment = r.comment ? `"${r.comment.substring(0, 30)}${r.comment.length > 30 ? '...' : ''}"` : '';
        const username = r.username && r.username !== 'unknown' ? `@${r.username}` : '@unknown';
        console.log(`   ${i + 1}. Post ${r.postId} (${username}) ${status}`);
        if (r.text) {
          console.log(`      📝 Post: "${r.text.substring(0, 60)}${r.text.length > 60 ? '...' : ''}"`);
        }
        if (comment) console.log(`      💬 Comment: ${comment}`);
        if (r.error) console.log(`      ❌ Error: ${r.error}`);
      });
    }

    if (result.failed > 0) {
      console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
      console.log('   - Rate limiting');
      console.log('   - Post restrictions');
      console.log('   - Network issues');
    }
  } catch (error) {
    console.error('\n❌ Error during feed browsing and commenting:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Main function - run examples
 */
async function main() {
  console.log('🚀 Feed Browsing and Commenting Examples');
  console.log('⚠️  WARNING: This feature violates the read-only principle');
  console.log('   Use at your own risk!\n');

  // Ensure login before running examples
  const loginSuccess = await ensureLogin();
  if (!loginSuccess) {
    console.error('\n❌ Cannot proceed without login. Please check your credentials.');
    process.exit(1);
  }

  console.log('\n✅ Ready to run examples!\n');

  // Uncomment the example you want to run:

  await exampleBrowseFeedAndComment();
  // await exampleBrowseFeedWithMultipleFilters();
  // await exampleSelectUserAndComment();
  // await exampleCommentOnSpecificUser();
  // await exampleExtractAndSelectUser();
  // await exampleCustomCommentTemplates();

  console.log('\n💡 Uncomment examples in the code to run them');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleBrowseFeedAndComment,
  exampleBrowseFeedWithMultipleFilters,
  exampleSelectUserAndComment,
  exampleCommentOnSpecificUser,
  exampleExtractAndSelectUser,
  exampleCustomCommentTemplates
};

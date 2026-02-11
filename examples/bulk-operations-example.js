/**
 * Example: Bulk Like and Bulk Comment Operations
 * 
 * ⚠️ EXPERIMENTAL FEATURE - Violates read-only principle
 * 
 * This example demonstrates how to use the bulk operations features:
 * 1. Bulk like multiple posts from a list of post IDs
 * 2. Bulk comment on multiple posts from a list of post IDs
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
  commentOnPost,
  loginToThreads,
  loadSession,
  saveSession,
  checkIfLoggedIn
} from '../src/interactions/post-interactions.js';

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
 * Example 1: Bulk Like Multiple Posts
 * 
 * Like hàng loạt nhiều posts từ danh sách post IDs
 */
async function exampleBulkLike() {
  console.log('\n📝 Example 1: Bulk Like Multiple Posts\n');

  try {
    console.log('⏳ Starting bulk like operation...\n');
    console.log('⚠️  Note: This may take a few minutes due to delays between likes\n');

    // Danh sách posts cần like
    // Thay thế bằng post IDs thực tế của bạn
    const posts = [
      {
        postId: '3817952812169631580',
        username: 'may__lily',
        shortcode: 'DT8F9qykxdc'
      },
      {
        postId: '3817952812169631581',
        username: 'another_user'
      },
      // Thêm nhiều posts khác nếu cần
    ];

    if (posts.length === 0 || !posts[0].postId) {
      console.warn('⚠️  Please update the posts array with actual post IDs');
      console.log('   Example:');
      console.log('   const posts = [');
      console.log('     { postId: "3817952812169631580", username: "may__lily", shortcode: "DT8F9qykxdc" },');
      console.log('     { postId: "3817952812169631581", username: "another_user" }');
      console.log('   ];');
      return;
    }

    const accountId = null; // Có thể set account ID nếu cần
    const profilePath = null; // Có thể set profile path nếu cần

    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      // Options cho bulk operation
      const options = {
        continue_on_error: true, // Tiếp tục nếu một post fail
        delay_between_likes: 3000 // Delay 3 giây giữa các likes
      };

      const results = [];
      let successful = 0;
      let failed = 0;

      console.log(`📊 Processing ${posts.length} posts...\n`);

      // Process each post sequentially
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postId = post.postId;
        const { username, shortcode, postUrl } = post;

        try {
          console.log(`[${i + 1}/${posts.length}] 👍 Liking post ${postId}${username ? ` (@${username})` : ''}`);

          const result = await likePost(page, postId, { username, shortcode, postUrl, accountId });

          if (result.success) {
            successful++;
            results.push({
              postId: postId,
              success: true,
              alreadyLiked: result.alreadyLiked || false,
              message: result.message || 'Post liked successfully'
            });
            console.log(`   ✅ ${result.alreadyLiked ? 'Already liked' : 'Liked successfully'}`);
          } else {
            failed++;
            results.push({
              postId: postId,
              success: false,
              error: result.error || 'Like failed',
              message: result.message || null
            });
            console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);

            if (!options.continue_on_error) {
              throw new Error(`Like failed for post ${postId}: ${result.error}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`   ❌ Error: ${error.message}`);
          results.push({
            postId: postId,
            success: false,
            error: error.message || 'Unknown error'
          });

          if (!options.continue_on_error) {
            throw error;
          }
        }

        // Delay between likes (except for the last one)
        if (i < posts.length - 1 && options.delay_between_likes > 0) {
          console.log(`   ⏳ Waiting ${options.delay_between_likes}ms before next like...\n`);
          await new Promise(resolve => setTimeout(resolve, options.delay_between_likes));
        }
      }

      console.log('\n✅ Bulk like operation completed:');
      console.log(`   📊 Total posts: ${posts.length}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${failed}`);

      if (results.length > 0) {
        console.log('\n   📝 Detailed results:');
        results.forEach((r, i) => {
          const status = r.success ? '✅' : '❌';
          const alreadyLiked = r.alreadyLiked ? ' (already liked)' : '';
          console.log(`   ${i + 1}. Post ${r.postId} ${status}${alreadyLiked}`);
          if (r.message) console.log(`      ${r.message}`);
          if (r.error) console.log(`      Error: ${r.error}`);
        });
      }

      if (failed > 0) {
        console.log('\n⚠️  Some likes failed. This is normal and may be due to:');
        console.log('   - Rate limiting');
        console.log('   - Post restrictions');
        console.log('   - Network issues');
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('\n❌ Error during bulk like operation:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 2: Bulk Comment Multiple Posts
 * 
 * Comment hàng loạt trên nhiều posts từ danh sách post IDs
 */
async function exampleBulkComment() {
  console.log('\n📝 Example 2: Bulk Comment Multiple Posts\n');

  try {
    console.log('⏳ Starting bulk comment operation...\n');
    console.log('⚠️  Note: This may take a few minutes due to delays between comments\n');

    // Danh sách posts cần comment
    // Thay thế bằng post IDs thực tế của bạn
    const posts = [
      {
        postId: '3817952812169631580',
        username: 'may__lily',
        shortcode: 'DT8F9qykxdc',
        comment: 'Great post! 👍' // Comment cụ thể cho post này
      },
      {
        postId: '3817952812169631581',
        username: 'another_user',
        // Không có comment cụ thể, sẽ dùng commentTemplates
      },
      // Thêm nhiều posts khác nếu cần
    ];

    if (posts.length === 0 || !posts[0].postId) {
      console.warn('⚠️  Please update the posts array with actual post IDs');
      console.log('   Example:');
      console.log('   const posts = [');
      console.log('     { postId: "3817952812169631580", username: "may__lily", comment: "Great post!" },');
      console.log('     { postId: "3817952812169631581" } // Will use commentTemplates');
      console.log('   ];');
      return;
    }

    const accountId = null; // Có thể set account ID nếu cần
    const profilePath = null; // Có thể set profile path nếu cần

    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      // Comment templates để chọn ngẫu nhiên nếu post không có comment cụ thể
      const commentTemplates = [
        'Nice post! 👍',
        'Great content!',
        'Thanks for sharing!',
        'Love this! ❤️',
        'Amazing! 🔥'
      ];

      // Options cho bulk operation
      const options = {
        continue_on_error: true, // Tiếp tục nếu một post fail
        delay_between_comments: 5000 // Delay 5 giây giữa các comments
      };

      // Helper function để lấy comment text
      const getCommentText = (post) => {
        if (post.comment) {
          return post.comment;
        }
        if (commentTemplates && commentTemplates.length > 0) {
          const randomIndex = Math.floor(Math.random() * commentTemplates.length);
          return commentTemplates[randomIndex];
        }
        return null;
      };

      const results = [];
      let successful = 0;
      let failed = 0;

      console.log(`📊 Processing ${posts.length} posts...\n`);

      // Process each post sequentially
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postId = post.postId;
        const { username, shortcode, postUrl } = post;
        const commentText = getCommentText(post);

        if (!commentText || commentText.trim().length === 0) {
          failed++;
          console.log(`[${i + 1}/${posts.length}] ⚠️  Post ${postId}: Missing comment text`);
          results.push({
            postId: postId,
            success: false,
            error: 'Comment text is required',
            comment: null
          });

          if (!options.continue_on_error) {
            throw new Error(`Comment text is required for post ${postId}`);
          }
          continue;
        }

        try {
          console.log(`[${i + 1}/${posts.length}] 💬 Commenting on post ${postId}${username ? ` (@${username})` : ''}`);
          console.log(`   Comment: "${commentText}"`);

          const result = await commentOnPost(page, postId, commentText, { username, shortcode, postUrl, accountId });

          if (result.success) {
            successful++;
            results.push({
              postId: postId,
              success: true,
              comment: commentText,
              message: result.message || 'Comment posted successfully'
            });
            console.log(`   ✅ Comment posted successfully`);
          } else {
            failed++;
            results.push({
              postId: postId,
              success: false,
              error: result.error || 'Comment failed',
              comment: commentText,
              message: result.message || null
            });
            console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);

            if (!options.continue_on_error) {
              throw new Error(`Comment failed for post ${postId}: ${result.error}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`   ❌ Error: ${error.message}`);
          results.push({
            postId: postId,
            success: false,
            error: error.message || 'Unknown error',
            comment: commentText
          });

          if (!options.continue_on_error) {
            throw error;
          }
        }

        // Delay between comments (except for the last one)
        if (i < posts.length - 1 && options.delay_between_comments > 0) {
          console.log(`   ⏳ Waiting ${options.delay_between_comments}ms before next comment...\n`);
          await new Promise(resolve => setTimeout(resolve, options.delay_between_comments));
        }
      }

      console.log('\n✅ Bulk comment operation completed:');
      console.log(`   📊 Total posts: ${posts.length}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${failed}`);

      if (results.length > 0) {
        console.log('\n   📝 Detailed results:');
        results.forEach((r, i) => {
          const status = r.success ? '✅' : '❌';
          const comment = r.comment ? `"${r.comment.substring(0, 40)}${r.comment.length > 40 ? '...' : ''}"` : '';
          console.log(`   ${i + 1}. Post ${r.postId} ${status}`);
          if (comment) console.log(`      Comment: ${comment}`);
          if (r.message) console.log(`      ${r.message}`);
          if (r.error) console.log(`      Error: ${r.error}`);
        });
      }

      if (failed > 0) {
        console.log('\n⚠️  Some comments failed. This is normal and may be due to:');
        console.log('   - Rate limiting');
        console.log('   - Post restrictions');
        console.log('   - Network issues');
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('\n❌ Error during bulk comment operation:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Example 3: Bulk Like với danh sách posts từ feed
 * 
 * Extract posts từ feed và like hàng loạt
 */
async function exampleBulkLikeFromFeed() {
  console.log('\n📝 Example 3: Bulk Like Posts from Feed\n');

  try {
    console.log('⏳ Extracting feed data first...\n');

    // Import extractFeedData
    const { extractFeedData } = await import('../src/extractor.js');

    // Extract feed data
    const allPosts = await extractFeedData({
      maxItems: 20 // Extract 20 posts
    });

    console.log(`✅ Extracted ${allPosts.length} posts from feed\n`);

    if (allPosts.length === 0) {
      console.warn('⚠️  No posts found in feed');
      return;
    }

    // Filter posts (ví dụ: chỉ lấy posts có >= 100 likes)
    const filteredPosts = allPosts.filter(post => (post.like_count || 0) >= 100);

    console.log(`📊 Posts with >= 100 likes: ${filteredPosts.length}\n`);

    if (filteredPosts.length === 0) {
      console.warn('⚠️  No posts matching filter criteria');
      return;
    }

    // Chọn tối đa 5 posts để like (để tránh rate limiting)
    const postsToLike = filteredPosts.slice(0, 5);

    console.log(`🎯 Selected ${postsToLike.length} posts to like:\n`);
    postsToLike.forEach((post, i) => {
      const username = post.username || 'unknown';
      const likes = post.like_count || 0;
      console.log(`   ${i + 1}. Post ${post.post_id} (@${username}) - ${likes} likes`);
    });
    console.log('');

    // Chuẩn bị danh sách posts cho bulk like
    const posts = postsToLike.map(post => ({
      postId: post.post_id,
      username: post.username || null,
      shortcode: post.shortcode || null,
      postUrl: post.post_url || null
    }));

    const accountId = null;
    const profilePath = null;

    const { browser, context } = await launchBrowser(accountId, profilePath);
    const page = await context.newPage();

    try {
      const options = {
        continue_on_error: true,
        delay_between_likes: 3000
      };

      const results = [];
      let successful = 0;
      let failed = 0;

      console.log(`📊 Processing ${posts.length} posts...\n`);

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const postId = post.postId;
        const { username, shortcode, postUrl } = post;

        try {
          console.log(`[${i + 1}/${posts.length}] 👍 Liking post ${postId}${username ? ` (@${username})` : ''}`);

          const result = await likePost(page, postId, { username, shortcode, postUrl, accountId });

          if (result.success) {
            successful++;
            results.push({
              postId: postId,
              success: true,
              alreadyLiked: result.alreadyLiked || false,
              message: result.message || 'Post liked successfully'
            });
            console.log(`   ✅ ${result.alreadyLiked ? 'Already liked' : 'Liked successfully'}`);
          } else {
            failed++;
            results.push({
              postId: postId,
              success: false,
              error: result.error || 'Like failed'
            });
            console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);

            if (!options.continue_on_error) {
              throw new Error(`Like failed for post ${postId}: ${result.error}`);
            }
          }
        } catch (error) {
          failed++;
          console.error(`   ❌ Error: ${error.message}`);
          results.push({
            postId: postId,
            success: false,
            error: error.message || 'Unknown error'
          });

          if (!options.continue_on_error) {
            throw error;
          }
        }

        if (i < posts.length - 1 && options.delay_between_likes > 0) {
          console.log(`   ⏳ Waiting ${options.delay_between_likes}ms...\n`);
          await new Promise(resolve => setTimeout(resolve, options.delay_between_likes));
        }
      }

      console.log('\n✅ Bulk like from feed completed:');
      console.log(`   📊 Total posts: ${posts.length}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${failed}`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('\n❌ Error during bulk like from feed:');
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
  console.log('🚀 Bulk Operations Examples');
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

  // await exampleBulkLike();
  // await exampleBulkComment();
  // await exampleBulkLikeFromFeed();

  console.log('\n💡 Uncomment examples in the code to run them');
  console.log('⚠️  Remember to update post IDs in the examples with actual post IDs');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  exampleBulkLike,
  exampleBulkComment,
  exampleBulkLikeFromFeed
};

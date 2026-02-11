/**
 * Threads Feed API Server
 * 
 * REST API server to expose Threads feed extraction functionality
 * Supports caching, filtering, and multiple endpoints
 * 
 * NOTE: This file now acts as the main entry point. Routes have been split into
 * separate files in src/api/routes/ for better maintainability.
 */

import express from 'express';
import { CONFIG } from './src/config.js';
import { setupMiddleware } from './src/api/middleware.js';
import feedRoutes from './src/api/routes/feed-routes.js';
import cacheRoutes from './src/api/routes/cache-routes.js';
import postInteractionRoutes from './src/api/routes/post-interaction-routes.js';
import userInteractionRoutes from './src/api/routes/user-interaction-routes.js';
import feedBrowsingRoutes from './src/api/routes/feed-browsing-routes.js';
import profileRoutes from './src/api/routes/profile-routes.js';

const app = express();

// Middleware
app.use(express.json());
setupMiddleware(app);

// Routes
app.use('/api', feedRoutes);
app.use('/api', cacheRoutes);
app.use('/api', postInteractionRoutes);
app.use('/api', userInteractionRoutes);
app.use('/api', feedBrowsingRoutes);
app.use('/api', profileRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[API ERROR]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = CONFIG.api.port;
const HOST = CONFIG.api.host;

const server = app.listen(PORT, HOST, () => {
  console.log(`[API] Server running on http://${HOST}:${PORT}`);
  console.log(`[API] Endpoints:`);
  console.log(`[API]   GET    /api/feed - Get feed items (with query params for filtering)`);
  console.log(`[API]   GET    /api/feed/:postId - Get specific post`);
  console.log(`[API]   GET    /api/user/:username/posts - Get posts from user profile`);
  console.log(`[API]   POST   /api/feed/refresh - Force refresh feed`);
  console.log(`[API]   GET    /api/health - Health check`);
  console.log(`[API]   DELETE /api/cache - Clear cache manually (add ?username=xxx for specific user)`);
  console.log(`[API]   GET    /api/stats - Get statistics`);
  console.log(`[API]   GET    /api/config - Get configuration`);
  console.log(`[API]   GET    /api/profiles - List profiles (requires base_directory parameter)`);
  console.log(`[API]   GET    /api/profiles/:profileId - Get profile info (requires base_directory parameter)`);
  if (CONFIG.interactions.enabled) {
    console.log(`[API]   ⚠️  EXPERIMENTAL INTERACTION ENDPOINTS (read-only principle violated):`);
    console.log(`[API]   POST   /api/login - Login to Threads`);
    console.log(`[API]   POST   /api/login/bulk - Bulk login multiple accounts`);
    console.log(`[API]   POST   /api/post/:postId/like - Like a post`);
    console.log(`[API]   DELETE /api/post/:postId/like - Unlike a post`);
    console.log(`[API]   POST   /api/post/:postId/comment - Comment on a post`);
    console.log(`[API]   POST   /api/posts/bulk-like - Bulk like multiple posts`);
    console.log(`[API]   POST   /api/posts/bulk-comment - Bulk comment on multiple posts`);
    console.log(`[API]   POST   /api/post/:postId/repost - Repost a post`);
    console.log(`[API]   POST   /api/post/:postId/quote - Quote a post with comment`);
    console.log(`[API]   DELETE /api/post/:postId/repost - Unrepost a post`);
    console.log(`[API]   POST   /api/post/:postId/share - Share a post`);
    console.log(`[API]   GET    /api/post/:postId/interactions - Get interaction status`);
    console.log(`[API]   POST   /api/user/:username/follow - Follow a user`);
    console.log(`[API]   DELETE /api/user/:username/follow - Unfollow a user`);
    console.log(`[API]   GET    /api/user/:username/follow-status - Get follow status`);
    console.log(`[API]   POST   /api/feed/browse-and-comment - Browse feed and comment on posts`);
    console.log(`[API]   POST   /api/user/:username/comment-posts - Comment on user's posts`);
    console.log(`[API]   POST   /api/feed/select-user-and-comment - Select user from feed and comment`);
  }
  console.log(`[API] Cache: ${CONFIG.api.cache.enabled ? `enabled (TTL: ${CONFIG.api.cache.ttl / 1000}s)` : 'disabled'}`);
  console.log(`[API] Interactions: ${CONFIG.interactions.enabled ? '⚠️  ENABLED (experimental)' : 'disabled'}`);
});

// Handle port already in use error
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use!`);
    console.error(`[ERROR] Please stop the process using port ${PORT} or change the port in src/config.js`);
    console.error(`[ERROR] To find and kill the process:`);
    console.error(`[ERROR]   Linux/WSL: lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill`);
    console.error(`[ERROR]   Or: kill $(lsof -t -i:${PORT})`);
    console.error(`[ERROR]   Windows: netstat -ano | findstr :${PORT}`);
    process.exit(1);
  } else {
    console.error(`[ERROR] Server error:`, err);
    process.exit(1);
  }
});

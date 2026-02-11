/**
 * Threads Home Feed Extractor
 * 
 * SAFE, READ-ONLY tool for learning and frontend research.
 * - Does NOT bypass authentication
 * - Does NOT replay GraphQL APIs manually
 * - Does NOT hardcode doc_id, tokens, or cookies
 * - Does NOT automate likes, posts, or follows
 * - ONLY simulates real user behavior in a real browser
 * 
 * This script analyzes how Threads loads the Home Feed and extracts
 * feed data by intercepting GraphQL responses or reading runtime state.
 * 
 * NOTE: This file now re-exports from the refactored module structure
 * for backward compatibility. The actual implementation is in src/
 */

// Re-export configuration
export { CONFIG } from './src/config.js';

// Re-export main extraction functions
export { extractFeedData, extractUserPosts } from './src/extractor.js';

// Re-export filter function
export { filterPosts } from './src/filters/post-filter.js';

// ============================================================================
// FRAGILITY ANALYSIS (Comments)
// ============================================================================

/**
 * FRAGILITY ANALYSIS:
 * 
 * FRAGILE PARTS (likely to break with Threads updates):
 * 1. DOM Selectors (FEED_SELECTORS) - UI changes will break these
 *    - Adaptation: Update selectors, add more fallbacks
 * 2. GraphQL Endpoint URLs (GRAPHQL_ENDPOINT_PATTERNS) - API changes
 *    - Adaptation: Monitor network tab, update patterns
 * 3. GraphQL Query Names (FEED_QUERY_PATTERNS) - Query refactoring
 *    - Adaptation: Inspect network requests, update patterns
 * 4. Window Global Names (WINDOW_GLOBALS) - Framework updates
 *    - Adaptation: Inspect window object, update names
 * 5. Data Structure Paths (in normalizeFeedItem) - API schema changes
 *    - Adaptation: Log raw responses, update extraction paths
 * 
 * STABLE PARTS (less likely to break):
 * 1. GraphQL Response Structure - Relay's edges/nodes pattern is consistent
 * 2. Network Interception Approach - Playwright's route() API is stable
 * 3. Scrolling Behavior - Independent of UI structure
 * 4. Normalization Logic - Output format is our own, can adapt input parsing
 * 5. Multi-strategy Fallback - Architecture allows easy addition of new strategies
 * 
 * ADAPTATION STRATEGY:
 * - When extraction fails, check network tab for new GraphQL endpoints
 * - Inspect window object for new global variables
 * - Update selectors based on new DOM structure
 * - Add new extraction strategies without rewriting core logic
 * - Use defensive checks and fallbacks throughout
 */

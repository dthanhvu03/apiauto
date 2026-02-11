/**
 * GraphQL Network Interceptor
 * 
 * Intercepts and captures GraphQL responses for feed extraction
 */

import { CONFIG } from '../config.js';

/**
 * Setup network request interception to capture GraphQL responses
 * WHY: GraphQL responses contain structured feed data with minimal parsing
 * FRAGILE: Endpoint URLs and query names may change
 * STABLE: GraphQL response structure (edges, nodes) is more stable
 */
export function setupGraphQLInterceptor(context, config = CONFIG) {
  const graphqlResponses = [];
  const endpointPatterns = config.threads.graphqlEndpointPatterns;
  const feedQueryPatterns = config.threads.feedQueryPatterns;

  context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    // Check if this is a GraphQL endpoint
    const isGraphQL = endpointPatterns.some(pattern => 
      url.includes(pattern)
    );

    if (isGraphQL) {
      try {
        // Continue the request but capture the response
        // Note: This may fail if browser context is disposed
        const response = await route.fetch();
        const responseBody = await response.text();

        try {
          const data = JSON.parse(responseBody);
        
        // Check if this response contains feed data
        // Look for common feed query patterns in the response
        const responseStr = JSON.stringify(data);
        const hasFeedQuery = feedQueryPatterns.some(pattern =>
          responseStr.includes(pattern)
        );

        // Check for feed-like structure (edges array, nodes with post data)
        // More strict: must have edges or items array with post-like data
        const hasFeedStructure = (() => {
          // Check for edges array
          const hasEdges = (obj, depth = 0) => {
            if (depth > 5) return false;
            if (!obj || typeof obj !== 'object') return false;
            
            if (obj.edges && Array.isArray(obj.edges) && obj.edges.length > 0) {
              const firstEdge = obj.edges[0];
              if (firstEdge && (firstEdge.node || firstEdge.item || firstEdge.id || firstEdge.pk)) {
                return true;
              }
            }
            
            // Recursively check nested objects
            for (const key in obj) {
              if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
                if (hasEdges(obj[key], depth + 1)) return true;
              }
            }
            return false;
          };
          
          return hasEdges(data);
        })();

        if (hasFeedQuery || hasFeedStructure) {
          graphqlResponses.push({
            url,
            method: request.method(),
            headers: request.headers(),
            body: request.postData(),
            response: data,
            timestamp: Date.now()
          });
        }
        } catch (e) {
          // Not JSON, skip
        }
      } catch (fetchError) {
        // Browser context disposed or other fetch error
        // Just continue the route without capturing
        if (fetchError.message && fetchError.message.includes('Request context disposed')) {
          // Context disposed - this is expected when browser closes
          // Just continue without capturing
        } else {
          // Other error - log but don't fail
          console.warn(`[GRAPHQL-INTERCEPTOR] Error fetching response: ${fetchError.message}`);
        }
      }
    }

    await route.continue();
  });

  return graphqlResponses;
}

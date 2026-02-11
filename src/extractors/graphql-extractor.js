/**
 * GraphQL Feed Extractor
 * 
 * Extracts feed items from GraphQL responses
 * Handles Relay normalization and reference resolution
 */

/**
 * Extract feed items from GraphQL responses
 * WHY: GraphQL responses contain complete, structured data
 * FRAGILE: Query names and response structure may change
 * STABLE: Relay-style edges/nodes pattern is consistent
 * 
 * IMPORTANT: Threads uses Relay normalization where edges contain __ref
 * and actual data is in a separate normalized store. We need to resolve both.
 */
export function extractFromGraphQL(graphqlResponses) {
  const feedItems = [];
  const normalizedStore = {}; // Store for Relay-normalized data

  for (const response of graphqlResponses) {
    const data = response.response;
    
    // Debug: Log response structure for first response
    if (graphqlResponses.indexOf(response) === 0) {
      console.log(`[STORE DEBUG] GraphQL response structure:`, {
        hasData: !!data,
        dataKeys: data ? Object.keys(data).slice(0, 20) : [],
        dataType: typeof data,
        isArray: Array.isArray(data)
      });
      if (data && typeof data === 'object') {
        console.log(`[STORE DEBUG] Response sample (first 1000 chars):`, JSON.stringify(data, null, 2).substring(0, 1000));
      }
      
      // Deep search for feed data in response
      const findFeedDataPaths = (obj, path = '', depth = 0, maxDepth = 5) => {
        if (depth > maxDepth) return [];
        if (!obj || typeof obj !== 'object') return [];
        
        const paths = [];
        
        // Check if this looks like feed data
        if (Array.isArray(obj) && obj.length > 0) {
          const first = obj[0];
          if (first && (first.node || first.item || first.id || first.pk)) {
            paths.push({ path, type: 'array', length: obj.length, sample: JSON.stringify(obj[0]).substring(0, 200) });
          }
        }
        
        // Check for edges
        if (obj.edges && Array.isArray(obj.edges)) {
          paths.push({ path: path ? `${path}.edges` : 'edges', type: 'edges', length: obj.edges.length });
        }
        
        // Check for data.data (nested data)
        if (obj.data && typeof obj.data === 'object') {
          paths.push(...findFeedDataPaths(obj.data, path ? `${path}.data` : 'data', depth + 1, maxDepth));
        }
        
        // Recursively search
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
            paths.push(...findFeedDataPaths(obj[key], path ? `${path}.${key}` : key, depth + 1, maxDepth));
          }
        }
        
        return paths;
      };
      
      const feedPaths = findFeedDataPaths(data);
      console.log(`[STORE DEBUG] Found ${feedPaths.length} potential feed data paths:`, feedPaths.slice(0, 10));
    }

    // First, collect all normalized data from Relay store
    // Relay stores data with keys like "Post:123456" or just IDs
    // Threads uses format like "XDTThread:3821603212810368981"
    // Also stores composite keys like "3821452181745078872_63079231911"
    const collectNormalizedData = (obj, parentKey = null, depth = 0) => {
      if (depth > 15) return; // Prevent infinite recursion
      if (!obj || typeof obj !== 'object') return;

      // Store any object that looks like a normalized entry
      if (obj.__typename && obj.id) {
        // Store with both formats for easier lookup
        const key1 = `${obj.__typename}:${obj.id}`;
        const key2 = obj.id;
        if (!normalizedStore[key1]) {
          normalizedStore[key1] = obj;
        }
        if (!normalizedStore[key2]) {
          normalizedStore[key2] = obj;
        }
        
        // Also store composite keys if parent key suggests it (e.g., "threadId_userId")
        if (parentKey && parentKey.includes('_')) {
          const parts = parentKey.split('_');
          if (parts.length === 2 && (parts[0] === obj.id || parts[1] === obj.id)) {
            if (!normalizedStore[parentKey]) {
              normalizedStore[parentKey] = obj;
            }
          }
        }
      } else if (obj.id && !obj.__typename) {
        // Store by ID only if no typename
        if (!normalizedStore[obj.id]) {
          normalizedStore[obj.id] = obj;
        }
      }

      // Recursively traverse - preserve parent key for composite keys
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
          // Check if this key looks like a composite key (e.g., "3821452181745078872_63079231911")
          const newParentKey = (key.includes('_') && /^\d+_\d+$/.test(key)) ? key : parentKey;
          collectNormalizedData(obj[key], newParentKey, depth + 1);
          
          // Also store the object itself if key looks like a composite key
          if (key.includes('_') && /^\d+_\d+$/.test(key) && !normalizedStore[key]) {
            normalizedStore[key] = obj[key];
          }
        }
      }
    };

    // Collect all normalized data first
    collectNormalizedData(data);
    
    // Debug: Log normalized store contents for first response
    if (graphqlResponses.indexOf(response) === 0) {
      const storeKeys = Object.keys(normalizedStore);
      console.log(`[STORE DEBUG] Normalized store has ${storeKeys.length} entries`);
      
      // Log sample of keys
      const sampleKeys = storeKeys.slice(0, 50);
      console.log(`[STORE DEBUG] Sample keys (first 50):`, sampleKeys);
      
      // Count keys by type
      const userKeys = storeKeys.filter(k => 
        k.toLowerCase().includes('user') || 
        k.toLowerCase().includes('xdtuser') || 
        k.toLowerCase().includes('iguser')
      );
      const threadKeys = storeKeys.filter(k => 
        k.toLowerCase().includes('thread') || 
        k.toLowerCase().includes('xdtthread')
      );
      const mediaKeys = storeKeys.filter(k => 
        k.toLowerCase().includes('media') || 
        k.toLowerCase().includes('image') || 
        k.toLowerCase().includes('video')
      );
      const compositeKeys = storeKeys.filter(k => /^\d+_\d+$/.test(k));
      
      console.log(`[STORE DEBUG] Key types: ${userKeys.length} user-like, ${threadKeys.length} thread-like, ${mediaKeys.length} media-like, ${compositeKeys.length} composite`);
      
      // Sample a few entries to see structure
      if (userKeys.length > 0) {
        const sampleUserKey = userKeys[0];
        const sampleUser = normalizedStore[sampleUserKey];
        console.log(`[STORE DEBUG] Sample user entry (${sampleUserKey}):`, JSON.stringify(sampleUser, null, 2).substring(0, 500));
      }
      
      if (compositeKeys.length > 0) {
        const sampleCompKey = compositeKeys[0];
        const sampleComp = normalizedStore[sampleCompKey];
        console.log(`[STORE DEBUG] Sample composite entry (${sampleCompKey}):`, JSON.stringify(sampleComp, null, 2).substring(0, 500));
      }
    }

    // Handle different GraphQL response structures
    // Structure 1: { data: { viewer: { home_feed: { edges: [...] } } } }
    // Structure 2: { data: { feed: { edges: [...] } } }
    // Structure 3: Direct edges array
    // Structure 4: Relay-style with __ref (references to normalized store)
    const extractEdges = (obj, path = [], depth = 0) => {
      if (depth > 10) return []; // Prevent infinite recursion
      if (!obj || typeof obj !== 'object') return [];

      // Check if this is an edges array
      if (Array.isArray(obj) && obj.length > 0) {
        const firstItem = obj[0];
        if (firstItem && (firstItem.node || firstItem.item || firstItem.__ref || firstItem.id)) {
          return obj;
        }
      }

      // Check if this object has an edges property
      if (obj.edges && Array.isArray(obj.edges)) {
        return obj.edges;
      }

      // Check for Threads-specific structures
      // Threads might use different field names
      if (obj.feed_items && Array.isArray(obj.feed_items)) {
        return obj.feed_items;
      }
      if (obj.threads && Array.isArray(obj.threads)) {
        return obj.threads;
      }
      if (obj.items && Array.isArray(obj.items)) {
        return obj.items;
      }

      // Recursively search nested objects
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
          const result = extractEdges(obj[key], [...path, key], depth + 1);
          if (result.length > 0) {
            return result;
          }
        }
      }

      return [];
    };

    const edges = extractEdges(data);
    
    for (const edge of edges) {
      // Handle different edge structures
      let node = edge.node || edge.item || edge;
      
      // IMPORTANT: Handle Threads-specific structure: text_post_app_thread.thread_items[].post
      // Threads wraps posts in text_post_app_thread.thread_items array
      if (node && node.text_post_app_thread && node.text_post_app_thread.thread_items) {
        const threadItems = node.text_post_app_thread.thread_items;
        if (Array.isArray(threadItems) && threadItems.length > 0) {
          // Extract each post from thread_items
          for (const threadItem of threadItems) {
            if (threadItem.post) {
              const post = threadItem.post;
              // Add this post to feedItems
              feedItems.push(post);
            }
          }
          // Skip processing this node as a single item since we've extracted posts from it
          continue;
        }
      }
      
      // Try to resolve from normalized store using multiple key formats
      // Threads uses __typename:id format (e.g., "XDTThread:3821603212810368981")
      if (node && node.__typename && node.id) {
        const storeKey = `${node.__typename}:${node.id}`;
        let resolved = normalizedStore[storeKey] || 
                      normalizedStore[node.id] || 
                      normalizedStore[`${node.__typename}:${node.id}`];
        
        if (resolved) {
          // Merge resolved data (prioritize resolved data over node)
          node = { ...node, ...resolved };
          
          // Threads stores data in related entries - need to traverse
          // Look for related entries like user info, media info, etc.
          // Check if resolved has references to other entries
          const findRelatedData = (currentNode) => {
            const related = {};
            
            // Traverse all properties to find references or nested data
            for (const key in currentNode) {
              const value = currentNode[key];
              
              // If value is an object, check if it's a reference or has data
              if (value && typeof value === 'object') {
                // Check if this looks like a reference (has __ref or id)
                if (value.__ref) {
                  const refKey = value.__ref;
                  const refData = normalizedStore[refKey] || normalizedStore[refKey.split(':')[1]];
                  if (refData) {
                    related[key] = refData;
                  }
                } else if (value.id || value.__typename) {
                  // Might be inline data or reference
                  const refKey = value.__typename && value.id ? `${value.__typename}:${value.id}` : value.id;
                  const refData = normalizedStore[refKey] || normalizedStore[value.id];
                  if (refData && Object.keys(refData).length > 2) {
                    related[key] = refData;
                  } else {
                    related[key] = value; // Use inline data
                  }
                } else {
                  // Might be nested data structure
                  related[key] = value;
                }
              } else if (value && typeof value === 'string' && value.includes(':')) {
                // Might be a reference string
                const refData = normalizedStore[value] || normalizedStore[value.split(':')[1]];
                if (refData) {
                  related[key] = refData;
                }
              }
            }
            
            return related;
          };
          
          // Find and merge related data
          const relatedData = findRelatedData(node);
          node = { ...node, ...relatedData };
          
          // Also look for composite keys (e.g., "threadId_userId")
          // These often contain user info or other related data
          const compositeKey = `${node.id}_`;
          const compositeKeys = Object.keys(normalizedStore).filter(k => 
            k.startsWith(compositeKey) || k.includes(`_${node.id}`) || k.includes(`${node.id}_`)
          );
          
          for (const compKey of compositeKeys) {
            const compData = normalizedStore[compKey];
            if (compData && typeof compData === 'object') {
              // Merge composite data, but don't overwrite existing fields
              for (const key in compData) {
                if (!node[key] || (node[key] === node.id || node[key] === node.__typename)) {
                  node[key] = compData[key];
                }
              }
            }
          }
          
          // IMPORTANT: Try to find and merge user data from normalized store
          // User data might be in a separate entry with format like "User:userId" or just userId
          // Also check for user references in the node itself
          const findUserData = (currentNode) => {
            // Check if this is one of the first few items (for debug logging)
            const isFirstFewItems = feedItems.length < 3;
            
            // First, try to extract userId from composite ID (format: threadId_userId)
            let userId = null;
            if (currentNode.id && currentNode.id.includes('_')) {
              const parts = currentNode.id.split('_');
              if (parts.length === 2 && /^\d+$/.test(parts[1])) {
                userId = parts[1]; // Extract userId from composite key
              }
            }
            
            // Also check for user_id or owner_id to find user entry
            userId = userId || currentNode.user_id || currentNode.owner_id || currentNode.author_id;
            
            // Debug: Log user search for first few items
            if (isFirstFewItems) {
              console.log(`[USER DEBUG] Item ${feedItems.length + 1}: Searching for user data`);
              console.log(`[USER DEBUG] Node ID: ${currentNode.id}`);
              console.log(`[USER DEBUG] Node __typename: ${currentNode.__typename}`);
              console.log(`[USER DEBUG] Node keys:`, Object.keys(currentNode).slice(0, 20));
              
              // Check for user reference in node
              if (currentNode.user) {
                console.log(`[USER DEBUG] Node has user property:`, typeof currentNode.user === 'object' ? Object.keys(currentNode.user).slice(0, 10) : currentNode.user);
                if (currentNode.user.__ref) {
                  console.log(`[USER DEBUG] User __ref: ${currentNode.user.__ref}`);
                }
              }
              
              if (userId) {
                console.log(`[USER DEBUG] Extracted userId: ${userId}`);
                const userKeys = [
                  `User:${userId}`,
                  `XDTUser:${userId}`,
                  `IGUser:${userId}`,
                  userId,
                  `XDTThread:${currentNode.id}`, // Sometimes user data is in thread entry
                  `${currentNode.__typename}:${userId}` // Try with node's typename
                ];
                console.log(`[USER DEBUG] Checking user keys:`, userKeys);
                
                for (const userKey of userKeys) {
                  const userData = normalizedStore[userKey];
                  if (userData && typeof userData === 'object') {
                    console.log(`[USER DEBUG] ✅ Found user data in key: ${userKey}`);
                    console.log(`[USER DEBUG] User data keys:`, Object.keys(userData).slice(0, 20));
                    if (userData.username) {
                      console.log(`[USER DEBUG] ✅ Username found: ${userData.username}`);
                    }
                    console.log(`[USER DEBUG] User data sample:`, JSON.stringify(userData, null, 2).substring(0, 500));
                  }
                }
              } else {
                console.log(`[USER DEBUG] ⚠️ No userId found. Checking composite ID...`);
                if (currentNode.id && currentNode.id.includes('_')) {
                  const parts = currentNode.id.split('_');
                  console.log(`[USER DEBUG] Composite ID parts:`, parts);
                  if (parts.length === 2) {
                    const possibleUserId = parts[1];
                    console.log(`[USER DEBUG] Trying userId from composite: ${possibleUserId}`);
                    const userKeys = [
                      `User:${possibleUserId}`,
                      `XDTUser:${possibleUserId}`,
                      `IGUser:${possibleUserId}`,
                      possibleUserId
                    ];
                    for (const userKey of userKeys) {
                      const userData = normalizedStore[userKey];
                      if (userData && typeof userData === 'object') {
                        console.log(`[USER DEBUG] ✅ Found user data with composite userId in key: ${userKey}`);
                        if (userData.username) {
                          console.log(`[USER DEBUG] ✅ Username found: ${userData.username}`);
                        }
                      }
                    }
                  }
                }
              }
              
              // Also check all normalized store keys that might contain user data
              if (feedItems.length === 0) {
                const allStoreKeys = Object.keys(normalizedStore);
                console.log(`[USER DEBUG] Total normalized store keys: ${allStoreKeys.length}`);
                const userLikeKeys = allStoreKeys.filter(k => 
                  k.toLowerCase().includes('user') || 
                  k.toLowerCase().includes('xdtuser') ||
                  k.toLowerCase().includes('iguser')
                );
                console.log(`[USER DEBUG] User-like keys in store:`, userLikeKeys.slice(0, 10));
                
                // Check a few user-like entries
                for (const key of userLikeKeys.slice(0, 5)) {
                  const entry = normalizedStore[key];
                  if (entry && typeof entry === 'object' && entry.username) {
                    console.log(`[USER DEBUG] ✅ Found username in store key "${key}": ${entry.username}`);
                  }
                }
              }
            }
            
            // Check if node has user reference
            if (currentNode.user) {
              if (typeof currentNode.user === 'object' && currentNode.user.__ref) {
                const userRef = currentNode.user.__ref;
                const userData = normalizedStore[userRef] || normalizedStore[userRef.split(':')[1]];
                if (userData) {
                  currentNode.user = userData;
                }
              } else if (typeof currentNode.user === 'string' && currentNode.user.includes(':')) {
                const userData = normalizedStore[currentNode.user] || normalizedStore[currentNode.user.split(':')[1]];
                if (userData) {
                  currentNode.user = userData;
                }
              }
            }
            
            // Search for user entry by userId
            if (userId) {
              const userKeys = [
                `User:${userId}`,
                `XDTUser:${userId}`,
                `IGUser:${userId}`,
                userId
              ];
              
              for (const userKey of userKeys) {
                const userData = normalizedStore[userKey];
                if (userData && typeof userData === 'object') {
                  // Merge user data into node.user if not already present
                  if (!currentNode.user || typeof currentNode.user !== 'object') {
                    currentNode.user = userData;
                  } else {
                    // Merge user data into existing user object
                    currentNode.user = { ...currentNode.user, ...userData };
                  }
                  // Also set top-level username if found
                  if (userData.username) {
                    currentNode.username = userData.username;
                  }
                  break;
                }
              }
            }
            
            // Also check composite keys for user data (format: threadId_userId)
            if (currentNode.id) {
              const threadId = currentNode.id.split('_')[0]; // Get thread ID part
              const compositeKeys = Object.keys(normalizedStore).filter(k => 
                k.startsWith(`${threadId}_`) && k !== `${threadId}_${threadId}`
              );
              
              for (const compKey of compositeKeys) {
                const compData = normalizedStore[compKey];
                if (compData && typeof compData === 'object') {
                  // Check if this composite key contains user data
                  if (compData.username || compData.user?.username || compData.__typename?.includes('User')) {
                    // This looks like user data, merge it
                    if (!currentNode.user || typeof currentNode.user !== 'object') {
                      currentNode.user = compData;
                    } else {
                      currentNode.user = { ...currentNode.user, ...compData };
                    }
                    // Also merge top-level user fields
                    if (compData.username) {
                      currentNode.username = compData.username;
                    }
                    if (compData.user?.username) {
                      currentNode.username = compData.user.username;
                    }
                  }
                }
              }
            }
            
            // Last resort: Search all normalized store entries for username patterns
            if (!currentNode.username && !currentNode.user?.username && isFirstFewItems) {
              console.log(`[USER DEBUG] Last resort: Searching all normalized store for user data...`);
              const allKeys = Object.keys(normalizedStore);
              console.log(`[USER DEBUG] Total normalized store keys: ${allKeys.length}`);
              
              // Look for entries that might contain username
              let foundUsernames = 0;
              for (const key of allKeys.slice(0, 100)) { // Check first 100 keys
                const entry = normalizedStore[key];
                if (entry && typeof entry === 'object' && entry.username) {
                  console.log(`[USER DEBUG] ✅ Found username in key "${key}": ${entry.username}`);
                  foundUsernames++;
                  
                  // If this entry has an ID that matches our node's user ID, use it
                  if (userId && (entry.id === userId || entry.pk === userId || entry.user_id === userId)) {
                    console.log(`[USER DEBUG] ✅ Matched user entry! Merging...`);
                    if (!currentNode.user || typeof currentNode.user !== 'object') {
                      currentNode.user = entry;
                    } else {
                      currentNode.user = { ...currentNode.user, ...entry };
                    }
                    currentNode.username = entry.username;
                  }
                }
              }
              console.log(`[USER DEBUG] Found ${foundUsernames} entries with username in store`);
            }
            
            return currentNode;
          };
          
          node = findUserData(node);
          
          // Look for media-related entries (e.g., "XDTTextPostAppMediaInfo:...")
          // Threads stores media info separately in normalized store
          // IMPORTANT: Check if node has a reference to media info first
          const checkMediaReference = (obj, depth = 0) => {
            if (depth > 5) return [];
            const refs = [];
            for (const key in obj) {
              const value = obj[key];
              // Check for __ref fields that point to media
              if (value && typeof value === 'object') {
                if (value.__ref && (value.__ref.includes('Media') || value.__ref.includes('Image') || value.__ref.includes('Video'))) {
                  refs.push(value.__ref);
                }
                // Also check for fields that might contain media references
                if (key.toLowerCase().includes('media') || key.toLowerCase().includes('image') || key.toLowerCase().includes('video')) {
                  if (value.__ref) {
                    refs.push(value.__ref);
                  } else if (typeof value === 'string' && value.includes(':')) {
                    refs.push(value);
                  }
                }
                // Recursively check
                refs.push(...checkMediaReference(value, depth + 1));
              } else if (typeof value === 'string' && value.includes(':') && (value.includes('Media') || value.includes('Image') || value.includes('Video'))) {
                refs.push(value);
              }
            }
            return refs;
          };
          
          const mediaRefs = checkMediaReference(node);
          
          // Get all media keys from store
          const mediaKeys = Object.keys(normalizedStore).filter(k => 
            k.includes('Media') || k.includes('Image') || k.includes('Video') || k.includes('Photo')
          );
          
          // Debug: Log media keys found (only for first item to avoid spam)
          if (mediaKeys.length > 0 && !node.media && feedItems.length === 0) {
            console.log(`[MEDIA DEBUG] Found ${mediaKeys.length} media-related keys in store for thread ${node.id}`);
            console.log(`[MEDIA DEBUG] Sample media keys:`, mediaKeys.slice(0, 5));
            if (mediaRefs.length > 0) {
              console.log(`[MEDIA DEBUG] Found media references in node:`, mediaRefs);
            } else {
              // Log node structure to see how media might be referenced
              const nodeStr = JSON.stringify(node).substring(0, 1000);
              const hasMediaKeywords = nodeStr.toLowerCase().includes('media') || nodeStr.toLowerCase().includes('image') || nodeStr.toLowerCase().includes('video');
              if (hasMediaKeywords) {
                console.log(`[MEDIA DEBUG] Node contains media-related keywords. Node keys:`, Object.keys(node).slice(0, 20));
                console.log(`[MEDIA DEBUG] Node structure sample:`, nodeStr);
              }
            }
          }
          
          // First, try to resolve media from explicit references in node
          for (const mediaRef of mediaRefs) {
            const mediaData = normalizedStore[mediaRef] || normalizedStore[mediaRef.split(':')[1]];
            if (mediaData && typeof mediaData === 'object') {
              if (!node.media) {
                node.media = [];
              }
              if (Array.isArray(node.media)) {
                node.media.push(mediaData);
              } else {
                node.media = [mediaData];
              }
              
              // Debug: Log when we resolve media from reference
              if (feedItems.length === 0) {
                console.log(`[MEDIA DEBUG] Resolved media from reference ${mediaRef}`);
                console.log(`[MEDIA DEBUG] Media entry keys:`, Object.keys(mediaData).slice(0, 20));
                console.log(`[MEDIA DEBUG] Media entry sample:`, JSON.stringify(mediaData, null, 2).substring(0, 1000));
              }
            }
          }
          
          // If no media found via references, check for media_info or similar fields
          if (!node.media || node.media.length === 0) {
            // Check common media field names
            const mediaField = node.media_info || node.mediaInfo || node.media_attachment || node.image_info;
            if (mediaField) {
              if (mediaField.__ref) {
                const mediaData = normalizedStore[mediaField.__ref] || normalizedStore[mediaField.__ref.split(':')[1]];
                if (mediaData) {
                  node.media = Array.isArray(node.media) ? node.media : [];
                  node.media.push(mediaData);
                }
              } else if (typeof mediaField === 'object') {
                node.media = Array.isArray(mediaField) ? mediaField : [mediaField];
              }
            }
          }
          
          // Also check if thread has media references in its own structure
          if (node.media_attachments && !node.media) {
            node.media = Array.isArray(node.media_attachments) ? node.media_attachments : [node.media_attachments];
          }
          
          // Check for media in nested structures
          if (!node.media && node.thread?.media) {
            node.media = Array.isArray(node.thread.media) ? node.thread.media : [node.thread.media];
          }
          if (!node.media && node.post?.media) {
            node.media = Array.isArray(node.post.media) ? node.post.media : [node.post.media];
          }
          
          // Last resort: Check if any media entry in store might belong to this thread
          // This is less reliable but might catch some cases
          if ((!node.media || node.media.length === 0) && feedItems.length === 0) {
            // For first item, log all media entries to understand structure
            console.log(`[MEDIA DEBUG] Checking media entries for thread ${node.id}...`);
            for (const mediaKey of mediaKeys.slice(0, 3)) {
              const mediaData = normalizedStore[mediaKey];
              if (mediaData && typeof mediaData === 'object') {
                console.log(`[MEDIA DEBUG] Media entry ${mediaKey} structure:`, JSON.stringify(mediaData, null, 2).substring(0, 1000));
              }
            }
          }
        }
      }
      
      // Handle Relay-style references (__ref points to normalized store)
      if (edge.__ref || (node && node.__ref)) {
        const ref = edge.__ref || node.__ref;
        // Try to resolve from normalized store
        const resolved = normalizedStore[ref] || 
                        normalizedStore[ref.split(':')[1]] || 
                        normalizedStore[ref.split(':')[0]];
        if (resolved) {
          // Merge resolved data with edge data
          node = { ...node, ...resolved };
        } else {
          // Fallback: extract ID from ref
          const refId = ref.includes(':') ? ref.split(':')[1] : ref;
          node = { id: refId, __ref: ref, ...node };
        }
      }
      
      // Before adding to feedItems, ensure we've tried to resolve text and username
      // Check if text is missing and try to find it in related entries
      const isFirstItem = feedItems.length === 0;
      if (node) {
        const nodeId = node.id || node.post_id || node.thread_id;
        
        // Try to find text in normalized store entries related to this node
        if (!node.text && nodeId) {
          // Check composite keys (threadId_userId format)
          const compositeKeys = Object.keys(normalizedStore).filter(k => 
            k.startsWith(`${nodeId}_`) || k.includes(`_${nodeId}`)
          );
          
          for (const compKey of compositeKeys.slice(0, 10)) {
            const compData = normalizedStore[compKey];
            if (compData && typeof compData === 'object') {
              // Check if this entry has text
              const compText = compData.text || compData.caption || compData.content || compData.text_content;
              
              if (compText && !node.text) {
                node.text = typeof compText === 'string' ? compText : (compText.text || compText.content || compText.caption);
                if (isFirstItem) {
                  console.log(`[TEXT DEBUG] ✅ Found text in composite key "${compKey}"`);
                }
                break; // Found text, no need to continue
              }
            }
          }
          
          // Also check entries with same ID or related IDs
          if (!node.text) {
            const relatedKeys = Object.keys(normalizedStore).filter(k => 
              k.includes(nodeId) || k.includes(nodeId.split('_')[0])
            );
            
            for (const relKey of relatedKeys.slice(0, 20)) {
              const relData = normalizedStore[relKey];
              if (relData && typeof relData === 'object') {
                const relText = relData.text || relData.caption || relData.content || relData.text_content;
                if (relText && typeof relText === 'string' && relText.length > 10) {
                  node.text = relText;
                  if (isFirstItem) {
                    console.log(`[TEXT DEBUG] ✅ Found text in related key "${relKey}"`);
                  }
                  break;
                }
              }
            }
          }
        }
        
        // Try to find username if still missing
        if (!node.username && !node.user?.username && nodeId) {
          // Check composite keys for username
          const compositeKeys = Object.keys(normalizedStore).filter(k => 
            k.startsWith(`${nodeId}_`) || k.includes(`_${nodeId}`)
          );
          
          for (const compKey of compositeKeys.slice(0, 10)) {
            const compData = normalizedStore[compKey];
            if (compData && typeof compData === 'object') {
              if (compData.username && !node.username) {
                node.username = compData.username;
                if (isFirstItem) {
                  console.log(`[USERNAME DEBUG] ✅ Found username in composite key "${compKey}": ${compData.username}`);
                }
                break;
              }
              if (compData.user && compData.user.username && !node.username) {
                node.username = compData.user.username;
                if (!node.user) {
                  node.user = compData.user;
                }
                if (isFirstItem) {
                  console.log(`[USERNAME DEBUG] ✅ Found username in composite key "${compKey}": ${compData.user.username}`);
                }
                break;
              }
            }
          }
          
          // Also check all entries that might contain user data by searching for username field
          if (!node.username && isFirstItem) {
            console.log(`[USERNAME DEBUG] Searching all normalized store for username related to node ${nodeId}...`);
            const allKeys = Object.keys(normalizedStore);
            let checked = 0;
            for (const key of allKeys.slice(0, 200)) { // Check first 200 keys
              const entry = normalizedStore[key];
              if (entry && typeof entry === 'object' && entry.username) {
                // Check if this entry might be related to our node
                const entryId = entry.id || entry.pk || entry.post_id || entry.thread_id;
                const nodeIdBase = nodeId.split('_')[0];
                const entryIdBase = entryId ? String(entryId).split('_')[0] : null;
                
                // If IDs match or entry has same thread ID, it might be related
                if (entryIdBase === nodeIdBase || entry.thread_id === nodeId || entry.post_id === nodeId) {
                  node.username = entry.username;
                  if (!node.user) {
                    node.user = entry;
                  }
                  console.log(`[USERNAME DEBUG] ✅ Found username in related entry "${key}": ${entry.username}`);
                  break;
                }
                checked++;
                if (checked > 50) break; // Limit checks to avoid performance issues
              }
            }
          }
        }
      }
      
      // Check if this looks like a post/thread
      if (node && (node.id || node.post_id || node.thread_id || node.__ref)) {
        feedItems.push(node);
      }
    }
  }

  // Debug: Log sample of raw data structure and media info
  if (feedItems.length > 0) {
    const sample = feedItems[0];
    const keys = Object.keys(sample);
    
    // Debug media extraction for first item
    if (sample.id || sample.post_id) {
      const threadId = sample.id || sample.post_id;
      const mediaKeys = Object.keys(normalizedStore).filter(k => 
        k.includes('Media') || k.includes('Image') || k.includes('Video') || 
        k.includes('media') || k.includes('image') || k.includes('video')
      );
      if (mediaKeys.length > 0) {
        console.log(`[MEDIA DEBUG] Found ${mediaKeys.length} media entries in normalized store`);
        // Check if any media entry references this thread
        const relatedMedia = mediaKeys.filter(k => {
          const mediaData = normalizedStore[k];
          return mediaData && JSON.stringify(mediaData).includes(String(threadId));
        });
        if (relatedMedia.length > 0) {
          console.log(`[MEDIA DEBUG] Found ${relatedMedia.length} media entries related to thread ${threadId}`);
          console.log(`[MEDIA DEBUG] Media entry keys:`, relatedMedia.slice(0, 3));
          // Log structure of first related media entry
          const firstMedia = normalizedStore[relatedMedia[0]];
          console.log(`[MEDIA DEBUG] Sample media entry structure:`, JSON.stringify(firstMedia, null, 2).substring(0, 600));
        }
      }
    }
    
    if (keys.length <= 3 && (!sample.text && !sample.username && !sample.caption)) {
      console.log('[DEBUG] Sample raw GraphQL item (may need normalization):', JSON.stringify(sample, null, 2).substring(0, 800));
      console.log('[DEBUG] Normalized store has', Object.keys(normalizedStore).length, 'entries');
      
      // Debug: Show sample keys from normalized store
      const storeKeys = Object.keys(normalizedStore).slice(0, 5);
      console.log('[DEBUG] Sample normalized store keys:', storeKeys);
      
      // Try to find matching entry in store and show full structure
      if (sample.__typename && sample.id) {
        const lookupKey = `${sample.__typename}:${sample.id}`;
        const found = normalizedStore[lookupKey] || normalizedStore[sample.id];
        if (found) {
          console.log('[DEBUG] Found matching store entry with keys:', Object.keys(found).slice(0, 20));
          console.log('[DEBUG] Full store entry (first 1000 chars):', JSON.stringify(found, null, 2).substring(0, 1000));
          
          // Look for related entries
          const threadId = sample.id;
          const relatedKeys = Object.keys(normalizedStore).filter(k => 
            k.includes(threadId) || k.startsWith(`${threadId}_`) || k.includes(`_${threadId}`)
          );
          console.log('[DEBUG] Related store keys:', relatedKeys.slice(0, 15));
          
          // Try to find user entry (usually has format like threadId_userId)
          const userKey = relatedKeys.find(k => k.includes('_') && (k.startsWith(threadId) || k.endsWith(threadId)));
          if (userKey) {
            const userData = normalizedStore[userKey];
            console.log('[DEBUG] Found composite entry:', userKey);
            console.log('[DEBUG] Composite entry keys:', Object.keys(userData || {}).slice(0, 15));
            console.log('[DEBUG] Composite entry sample (first 500 chars):', JSON.stringify(userData, null, 2).substring(0, 500));
          }
          
          // Also check for user ID from composite key
          const userIdMatch = relatedKeys.find(k => k.includes('_'))?.split('_').find(part => part !== threadId && part.length > 5);
          if (userIdMatch) {
            const userEntry = normalizedStore[userIdMatch] || normalizedStore[`User:${userIdMatch}`];
            if (userEntry) {
              console.log('[DEBUG] Found user entry by ID:', userIdMatch);
              console.log('[DEBUG] User entry keys:', Object.keys(userEntry).slice(0, 15));
            }
          }
        } else {
          console.log('[DEBUG] Could not find store entry for:', lookupKey);
        }
      }
    }
  }

  return feedItems;
}

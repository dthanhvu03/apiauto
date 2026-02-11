/**
 * Media URL Normalizer
 * 
 * Extracts media URLs from various Threads data structures
 */

/**
 * Extract media URLs from item
 * WHY: Threads stores media in various nested structures (image_versions2, carousel_media, text_post_app_info)
 * FRAGILE: Media structure may change with UI updates
 * STABLE: Instagram-style media format (image_versions2.candidates) is consistent
 */
export function extractMediaUrls(item, debug = false, isFirstItem = false) {
  // Always debug first item
  if (isFirstItem) debug = true;
  const urls = [];
  const debugInfo = [];
  const postId = item.id || item.post_id || null;

  // Helper to extract URL from a media object
  const extractUrlFromMedia = (m) => {
    if (!m || typeof m !== 'object') return null;
    
    // Direct URL fields
    if (m.url && typeof m.url === 'string' && m.url.startsWith('http')) return m.url;
    if (m.image_url && typeof m.image_url === 'string' && m.image_url.startsWith('http')) return m.image_url;
    if (m.media_url && typeof m.media_url === 'string' && m.media_url.startsWith('http')) return m.media_url;
    if (m.display_url && typeof m.display_url === 'string' && m.display_url.startsWith('http')) return m.display_url;
    if (m.src && typeof m.src === 'string' && m.src.startsWith('http')) return m.src;
    
    // Instagram-style image_versions2.candidates structure
    if (m.image_versions2?.candidates && Array.isArray(m.image_versions2.candidates)) {
      const candidates = m.image_versions2.candidates;
      if (candidates.length > 0) {
        // Sort by width*height to get highest quality
        const sorted = candidates.sort((a, b) => {
          const aSize = (a.width || 0) * (a.height || 0);
          const bSize = (b.width || 0) * (b.height || 0);
          return bSize - aSize;
        });
        if (sorted[0].url && sorted[0].url.startsWith('http')) {
          return sorted[0].url;
        }
      }
    }
    
    // Video versions
    if (m.video_versions && Array.isArray(m.video_versions) && m.video_versions.length > 0) {
      // Get highest quality video
      const sorted = m.video_versions.sort((a, b) => {
        const aSize = (a.width || 0) * (a.height || 0);
        const bSize = (b.width || 0) * (b.height || 0);
        return bSize - aSize;
      });
      if (sorted[0].url && sorted[0].url.startsWith('http')) {
        return sorted[0].url;
      }
    }
    
    return null;
  };

  // Strategy 1: Check image_versions2.candidates directly on item (Instagram-style)
  if (item.image_versions2?.candidates && Array.isArray(item.image_versions2.candidates)) {
    const url = extractUrlFromMedia(item);
    if (url) {
      urls.push(url);
      if (debug) debugInfo.push(`Found URL from image_versions2: ${url.substring(0, 100)}`);
    }
  }

  // Strategy 2: Check carousel_media array (multiple images/videos)
  if (item.carousel_media && Array.isArray(item.carousel_media)) {
    if (debug) debugInfo.push(`Found carousel_media array with ${item.carousel_media.length} items`);
    for (const mediaItem of item.carousel_media) {
      const url = extractUrlFromMedia(mediaItem);
      if (url) {
        urls.push(url);
        if (debug) debugInfo.push(`Found URL from carousel_media: ${url.substring(0, 100)}`);
      }
    }
  }

  // Strategy 3: Check video_versions array
  if (item.video_versions && Array.isArray(item.video_versions)) {
    if (debug) debugInfo.push(`Found video_versions array with ${item.video_versions.length} items`);
    for (const videoItem of item.video_versions) {
      const url = extractUrlFromMedia(videoItem);
      if (url) {
        urls.push(url);
        if (debug) debugInfo.push(`Found URL from video_versions: ${url.substring(0, 100)}`);
      }
    }
  }

  // Strategy 4: Check text_post_app_info for linked media (Threads-specific)
  if (item.text_post_app_info) {
    const appInfo = item.text_post_app_info;
    
    // Check linked_inline_media (media embedded in text posts)
    if (appInfo.linked_inline_media) {
      const linkedMedia = Array.isArray(appInfo.linked_inline_media) 
        ? appInfo.linked_inline_media 
        : [appInfo.linked_inline_media];
      for (const mediaItem of linkedMedia) {
        const url = extractUrlFromMedia(mediaItem);
        if (url) urls.push(url);
        
        // Also check if it has image_versions2
        if (mediaItem.image_versions2?.candidates) {
          const url2 = extractUrlFromMedia(mediaItem);
          if (url2 && !urls.includes(url2)) urls.push(url2);
        }
      }
    }
    
    // Check link_preview_attachment (link previews with images)
    if (appInfo.link_preview_attachment) {
      const preview = appInfo.link_preview_attachment;
      // Check for image URL in preview
      if (preview.image_url && preview.image_url.startsWith('http')) {
        urls.push(preview.image_url);
      }
      if (preview.thumbnail_url && preview.thumbnail_url.startsWith('http')) {
        urls.push(preview.thumbnail_url);
      }
      // Some previews have image_versions2
      if (preview.image_versions2?.candidates) {
        const url = extractUrlFromMedia(preview);
        if (url) urls.push(url);
      }
    }
  }

  // Strategy 5: Check standard media arrays
  const mediaArrays = [
    item.media,
    item.images,
    item.media_attachments,
    item.attachments,
    item.edge_sidecar_to_children?.edges,
    item.thread?.media,
    item.post?.media,
    item.media_attachments?.edges
  ].filter(arr => Array.isArray(arr) && arr.length > 0);

  for (const mediaArray of mediaArrays) {
    for (const m of mediaArray) {
      if (typeof m === 'string' && m.startsWith('http')) {
        urls.push(m);
      } else {
        const url = extractUrlFromMedia(m);
        if (url) urls.push(url);
      }
    }
  }

  // Strategy 6: Check direct URL fields on item
  const directUrlFields = [
    'display_url',
    'image_url',
    'thumbnail_url',
    'media_url',
    'video_url'
  ];
  
  for (const field of directUrlFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].startsWith('http')) {
      urls.push(item[field]);
    }
  }

  // Strategy 7: Check nested structures (thread, post)
  if (item.thread) {
    const threadUrl = extractUrlFromMedia(item.thread);
    if (threadUrl) urls.push(threadUrl);
    
    // Also check direct fields
    for (const field of directUrlFields) {
      if (item.thread[field] && typeof item.thread[field] === 'string' && item.thread[field].startsWith('http')) {
        urls.push(item.thread[field]);
      }
    }
  }
  
  if (item.post) {
    const postUrl = extractUrlFromMedia(item.post);
    if (postUrl) urls.push(postUrl);
    
    for (const field of directUrlFields) {
      if (item.post[field] && typeof item.post[field] === 'string' && item.post[field].startsWith('http')) {
        urls.push(item.post[field]);
      }
    }
  }

  // Remove duplicates and filter valid URLs
  const validUrls = [...new Set(urls.filter(url => url && typeof url === 'string' && url.startsWith('http')))];
  
  // Debug logging
  if (debug && postId) {
    if (validUrls.length > 0) {
      console.log(`[MEDIA DEBUG] Post ${postId}: extractMediaUrls found ${validUrls.length} URLs`);
      console.log(`[MEDIA DEBUG] URLs:`, validUrls.slice(0, 2).map(u => u.substring(0, 100)));
      if (debugInfo.length > 0) {
        console.log(`[MEDIA DEBUG] Debug info:`, debugInfo.slice(0, 5));
      }
    } else {
      // Check what media-related fields exist
      const mediaKeys = Object.keys(item).filter(k => 
        k.toLowerCase().includes('media') || 
        k.toLowerCase().includes('image') || 
        k.toLowerCase().includes('video') ||
        k.toLowerCase().includes('photo') ||
        k.toLowerCase().includes('carousel')
      );
      
      if (mediaKeys.length > 0) {
        debugInfo.push(`Found media-related keys: ${mediaKeys.join(', ')}`);
        // Log structure of first media-related field
        const firstMediaKey = mediaKeys[0];
        const mediaValue = item[firstMediaKey];
        if (mediaValue) {
          const valueStr = typeof mediaValue === 'object' 
            ? JSON.stringify(mediaValue).substring(0, 500)
            : String(mediaValue).substring(0, 200);
          debugInfo.push(`${firstMediaKey} structure: ${valueStr}`);
        }
      } else {
        debugInfo.push('No media-related keys found');
      }
      
      console.log(`[MEDIA DEBUG] Post ${postId}: ${debugInfo.join('; ')}`);
    }
  }

  return validUrls;
}

/**
 * Determine media type (image, video, carousel, or null)
 */
export function determineMediaType(item, mediaUrls) {
  if (!mediaUrls || mediaUrls.length === 0) return null;
  
  // Check if any media is video
  const hasVideo = item.video_versions ||
                  item.video_url ||
                  item.video_codec ||
                  item.media_type === 2 || // Instagram uses 2 for video
                  item.media_type === 'VIDEO' ||
                  item.type === 'video' ||
                  item.media?.some(m => m.type === 'video' || m.media_type === 2) ||
                  item.carousel_media?.some(m => m.video_versions || m.type === 'video') ||
                  false;

  if (hasVideo) {
    return mediaUrls.length > 1 ? 'carousel_video' : 'video';
  }

  // Check if carousel (multiple images)
  if (item.carousel_media && item.carousel_media.length > 1) {
    return 'carousel_image';
  }

  // Default to image
  return 'image';
}

/**
 * Extract video duration (in seconds)
 */
export function extractVideoDuration(item) {
  return item.video_duration ||
         item.video_info?.duration ||
         item.video_versions?.[0]?.duration ||
         item.media?.find(m => m.video_versions)?.video_versions?.[0]?.duration ||
         item.carousel_media?.find(m => m.video_versions)?.video_versions?.[0]?.duration ||
         null;
}

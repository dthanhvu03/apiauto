/**
 * Shortcode Research Utility
 * 
 * Collects and analyzes (post_id, shortcode) pairs to reverse engineer
 * Threads' shortcode encoding algorithm
 */

import fs from 'fs';
import path from 'path';

const SAMPLES_FILE = path.join(process.cwd(), 'shortcode-samples.json');

/**
 * Load existing samples from file
 */
export function loadSamples() {
  try {
    if (fs.existsSync(SAMPLES_FILE)) {
      const data = fs.readFileSync(SAMPLES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[SHORTCODE RESEARCH] Error loading samples:', error.message);
  }
  return { samples: [], metadata: { lastUpdated: null, totalSamples: 0 } };
}

/**
 * Save samples to file
 */
export function saveSamples(samplesData) {
  try {
    const data = {
      samples: samplesData.samples || [],
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalSamples: (samplesData.samples || []).length
      }
    };
    fs.writeFileSync(SAMPLES_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[SHORTCODE RESEARCH] Saved ${data.metadata.totalSamples} samples to ${SAMPLES_FILE}`);
  } catch (error) {
    console.error('[SHORTCODE RESEARCH] Error saving samples:', error.message);
  }
}

/**
 * Extract shortcode from GraphQL response item
 * Checks multiple possible fields where shortcode might be stored
 */
export function extractShortcodeFromItem(item) {
  // Check common fields for shortcode
  const shortcode = item.code ||
                   item.shortcode ||
                   item.short_code ||
                   item.url_code ||
                   item.slug ||
                   null;

  return shortcode;
}

/**
 * Extract post_id from GraphQL response item
 */
export function extractPostIdFromItem(item) {
  // Extract post_id (pk) from various possible fields
  const postId = item.pk ||
                item.id?.split('_')[0] || // Handle composite IDs
                item.post_id ||
                item.thread_id ||
                null;

  return postId;
}

/**
 * Add a sample (post_id, shortcode) pair
 * Deduplicates based on post_id
 */
export function addSample(samplesData, postId, shortcode, source = 'unknown') {
  if (!postId || !shortcode) {
    return samplesData;
  }

  // Check if we already have this post_id
  const existingIndex = samplesData.samples.findIndex(s => s.post_id === postId);
  
  if (existingIndex >= 0) {
    // Update existing sample if shortcode is different
    if (samplesData.samples[existingIndex].shortcode !== shortcode) {
      console.log(`[SHORTCODE RESEARCH] Updating sample: post_id=${postId}, old_shortcode=${samplesData.samples[existingIndex].shortcode}, new_shortcode=${shortcode}`);
      samplesData.samples[existingIndex].shortcode = shortcode;
      samplesData.samples[existingIndex].source = source;
      samplesData.samples[existingIndex].updatedAt = new Date().toISOString();
    }
  } else {
    // Add new sample
    samplesData.samples.push({
      post_id: postId,
      shortcode: shortcode,
      source: source,
      createdAt: new Date().toISOString()
    });
  }

  return samplesData;
}

/**
 * Collect samples from GraphQL response items
 */
export function collectFromGraphQLItems(items) {
  const samplesData = loadSamples();
  let addedCount = 0;

  for (const item of items) {
    const postId = extractPostIdFromItem(item);
    const shortcode = extractShortcodeFromItem(item);

    if (postId && shortcode) {
      addSample(samplesData, postId, shortcode, 'graphql');
      addedCount++;
    }
  }

  if (addedCount > 0) {
    saveSamples(samplesData);
    console.log(`[SHORTCODE RESEARCH] Collected ${addedCount} new samples from GraphQL items`);
  }

  return samplesData;
}

/**
 * Collect sample from URL
 * Extracts shortcode from Threads post URL
 */
export function collectFromURL(url, postId) {
  // URL format: https://www.threads.com/@username/post/SHORTCODE
  const urlMatch = url.match(/\/post\/([A-Za-z0-9_-]+)/);
  if (urlMatch && postId) {
    const shortcode = urlMatch[1];
    const samplesData = loadSamples();
    addSample(samplesData, postId, shortcode, 'url');
    saveSamples(samplesData);
    console.log(`[SHORTCODE RESEARCH] Collected sample from URL: post_id=${postId}, shortcode=${shortcode}`);
    return { post_id: postId, shortcode };
  }
  return null;
}

/**
 * Get all samples for analysis
 */
export function getAllSamples() {
  const data = loadSamples();
  return data.samples || [];
}

/**
 * Test Shortcode Encoding
 * 
 * Script to test encoding algorithms against collected samples
 */

import { getAllSamples } from './shortcode-research.js';
import { tryEncode, tryDecode, findMatchingAlgorithm } from './shortcode-encoder.js';

/**
 * Test encoding algorithms with collected samples
 */
export function testEncodingAlgorithms() {
  const samples = getAllSamples();
  
  if (samples.length === 0) {
    console.log('[SHORTCODE TEST] No samples found. Please collect samples first.');
    return;
  }

  console.log(`[SHORTCODE TEST] Testing ${samples.length} samples...`);
  
  const results = {
    base64url: { matches: 0, total: 0 },
    base58: { matches: 0, total: 0 },
    base64: { matches: 0, total: 0 },
    unknown: []
  };

  for (const sample of samples) {
    const { post_id, shortcode } = sample;
    
    if (!post_id || !shortcode) continue;
    
    // Try to find matching algorithm
    const algorithm = findMatchingAlgorithm(post_id, shortcode);
    
    if (algorithm) {
      results[algorithm].matches++;
      results[algorithm].total++;
      console.log(`[SHORTCODE TEST] ✓ ${algorithm}: post_id=${post_id}, shortcode=${shortcode}`);
    } else {
      // Try all encoding methods
      const encodeResults = tryEncode(post_id);
      const decodeResults = tryDecode(shortcode);
      
      console.log(`[SHORTCODE TEST] ✗ No match for post_id=${post_id}, shortcode=${shortcode}`);
      console.log(`[SHORTCODE TEST]   Encode results:`, encodeResults);
      console.log(`[SHORTCODE TEST]   Decode results:`, decodeResults);
      
      results.unknown.push({ post_id, shortcode, encodeResults, decodeResults });
    }
  }

  // Summary
  console.log('\n[SHORTCODE TEST] Summary:');
  console.log(`  base64url: ${results.base64url.matches}/${samples.length} matches`);
  console.log(`  base58: ${results.base58.matches}/${samples.length} matches`);
  console.log(`  base64: ${results.base64.matches}/${samples.length} matches`);
  console.log(`  unknown: ${results.unknown.length} samples`);
  
  if (results.unknown.length > 0) {
    console.log('\n[SHORTCODE TEST] Unknown samples (need further investigation):');
    results.unknown.slice(0, 5).forEach(s => {
      console.log(`  post_id=${s.post_id}, shortcode=${s.shortcode}`);
    });
  }

  return results;
}

/**
 * Test with a specific post_id and shortcode pair
 */
export function testSinglePair(postId, shortcode) {
  console.log(`[SHORTCODE TEST] Testing: post_id=${postId}, shortcode=${shortcode}`);
  
  const encodeResults = tryEncode(postId);
  const decodeResults = tryDecode(shortcode);
  const algorithm = findMatchingAlgorithm(postId, shortcode);
  
  console.log('Encode results:', encodeResults);
  console.log('Decode results:', decodeResults);
  console.log('Matching algorithm:', algorithm || 'NONE');
  
  return { encodeResults, decodeResults, algorithm };
}

// If run directly, test with known sample
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test with known sample from user's data
  // post_id: 3821612401750661495, shortcode: DUJGDtLk1l3
  testSinglePair('3821612401750661495', 'DUJGDtLk1l3');
  
  // Test all samples
  testEncodingAlgorithms();
}

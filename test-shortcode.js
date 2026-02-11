/**
 * Quick test script for shortcode encoding
 * Test with known sample: post_id=3821612401750661495, shortcode=DUJGDtLk1l3
 */

import { tryEncode, tryDecode, findMatchingAlgorithm } from './src/utils/shortcode-encoder.js';

const postId = '3821615455496409551';
const shortcode = 'DUJGwJNAZHP';

console.log('Testing shortcode encoding:');
console.log(`  post_id: ${postId}`);
console.log(`  shortcode: ${shortcode}\n`);

// Try encoding
console.log('=== Encoding (post_id → shortcode) ===');
const encodeResults = tryEncode(postId);
encodeResults.forEach(r => {
  console.log(`  ${r.algorithm}: ${r.shortcode} ${r.shortcode === shortcode ? '✓ MATCH!' : ''}`);
});

// Try decoding
console.log('\n=== Decoding (shortcode → post_id) ===');
const decodeResults = tryDecode(shortcode);
decodeResults.forEach(r => {
  console.log(`  ${r.algorithm}: ${r.post_id} ${r.post_id === postId ? '✓ MATCH!' : ''}`);
});

// Find matching algorithm
console.log('\n=== Finding Matching Algorithm ===');
const algorithm = findMatchingAlgorithm(postId, shortcode);
console.log(`  Result: ${algorithm || 'NONE FOUND'}`);

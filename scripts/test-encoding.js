#!/usr/bin/env node

/**
 * Test Shortcode Encoding Script
 * 
 * Quick test to find encoding algorithm for Threads shortcodes
 */

import { tryEncode, tryDecode, findMatchingAlgorithm } from '../src/utils/shortcode-encoder.js';

// Known sample from user
const KNOWN_SAMPLES = [
  { post_id: '3821612401750661495', shortcode: 'DUJGDtLk1l3' }
];

console.log('=== Threads Shortcode Encoding Test ===\n');

for (const sample of KNOWN_SAMPLES) {
  const { post_id, shortcode } = sample;
  
  console.log(`Testing: post_id=${post_id}, shortcode=${shortcode}`);
  console.log('─'.repeat(60));
  
  // Try encoding
  console.log('\n1. Encoding (post_id → shortcode):');
  const encodeResults = tryEncode(post_id);
  for (const result of encodeResults) {
    const match = result.shortcode === shortcode ? ' ✓ MATCH!' : '';
    console.log(`   ${result.algorithm.padEnd(12)}: ${result.shortcode}${match}`);
  }
  
  // Try decoding
  console.log('\n2. Decoding (shortcode → post_id):');
  const decodeResults = tryDecode(shortcode);
  for (const result of decodeResults) {
    const match = result.post_id === post_id ? ' ✓ MATCH!' : '';
    console.log(`   ${result.algorithm.padEnd(12)}: ${result.post_id}${match}`);
  }
  
  // Find matching algorithm
  console.log('\n3. Algorithm Detection:');
  const algorithm = findMatchingAlgorithm(post_id, shortcode);
  if (algorithm) {
    console.log(`   ✓ Found matching algorithm: ${algorithm}`);
  } else {
    console.log('   ✗ No matching algorithm found');
    console.log('\n   This suggests Threads may use:');
    console.log('   - A custom encoding algorithm');
    console.log('   - A different base/alphabet');
    console.log('   - Additional transformation (e.g., XOR, bit manipulation)');
  }
  
  console.log('\n');
}

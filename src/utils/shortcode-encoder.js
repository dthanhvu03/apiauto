/**
 * Shortcode Encoder/Decoder
 * 
 * Implements various encoding algorithms to reverse engineer
 * Threads' shortcode encoding from post_id
 */

/**
 * Base64 URL-safe encoding (Instagram-style)
 * Uses custom alphabet: A-Z, a-z, 0-9, -, _
 */
const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Base58 encoding (Bitcoin-style, no 0, O, I, l)
 * Commonly used for shortcodes
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Convert number to BigInt for handling large integers
 */
function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  return BigInt(value);
}

/**
 * Base64 URL-safe encode (custom alphabet)
 */
function base64UrlEncode(num, alphabet = BASE64_URL_ALPHABET) {
  const bigNum = toBigInt(num);
  if (bigNum === 0n) return alphabet[0];

  let result = '';
  let n = bigNum;
  const base = BigInt(alphabet.length);

  while (n > 0n) {
    result = alphabet[Number(n % base)] + result;
    n = n / base;
  }

  return result;
}

/**
 * Base64 URL-safe decode (custom alphabet)
 */
function base64UrlDecode(encoded, alphabet = BASE64_URL_ALPHABET) {
  let result = 0n;
  const base = BigInt(alphabet.length);

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid character in encoded string: ${char}`);
    }
    result = result * base + BigInt(index);
  }

  return result.toString();
}

/**
 * Base58 encode
 */
function base58Encode(num) {
  return base64UrlEncode(num, BASE58_ALPHABET);
}

/**
 * Base58 decode
 */
function base58Decode(encoded) {
  return base64UrlDecode(encoded, BASE58_ALPHABET);
}

/**
 * Standard Base64 encode (with padding)
 */
function standardBase64Encode(num) {
  // Convert number to buffer
  const bigNum = toBigInt(num);
  const bytes = [];
  let n = bigNum;
  
  if (n === 0n) {
    bytes.push(0);
  } else {
    while (n > 0n) {
      bytes.unshift(Number(n & 0xFFn));
      n = n >> 8n;
    }
  }

  // Convert to base64
  const buffer = Buffer.from(bytes);
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Standard Base64 decode
 */
function standardBase64Decode(encoded) {
  // Restore base64 padding if needed
  let padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }

  const buffer = Buffer.from(padded, 'base64');
  let result = 0n;
  for (let i = 0; i < buffer.length; i++) {
    result = (result << 8n) + BigInt(buffer[i]);
  }
  return result.toString();
}

/**
 * Try to encode post_id using various algorithms
 * Returns array of { algorithm, shortcode } pairs
 */
export function tryEncode(postId) {
  const results = [];

  try {
    // Try Base64 URL-safe
    const base64Url = base64UrlEncode(postId);
    results.push({ algorithm: 'base64url', shortcode: base64Url });
  } catch (error) {
    // Ignore
  }

  try {
    // Try Base58
    const base58 = base58Encode(postId);
    results.push({ algorithm: 'base58', shortcode: base58 });
  } catch (error) {
    // Ignore
  }

  try {
    // Try standard Base64
    const base64 = standardBase64Encode(postId);
    results.push({ algorithm: 'base64', shortcode: base64 });
  } catch (error) {
    // Ignore
  }

  return results;
}

/**
 * Try to decode shortcode using various algorithms
 * Returns array of { algorithm, post_id } pairs
 */
export function tryDecode(shortcode) {
  const results = [];

  try {
    // Try Base64 URL-safe
    const base64Url = base64UrlDecode(shortcode);
    results.push({ algorithm: 'base64url', post_id: base64Url });
  } catch (error) {
    // Ignore
  }

  try {
    // Try Base58
    const base58 = base58Decode(shortcode);
    results.push({ algorithm: 'base58', post_id: base58 });
  } catch (error) {
    // Ignore
  }

  try {
    // Try standard Base64
    const base64 = standardBase64Decode(shortcode);
    results.push({ algorithm: 'base64', post_id: base64 });
  } catch (error) {
    // Ignore
  }

  return results;
}

/**
 * Find matching algorithm by testing encode/decode roundtrip
 */
export function findMatchingAlgorithm(postId, shortcode) {
  const encodeResults = tryEncode(postId);
  
  for (const result of encodeResults) {
    if (result.shortcode === shortcode) {
      return result.algorithm;
    }
  }

  // Try decode
  const decodeResults = tryDecode(shortcode);
  for (const result of decodeResults) {
    if (result.post_id === postId) {
      return result.algorithm;
    }
  }

  return null;
}

/**
 * Encode post_id to shortcode using specified algorithm
 */
export function encodePostId(postId, algorithm = 'base64url') {
  switch (algorithm) {
    case 'base64url':
      return base64UrlEncode(postId);
    case 'base58':
      return base58Encode(postId);
    case 'base64':
      return standardBase64Encode(postId);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

/**
 * Decode shortcode to post_id using specified algorithm
 */
export function decodeShortcode(shortcode, algorithm = 'base64url') {
  switch (algorithm) {
    case 'base64url':
      return base64UrlDecode(shortcode);
    case 'base58':
      return base58Decode(shortcode);
    case 'base64':
      return standardBase64Decode(shortcode);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

/**
 * Validate shortcode format
 */
export function isValidShortcode(shortcode) {
  if (!shortcode || typeof shortcode !== 'string') {
    return false;
  }
  
  // Threads shortcodes are typically 11-12 characters
  // Alphanumeric with possible dashes/underscores
  return /^[A-Za-z0-9_-]{8,15}$/.test(shortcode);
}

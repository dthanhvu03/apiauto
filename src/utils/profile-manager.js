/**
 * Profile Manager Utilities
 * 
 * Handles profile listing, info retrieval, and path management
 * All profiles are stored client-side, server only uses paths provided by client
 */

import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getSessionPath } from '../config.js';

/**
 * List all profiles in a base directory
 * @param {string} baseDirectory - Base directory path to scan
 * @returns {Promise<Array>} Array of profile information objects
 */
export async function listProfiles(baseDirectory) {
  if (!baseDirectory || typeof baseDirectory !== 'string') {
    throw new Error('Base directory is required');
  }
  
  // Validate base directory exists
  if (!existsSync(baseDirectory)) {
    return [];
  }
  
  try {
    const entries = await readdir(baseDirectory, { withFileTypes: true });
    const profiles = [];
    
    for (const entry of entries) {
      // Only include directories (profiles are directories)
      if (entry.isDirectory()) {
        const profilePath = join(baseDirectory, entry.name);
        try {
          const profileInfo = await getProfileInfo(profilePath, entry.name);
          profiles.push(profileInfo);
        } catch (error) {
          // Skip profiles that can't be read
          console.warn(`[PROFILE] Could not read profile ${entry.name}: ${error.message}`);
        }
      }
    }
    
    // Sort by created_at (newest first)
    profiles.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
    
    return profiles;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get information about a specific profile
 * @param {string} profilePath - Full path to profile directory
 * @param {string} profileId - Profile ID (directory name)
 * @returns {Promise<Object>} Profile information object
 */
export async function getProfileInfo(profilePath, profileId = null) {
  if (!profilePath || typeof profilePath !== 'string') {
    throw new Error('Profile path is required');
  }
  
  // Extract profile_id from path if not provided
  if (!profileId) {
    const parts = profilePath.split('/').filter(p => p);
    profileId = parts[parts.length - 1] || 'unknown';
  }
  
  const exists = existsSync(profilePath);
  
  let size = 0;
  let created_at = null;
  let has_session = false;
  
  if (exists) {
    try {
      // Get directory stats
      const stats = await stat(profilePath);
      created_at = stats.birthtime || stats.ctime || null;
      
      // Calculate total size recursively
      size = await calculateDirectorySize(profilePath);
      
      // Check if session file exists
      // Try to determine account_id from profile path
      const pathParts = profilePath.split('/').filter(p => p);
      const possibleAccountId = pathParts[pathParts.length - 1];
      
      if (possibleAccountId) {
        // Check for session file (could be in profile directory or subdirectory)
        const sessionPath = getSessionPath(possibleAccountId);
        has_session = existsSync(sessionPath);
        
        // Also check if session might be in the profile directory itself
        if (!has_session) {
          const profileSessionPath = join(profilePath, 'threads_session.json');
          has_session = existsSync(profileSessionPath);
        }
      }
    } catch (error) {
      console.warn(`[PROFILE] Could not get stats for ${profilePath}: ${error.message}`);
    }
  }
  
  return {
    profile_id: profileId,
    path: profilePath,
    full_path: profilePath,
    exists: exists,
    size: size,
    created_at: created_at ? new Date(created_at).toISOString() : null,
    has_session: has_session
  };
}

/**
 * Calculate total size of a directory recursively
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Total size in bytes
 */
async function calculateDirectorySize(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        totalSize += await calculateDirectorySize(fullPath);
      } else {
        try {
          const stats = await stat(fullPath);
          totalSize += stats.size || 0;
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    return 0;
  }
}

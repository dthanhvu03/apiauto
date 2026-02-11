/**
 * Profile Management Routes
 * 
 * Routes for listing and managing browser profiles
 * All profiles are stored client-side, server only uses paths provided by client
 */

import express from 'express';
import { extractBaseDirectory, validateBaseDirectory, CONFIG } from '../../config.js';
import { listProfiles, getProfileInfo } from '../../utils/profile-manager.js';
import { wrapRouteWithTimeout, OPERATION_TYPES } from '../utils/timeout-handler.js';
import { TimeoutError } from '../../interactions/errors.js';

const router = express.Router();

/**
 * GET /api/profiles
 * List all profiles in a base directory specified by client
 * 
 * Query Parameters:
 * - base_directory (string, required) - Base directory path on client machine to scan profiles
 */
router.get('/profiles', wrapRouteWithTimeout(async (req, res) => {
  try {
    const baseDirectory = extractBaseDirectory(req);
    
    if (!baseDirectory) {
      return res.status(400).json({
        success: false,
        error: 'base_directory is required. Provide it via query parameter, request body, or X-Base-Directory header.'
      });
    }
    
    // Validate base directory
    const validatedBase = validateBaseDirectory(baseDirectory);
    if (!validatedBase) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base_directory format. Path must be valid and not contain ".." or "//"'
      });
    }
    
    // List profiles
    const profiles = await listProfiles(validatedBase);
    
    res.json({
      success: true,
      data: {
        profiles: profiles,
        total: profiles.length,
        base_directory: validatedBase
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API ERROR]', error);
    
    // Handle timeout errors
    if (error instanceof TimeoutError || error.errorCode === 'TIMEOUT_ERROR') {
      return res.status(504).json({
        success: false,
        error: error.message || 'List profiles operation timed out',
        errorCode: 'TIMEOUT_ERROR',
        timeout: error.timeout || CONFIG.api.timeout.quickOperation,
        operation: 'list_profiles',
        elapsedTime: error.elapsedTime || null,
        timestamp: error.timestamp || new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.QUICK_OPERATION, 'list_profiles'));

/**
 * GET /api/profiles/:profileId
 * Get detailed information about a specific profile
 * 
 * URL Parameters:
 * - profileId (string) - Profile ID (directory name)
 * 
 * Query Parameters:
 * - base_directory (string, required) - Base directory path on client machine
 */
router.get('/profiles/:profileId', wrapRouteWithTimeout(async (req, res) => {
  try {
    const { profileId } = req.params;
    const baseDirectory = extractBaseDirectory(req);
    
    if (!baseDirectory) {
      return res.status(400).json({
        success: false,
        error: 'base_directory is required. Provide it via query parameter, request body, or X-Base-Directory header.'
      });
    }
    
    // Validate base directory
    const validatedBase = validateBaseDirectory(baseDirectory);
    if (!validatedBase) {
      return res.status(400).json({
        success: false,
        error: 'Invalid base_directory format. Path must be valid and not contain ".." or "//"'
      });
    }
    
    // Validate profile_id format
    const profileIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!profileIdPattern.test(profileId)) {
      return res.status(400).json({
        success: false,
        error: `Invalid profile_id format: ${profileId}. Must be alphanumeric with underscores or hyphens.`
      });
    }
    
    // Construct full profile path
    const profilePath = `${validatedBase}/${profileId}`;
    
    // Get profile info
    const profileInfo = await getProfileInfo(profilePath, profileId);
    
    res.json({
      success: true,
      data: profileInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}, OPERATION_TYPES.QUICK_OPERATION, 'get_profile_info'));

export default router;

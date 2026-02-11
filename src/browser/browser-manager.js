/**
 * Browser Management
 * 
 * Handles browser launch and context creation
 */

import { chromium } from 'playwright';
import { CONFIG, getProfilePath } from '../config.js';
import { existsSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Remove stale Chromium lock files
 * WHY: Chromium creates SingletonLock to prevent multiple instances
 * If a previous instance crashed, the lock file remains and blocks new instances
 * @param {string} profilePath - Profile directory path
 */
function removeStaleLockFiles(profilePath) {
  const lockFiles = [
    join(profilePath, 'SingletonLock'),
    join(profilePath, 'SingletonSocket'),
    join(profilePath, 'SingletonCookie')
  ];
  
  let removedCount = 0;
  for (const lockFile of lockFiles) {
    if (existsSync(lockFile)) {
      try {
        unlinkSync(lockFile);
        console.log(`[BROWSER] Removed stale lock file: ${lockFile}`);
        removedCount++;
      } catch (error) {
        console.warn(`[BROWSER] Could not remove lock file ${lockFile}: ${error.message}`);
      }
    }
  }
  
  return removedCount > 0;
}

/**
 * Launch Chromium browser with realistic settings
 * WHY: Mimics real user behavior to avoid detection
 * STABLE: Browser launch API is stable, fallback logic handles missing Chrome
 * @param {string|null} accountId - Optional account ID for account-specific browser profile
 * @param {string|null} profilePath - Optional custom profile path provided by client
 * @returns {Promise<{browser: Browser, context: BrowserContext}>}
 */
export async function launchBrowser(accountId = null, profilePath = null) {
  // Nếu profilePath được cung cấp, sử dụng nó
  // Nếu không, gọi getProfilePath với accountId và customProfilePath = null
  // getProfilePath sẽ trả về null nếu persistent profile bị tắt
  const finalProfilePath = profilePath || getProfilePath(accountId, null);
  const contextOptions = {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  };

  // If profilePath is provided, use persistent context with userDataDir
  if (finalProfilePath) {
    // Ensure profile directory exists
    if (!existsSync(finalProfilePath)) {
      await mkdir(finalProfilePath, { recursive: true });
    }
    
    console.log(`[BROWSER] Using persistent profile: ${finalProfilePath}`);
    
    // Use launchPersistentContext for persistent browser profile
    // Only include channel if it's a non-empty string (Playwright doesn't accept null)
    const launchOptions = {
      headless: CONFIG.browser.headless,
      args: CONFIG.browser.args,
      ...(CONFIG.browser.channel ? { channel: CONFIG.browser.channel } : {})
    };

    // Try to launch with retry logic for lock file issues
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const context = await chromium.launchPersistentContext(finalProfilePath, {
          ...launchOptions,
          ...contextOptions
        });
        
        // Get browser from context (may be null, but context.close() will close browser)
        const browser = context.browser();
        if (browser && CONFIG.browser.channel) {
          console.log(`[BROWSER] Using ${CONFIG.browser.channel} channel`);
        } else {
          console.log('[BROWSER] Using bundled Chromium');
        }
        
        // Return context and browser (browser may be null, but context.close() handles cleanup)
        return { browser, context };
      } catch (e) {
        // Check if it's a profile lock error
        const errorMessage = e.message || '';
        const isLockError = errorMessage.includes('ProcessSingleton') || 
                          errorMessage.includes('profile is already in use') ||
                          errorMessage.includes('SingletonLock');
        
        // Check if it's a channel/browser not found error
        const isChannelError = errorMessage.includes('is not found') ||
                              errorMessage.includes('Chromium distribution') ||
                              errorMessage.includes('channel') ||
                              errorMessage.includes('Run "npx playwright install');
        
        // Check if it's a closed browser error (concurrent access issue)
        const isClosedError = errorMessage.includes('has been closed') ||
                             errorMessage.includes('Target page') ||
                             errorMessage.includes('Target context') ||
                             errorMessage.includes('Target browser');
        
        if (isLockError && attempt === 0) {
          // First attempt failed with lock error, try removing stale lock files
          console.log('[BROWSER] Profile lock detected, attempting to remove stale lock files...');
          const removed = removeStaleLockFiles(finalProfilePath);
          
          if (removed) {
            console.log('[BROWSER] Retrying browser launch after removing lock files...');
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            continue; // Retry
          } else {
            // No lock files found, might be a real instance running
            console.error('[BROWSER] Profile is locked but no stale lock files found.');
            console.error('[BROWSER] Another Chromium instance may be using this profile.');
            console.error('[BROWSER] Please close all Chromium instances or wait for them to finish.');
            throw new Error(`Profile ${finalProfilePath} is locked. Another Chromium instance may be using it. Please close all Chromium instances or wait for them to finish.`);
          }
        }
        
        if (isClosedError && attempt === 0) {
          // Browser was closed, likely due to concurrent access - wait and retry
          console.log('[BROWSER] Browser was closed, likely due to concurrent access. Waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // Retry
        }
        
        // If it's a channel error and we have channel configured, try fallback without channel
        if (isChannelError && attempt === 0 && CONFIG.browser.channel) {
          // Fallback: try without channel (use bundled Chromium)
          console.log(`[BROWSER] ${CONFIG.browser.channel} channel not found, falling back to bundled Chromium`);
          try {
            const context = await chromium.launchPersistentContext(finalProfilePath, {
              headless: CONFIG.browser.headless,
              args: CONFIG.browser.args,
              // Don't include channel option - use bundled Chromium
              ...contextOptions
            });
            const browser = context.browser();
            console.log('[BROWSER] Successfully launched with bundled Chromium');
            return { browser, context };
          } catch (fallbackError) {
            // If fallback also fails, throw the original error
            console.error('[BROWSER] Fallback to bundled Chromium also failed:', fallbackError.message);
            throw e;
          }
        }
        
        // If we get here, it's the second attempt or a non-lock/non-channel error
        throw e;
      }
    }
    
    // Should not reach here, but just in case
    throw new Error('Failed to launch browser after retries');
  }

  // No accountId: use temporary context (original behavior)
  const launchOptions = {
    headless: CONFIG.browser.headless,
    args: CONFIG.browser.args
  };

  let browser;
  try {
    browser = await chromium.launch({
      ...launchOptions,
      ...(CONFIG.browser.channel ? { channel: CONFIG.browser.channel } : {})
    });
    if (CONFIG.browser.channel) {
      console.log(`[BROWSER] Using ${CONFIG.browser.channel} channel`);
    } else {
      console.log('[BROWSER] Using bundled Chromium');
    }
  } catch (e) {
    // Fallback to bundled Chromium if Chrome is not available
    console.log('[BROWSER] Chrome not found, using bundled Chromium');
    browser = await chromium.launch(launchOptions);
  }

  const context = await browser.newContext(contextOptions);
  return { browser, context };
}

/**
 * Create browser context with custom settings
 */
export async function createBrowserContext(browser, options = {}) {
  return await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ...options
  });
}

/**
 * Safely close browser and context
 * Handles both regular browser instances and persistent contexts
 * @param {Browser|null} browser - Browser instance (may be null for persistent contexts)
 * @param {BrowserContext} context - Browser context
 */
export async function closeBrowser(browser, context) {
  try {
    // For persistent contexts, closing the context closes the browser
    // For regular browsers, close the browser (which closes all contexts)
    if (browser) {
      await browser.close();
    } else if (context) {
      await context.close();
    }
  } catch (error) {
    console.error('[BROWSER] Error closing browser:', error.message);
  }
}

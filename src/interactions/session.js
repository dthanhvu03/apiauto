/**
 * Session Management Module
 * 
 * Handles login, session storage, and authentication for Threads interactions
 */

import { CONFIG, getSessionPath, getAccountCredentials, normalizeAccountId, findAccountByUsername } from '../config.js';
import { delay } from './utils.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

/**
 * Save session cookies to file
 */
export async function saveSession(context, sessionPath) {
  try {
    const cookies = await context.cookies();
    const sessionDir = dirname(sessionPath);
    
    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true });
    }
    
    await writeFile(sessionPath, JSON.stringify(cookies, null, 2), 'utf-8');
    console.log(`[LOGIN] Session saved to ${sessionPath}`);
    return true;
  } catch (error) {
    console.error(`[LOGIN] Failed to save session: ${error.message}`);
    return false;
  }
}

/**
 * Load session cookies from file
 */
export async function loadSession(context, sessionPath) {
  try {
    if (!existsSync(sessionPath)) {
      return false;
    }
    
    const cookiesData = await readFile(sessionPath, 'utf-8');
    const cookies = JSON.parse(cookiesData);
    
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies);
      console.log(`[LOGIN] Session loaded from ${sessionPath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[LOGIN] Failed to load session: ${error.message}`);
    return false;
  }
}

/**
 * Check if user is logged in to Threads
 * @param {Page} page - Playwright page object
 * @param {boolean} skipNavigation - Skip navigation if already on a page
 * @returns {Promise<boolean>} True if logged in
 */
export async function checkIfLoggedIn(page, skipNavigation = false) {
  try {
    // Only navigate if not already on Threads page or if explicitly requested
    if (!skipNavigation) {
      try {
        // Use domcontentloaded instead of networkidle for faster check
        await page.goto(CONFIG.threads.url, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.browser.timeouts.sessionCheck
        });
      } catch (timeoutError) {
        // If timeout, try to check current page
        console.log('[LOGIN] Navigation timeout, checking current page...');
        const currentUrl = page.url();
        if (!currentUrl.includes('threads')) {
          // If not on threads page, assume not logged in
          console.log('[LOGIN] Not on Threads page, assuming not logged in');
          return false;
        }
        // Continue with current page
      }
    }
    
    await delay(2000);
    
    // Check for login indicators (logged out)
    const loginIndicators = [
      'button:has-text("Log in")',
      'a[href*="login"]',
      'text="Log in"'
    ];
    
    for (const selector of loginIndicators) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log('[LOGIN] User is not logged in');
            return false;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Check for logged-in indicators
    const loggedInIndicators = [
      'a[href*="/@"]', // Profile link
      'button[aria-label*="Home"]',
      'nav[role="navigation"]',
      '[data-testid*="nav"]',
      'header nav'
    ];
    
    for (const selector of loggedInIndicators) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            console.log('[LOGIN] User appears to be logged in');
            return true;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // If we can't determine, assume not logged in for safety
    console.log('[LOGIN] Could not determine login status, assuming not logged in');
    return false;
  } catch (error) {
    console.error(`[LOGIN] Error checking login status: ${error.message}`);
    // On error, be conservative and assume not logged in
    return false;
  }
}

/**
 * Login to Threads
 * @param {Page} page - Playwright page object
 * @param {string} username - Username or email
 * @param {string} password - Password
 * @param {string|null} accountId - Optional account ID for account-specific session
 * @returns {Promise<Object>} Result object with success status
 */
export async function loginToThreads(page, username, password, accountId = null) {
  const config = CONFIG.interactions.login;
  
  if (!username || !password) {
    return {
      success: false,
      error: 'Username and password are required'
    };
  }
  
  try {
    console.log('[LOGIN] Attempting to login to Threads...');
    
    // Navigate to Threads
    await page.goto(CONFIG.threads.url, {
      waitUntil: 'networkidle',
      timeout: CONFIG.browser.navigationTimeout
    });
    
    await delay(3000);
    
    // Check if already logged in
    const isLoggedIn = await checkIfLoggedIn(page);
    if (isLoggedIn) {
      return {
        success: true,
        alreadyLoggedIn: true,
        message: 'Already logged in'
      };
    }
    
    // Check current URL - Threads might redirect to Instagram login
    const currentUrl = page.url();
    console.log(`[LOGIN] Current URL: ${currentUrl}`);
    
    // If not on login page, try to navigate to login
    if (!currentUrl.includes('login') && !currentUrl.includes('accounts')) {
      // Try clicking login button/link
      const loginButtonSelectors = CONFIG.selectors.loginButton;
      let loginClicked = false;
      
      for (const selector of loginButtonSelectors) {
        try {
          const button = await page.waitForSelector(selector, { 
            timeout: CONFIG.browser.timeouts.normalOperation,
            state: 'visible' 
          }).catch(() => null);
          
          if (button) {
            await button.click();
            await delay(2000);
            loginClicked = true;
            break;
          }
        } catch (e) {
          // Continue
        }
      }
      
      if (!loginClicked) {
        // Try navigating directly to login page
        console.log('[LOGIN] Navigating to login page...');
        await page.goto(`${CONFIG.threads.url}/login`, {
          waitUntil: 'networkidle',
          timeout: CONFIG.browser.navigationTimeout
        });
        await delay(3000);
      }
    }
    
    // Wait for login form to appear and check URL again
    await delay(2000);
    const newUrl = page.url();
    console.log(`[LOGIN] URL after navigation: ${newUrl}`);
    
    // Threads might redirect to Instagram login - handle both cases
    const isInstagramLogin = newUrl.includes('instagram.com') || newUrl.includes('accounts/login');
    
    // Find username input with wait
    const usernameSelectors = CONFIG.selectors.loginUsernameInput;
    let usernameInput = null;
    
    console.log('[LOGIN] Looking for username input...');
    for (const selector of usernameSelectors) {
      try {
        const input = await page.waitForSelector(selector, {
          timeout: CONFIG.browser.timeouts.normalOperation,
          state: 'visible'
        }).catch(() => null);
        
        if (input) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            usernameInput = input;
            console.log(`[LOGIN] Found username input with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // If still not found, try more generic selectors
    if (!usernameInput) {
      console.log('[LOGIN] Trying generic input selectors...');
      const genericSelectors = [
        'input[type="text"]',
        'input[autocomplete="username"]',
        'input[name="username"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="phone" i]',
        'input[placeholder*="email" i]'
      ];
      
      for (const selector of genericSelectors) {
        try {
          const inputs = await page.$$(selector);
          for (const input of inputs) {
            const isVisible = await input.isVisible().catch(() => false);
            if (isVisible) {
              // Check if it's likely a username field
              const placeholder = await input.getAttribute('placeholder').catch(() => '');
              const name = await input.getAttribute('name').catch(() => '');
              if (placeholder.toLowerCase().includes('username') || 
                  placeholder.toLowerCase().includes('phone') ||
                  placeholder.toLowerCase().includes('email') ||
                  name.toLowerCase().includes('username')) {
                usernameInput = input;
                console.log(`[LOGIN] Found username input with generic selector: ${selector}`);
                break;
              }
            }
          }
          if (usernameInput) break;
        } catch (e) {
          // Continue
        }
      }
    }
    
    if (!usernameInput) {
      // Debug: Take screenshot and log page content
      console.log('[LOGIN] Could not find username input. Debugging...');
      const pageTitle = await page.title().catch(() => 'unknown');
      console.log(`[LOGIN] Page title: ${pageTitle}`);
      
      // Log all input fields
      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          id: input.id,
          visible: input.offsetParent !== null
        }));
      }).catch(() => []);
      
      console.log(`[LOGIN] Found ${allInputs.length} input fields:`, allInputs);
      
      return {
        success: false,
        error: 'Could not find username input field. Page might have changed or requires manual login.'
      };
    }
    
    // Find password input with wait
    const passwordSelectors = CONFIG.selectors.loginPasswordInput;
    let passwordInput = null;
    
    console.log('[LOGIN] Looking for password input...');
    for (const selector of passwordSelectors) {
      try {
        const input = await page.waitForSelector(selector, {
          timeout: CONFIG.browser.timeouts.normalOperation,
          state: 'visible'
        }).catch(() => null);
        
        if (input) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            passwordInput = input;
            console.log(`[LOGIN] Found password input with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // If still not found, try generic password selector
    if (!passwordInput) {
      try {
        const input = await page.waitForSelector('input[type="password"]', {
          timeout: CONFIG.browser.timeouts.normalOperation,
          state: 'visible'
        }).catch(() => null);
        
        if (input) {
          const isVisible = await input.isVisible().catch(() => false);
          if (isVisible) {
            passwordInput = input;
            console.log('[LOGIN] Found password input with generic selector');
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!passwordInput) {
      return {
        success: false,
        error: 'Could not find password input field'
      };
    }
    
    // Fill in credentials with human-like typing
    console.log('[LOGIN] Filling in credentials...');
    await usernameInput.click();
    await delay(500);
    await usernameInput.fill(''); // Clear first
    await delay(200);
    await usernameInput.type(username, { delay: CONFIG.interactions.comment.typingSpeed });
    await delay(500);
    
    await passwordInput.click();
    await delay(500);
    await passwordInput.fill(''); // Clear first
    await delay(200);
    await passwordInput.type(password, { delay: CONFIG.interactions.comment.typingSpeed });
    await delay(1000);
    
    // Find and click submit button
    const submitSelectors = CONFIG.selectors.loginSubmitButton;
    let submitClicked = false;
    
    console.log('[LOGIN] Looking for submit button...');
    
    // Try all configured selectors
    for (const selector of submitSelectors) {
      try {
        const button = await page.waitForSelector(selector, {
          timeout: CONFIG.browser.timeouts.quickCheck,
          state: 'visible'
        }).catch(() => null);
        
        if (button) {
          const isEnabled = await button.isEnabled().catch(() => false);
          if (isEnabled) {
            await button.click();
            submitClicked = true;
            console.log(`[LOGIN] Clicked submit button with selector: ${selector}`);
            await delay(5000); // Wait for login to process
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    // If still not found, try generic button selectors
    if (!submitClicked) {
      const genericSelectors = [
        'button[type="submit"]',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("Continue")',
        'button[aria-label*="Log in" i]',
        'button[aria-label*="Login" i]',
        'button[aria-label*="Sign in" i]',
        'form button',
        'button.primary',
        'button[class*="submit"]',
        'button[class*="login"]'
      ];
      
      for (const selector of genericSelectors) {
        try {
          const buttons = await page.$$(selector);
          for (const button of buttons) {
            const isVisible = await button.isVisible().catch(() => false);
            const isEnabled = await button.isEnabled().catch(() => false);
            if (isVisible && isEnabled) {
              const text = await button.textContent().catch(() => '');
              const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
              
              // Check if button text suggests it's a login button
              const lowerText = (text + ' ' + ariaLabel).toLowerCase();
              if (lowerText.includes('log') || 
                  lowerText.includes('sign in') || 
                  lowerText.includes('continue') ||
                  lowerText.includes('submit') ||
                  selector.includes('submit')) {
                await button.click();
                submitClicked = true;
                console.log(`[LOGIN] Clicked button with selector: ${selector}, text: "${text}"`);
                await delay(5000);
                break;
              }
            }
          }
          if (submitClicked) break;
        } catch (e) {
          // Continue
        }
      }
    }
    
    // If still not found, try pressing Enter on password field
    if (!submitClicked) {
      console.log('[LOGIN] Submit button not found, trying Enter key...');
      try {
        await passwordInput.press('Enter');
        submitClicked = true;
        console.log('[LOGIN] Pressed Enter on password field');
        await delay(5000);
      } catch (e) {
        console.log('[LOGIN] Enter key press failed:', e.message);
      }
    }
    
    // Last resort: try to find any button and click it
    if (!submitClicked) {
      console.log('[LOGIN] Trying to find any clickable button...');
      try {
        const allButtons = await page.$$('button');
        console.log(`[LOGIN] Found ${allButtons.length} buttons on page`);
        
        for (const button of allButtons) {
          try {
            const isVisible = await button.isVisible().catch(() => false);
            const isEnabled = await button.isEnabled().catch(() => false);
            
            if (isVisible && isEnabled) {
              const text = await button.textContent().catch(() => '');
              const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
              const buttonType = await button.getAttribute('type').catch(() => '');
              
              console.log(`[LOGIN] Button found: text="${text}", aria-label="${ariaLabel}", type="${buttonType}"`);
              
              // Skip if it's clearly not a submit button
              const lowerText = (text + ' ' + ariaLabel).toLowerCase();
              if (lowerText.includes('cancel') || 
                  lowerText.includes('close') ||
                  lowerText.includes('back')) {
                continue;
              }
              
              // If it's a submit type or has login-related text, try clicking
              if (buttonType === 'submit' || 
                  lowerText.includes('log') ||
                  lowerText.includes('sign') ||
                  lowerText.includes('continue')) {
                await button.click();
                submitClicked = true;
                console.log(`[LOGIN] Clicked button: "${text}"`);
                await delay(5000);
                break;
              }
            }
          } catch (e) {
            // Continue to next button
          }
        }
      } catch (e) {
        console.log('[LOGIN] Error finding buttons:', e.message);
      }
    }
    
    if (!submitClicked) {
      // Debug: log all buttons on page
      const allButtonsInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map(btn => ({
          text: btn.textContent?.trim() || '',
          ariaLabel: btn.getAttribute('aria-label') || '',
          type: btn.getAttribute('type') || '',
          className: btn.className || '',
          visible: btn.offsetParent !== null,
          disabled: btn.disabled
        }));
      }).catch(() => []);
      
      console.log(`[LOGIN] All buttons on page (${allButtonsInfo.length}):`, allButtonsInfo);
      
      return {
        success: false,
        error: 'Could not find or click submit button. Please check the debug output above.'
      };
    }
    
    // Wait for navigation/redirect after login
    await delay(3000);
    
    // Check if login was successful
    const loginSuccess = await checkIfLoggedIn(page);
    
    if (loginSuccess) {
      // Save session
      const context = page.context();
      const sessionPath = getSessionPath(accountId);
      if (sessionPath) {
        await saveSession(context, sessionPath);
      }
      
      console.log('[LOGIN] Login successful!');
      return {
        success: true,
        message: 'Login successful'
      };
    } else {
      // Check for error messages
      const errorText = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('[role="alert"], .error, [class*="error"], [id*="error"]');
        for (const el of errorElements) {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            return text;
          }
        }
        return null;
      }).catch(() => null);
      
      console.log(`[LOGIN] Login failed. Error: ${errorText || 'Unknown error'}`);
      return {
        success: false,
        error: errorText || 'Login failed - could not verify login status'
      };
    }
  } catch (error) {
    console.error('[LOGIN] Error during login:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ensure user is logged in before performing interactions
 * @param {Page} page - Playwright page object
 * @param {BrowserContext} context - Browser context (for session management)
 * @param {string|null} accountId - Optional account ID for account-specific session
 * @returns {Promise<Object>} Result object
 */
export async function ensureLoggedIn(page, context, accountId = null) {
  const config = CONFIG.interactions.login;
  
  // Try to load saved session first
  const sessionPath = getSessionPath(accountId);
  if (sessionPath) {
    const sessionLoaded = await loadSession(context, sessionPath);
    if (sessionLoaded) {
      // Verify session is still valid (with shorter timeout)
      try {
        const isLoggedIn = await checkIfLoggedIn(page, false);
        if (isLoggedIn) {
          console.log('[LOGIN] Using saved session');
          return { success: true, usedSavedSession: true };
        } else {
          console.log('[LOGIN] Saved session expired, need to login again');
        }
      } catch (error) {
        // If check fails due to timeout, try to use session anyway if we have cookies
        console.log('[LOGIN] Login check failed, but session loaded. Will attempt to use session.');
        // Continue to try using the session - if it doesn't work, will auto-login
      }
    }
  }
  
  // Get credentials from config (supports multi-account)
  let credentials = null;
  if (accountId) {
    credentials = getAccountCredentials(accountId);
  } else {
    // Try to get from login config (backward compatibility)
    if (config.username && config.password) {
      credentials = {
        username: config.username,
        password: config.password
      };
    }
  }
  
  // If credentials are available and auto-login is enabled
  if (config.autoLogin && credentials && credentials.username && credentials.password) {
    console.log(`[LOGIN] Auto-login enabled, attempting login... (account: ${accountId || 'default'})`);
    const loginResult = await loginToThreads(
      page, 
      credentials.username, 
      credentials.password, 
      accountId
    );
    return loginResult;
  }
  
  // Check if already logged in (maybe manually logged in)
  // Skip navigation check if we're already on a post page
  const currentUrl = page.url();
  const skipNav = currentUrl.includes('threads') && currentUrl.includes('post');
  const isLoggedIn = await checkIfLoggedIn(page, skipNav);
  if (isLoggedIn) {
    return { success: true, alreadyLoggedIn: true };
  }
  
  // No credentials found
  if (!credentials) {
    return {
      success: false,
      error: `No credentials found in config for account: ${accountId || 'default'}. Please login via POST /api/login or add credentials to CONFIG.interactions.accounts`
    };
  }
  
  return {
    success: false,
    error: 'Not logged in. Please login manually via POST /api/login'
  };
}

/**
 * Threads Feed Extractor Configuration
 * 
 * Centralized configuration for all extractor settings
 */

export const CONFIG = {
  // URL và Endpoints
  threads: {
    url: 'https://www.threads.net',
    graphqlEndpointPatterns: [
      '/api/graphql',
      '/graphql',
      '/web/graphql'
    ],
    feedQueryPatterns: [
      'HomeContentQuery',
      'BarcelonaHomeContentQuery',
      'FeedQuery',
      'TimelineQuery'
    ]
  },

  // Browser Settings
  browser: {
    headless: false, // Set true để chạy ẩn browser (faster, less visible)
    args: [
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-gpu',                    // Fix GPU issues in WSL
      '--disable-software-rasterizer',    // Fix GPU fallback issues
      '--disable-setuid-sandbox',         // Additional sandbox fix for WSL
      '--single-process',                 // May help with stability in WSL
      '--no-zygote'                       // Fix for some WSL environments
    ],
    channel: null, // 'chrome' hoặc null (null = dùng bundled Chromium) - dùng null cho WSL
    navigationTimeout: 60000, // Timeout khi navigate (ms) - increased for slower connections
    waitForSelectorTimeout: 5000, // Timeout khi chờ selector (ms)
    waitAfterNavigation: 2000, // Đợi sau khi navigate (ms)
    waitAfterScroll: 2000, // Đợi sau khi scroll xong (ms)
    // Persistent profile settings
    persistentProfile: {
      enabled: false, // Tắt persistent profile mặc định - chỉ dùng khi client chỉ định rõ profile_path
      requireExplicitPath: true // Yêu cầu client phải chỉ định path rõ ràng
    },
    // Timeout categories for different operations
    timeouts: {
      navigation: 60000,        // Navigation timeout (page.goto, page.reload)
      selector: 5000,            // Wait for selector timeout (default)
      quickCheck: 2000,         // Quick element checks (fast operations)
      normalOperation: 5000,    // Normal operations (click, submit, etc.)
      longOperation: 10000,      // Long operations (reload, complex operations)
      sessionCheck: 15000,       // Session validation timeout
      feedExtraction: 300000,    // For feed extraction operations (5 minutes)
      interaction: 120000        // For interaction operations (2 minutes)
    }
  },

  // DOM Selectors (ordered by reliability)
  // FRAGILE: Các selectors này có thể break nếu Threads update UI
  selectors: {
    feed: [
      '[data-testid*="post"]',
      '[data-testid*="thread"]',
      'article[role="article"]',
      'div[role="article"]',
      'article',
      // Threads-specific selectors
      'div[dir="ltr"]', // Threads uses dir="ltr" for posts
      'div[class*="thread"]',
      'div[class*="post"]'
    ],
    // Interaction selectors (for like/comment features)
    likeButton: [
      'button[aria-label*="Like"]',
      'button[aria-label*="like"]',
      '[data-testid*="like"]',
      'button:has-text("Like")',
      'svg[aria-label*="Like"]',
      'button[aria-label*="heart"]'
    ],
    unlikeButton: [
      'button[aria-label*="Unlike"]',
      'button[aria-label*="unlike"]',
      'button[aria-label*="Liked"]',
      'svg[aria-label*="Unlike"]',
      'button[aria-label*="heart"][aria-pressed="true"]'
    ],
    commentButton: [
      'button[aria-label*="Reply"]',
      'button[aria-label*="Comment"]',
      '[data-testid*="comment"]',
      '[data-testid*="reply"]',
      'button:has-text("Reply")',
      'svg[aria-label*="Reply"]'
    ],
    commentInput: [
      'textarea[placeholder*="Reply"]',
      'textarea[placeholder*="Add a comment"]',
      '[data-testid*="comment-input"]',
      'textarea[aria-label*="Reply"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[aria-label*="comment"]'
    ],
    commentSubmit: [
      'button[type="submit"]',
      'button:has-text("Post")',
      '[data-testid*="submit"]',
      'button[aria-label*="Post"]',
      'button:has-text("Reply")'
    ],
    // Login selectors
    loginButton: [
      'button:has-text("Log in")',
      'button[type="submit"]:has-text("Log in")',
      'a[href*="login"]',
      'button[aria-label*="Log in"]'
    ],
    loginUsernameInput: [
      'input[name="username"]',
      'input[type="text"][placeholder*="username"]',
      'input[placeholder*="Phone number"]',
      'input[aria-label*="username"]',
      'input[aria-label*="Phone"]'
    ],
    loginPasswordInput: [
      'input[name="password"]',
      'input[type="password"]',
      'input[aria-label*="Password"]'
    ],
    loginSubmitButton: [
      'button[type="submit"]:has-text("Log in")',
      'button:has-text("Log in")',
      'button[type="submit"]'
    ],
    // Repost selectors
    repostButton: [
      'button[aria-label*="Repost"]',
      'button[aria-label*="repost"]',
      'svg[aria-label*="Repost"]',
      'button[aria-label*="Repost" i]',
      '[data-testid*="repost"]'
    ],
    repostModalButton: [
      'button:has-text("Repost")',
      'button[aria-label*="Repost"]:not([aria-label*="Quote"])',
      'div[role="dialog"] button:has-text("Repost")',
      'div[role="menu"] button:has-text("Repost")',
      '[data-testid*="repost"] button'
    ],
    quoteModalButton: [
      'button:has-text("Quote")',
      'button[aria-label*="Quote"]',
      'div[role="dialog"] button:has-text("Quote")',
      'div[role="menu"] button:has-text("Quote")',
      '[data-testid*="quote"] button'
    ],
    unrepostButton: [
      'button:has-text("Remove")',
      'button[aria-label*="Remove"]',
      'button[aria-label*="remove"]',
      'button:has-text("Unrepost")',
      'button[aria-label*="Unrepost"]',
      'button[aria-label*="unrepost"]',
      'button[aria-label*="Reposted"]',
      'button[aria-label*="reposted"]',
      'svg[aria-label*="Reposted"]',
      'svg[aria-label*="reposted"]',
      'svg[aria-label*="Unrepost"]',
      'button[aria-label*="Repost"][aria-label*="Repost"]', // Sometimes "Repost" button becomes "Repost" when already reposted
      '[data-testid*="unrepost"]',
      '[data-testid*="reposted"]',
      '[data-testid*="remove"]',
      'button:has-text("Reposted")'
    ],
    quoteButton: [
      'button[aria-label*="Quote"]',
      'button[aria-label*="quote"]',
      'button:has-text("Quote")'
    ],
    quoteInput: [
      'textarea[placeholder*="Add a comment"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="Quote"]'
    ],
    // Share selectors
    shareButton: [
      'button[aria-label*="Share"]',
      'button[aria-label*="share"]',
      'svg[aria-label*="Share"]',
      '[data-testid*="share"]'
    ],
    // Follow selectors
    followButton: [
      'button:has-text("Follow")',
      'button[aria-label*="Follow"]',
      'button[aria-label*="follow"]'
    ],
    unfollowButton: [
      'button:has-text("Following")',
      'button[aria-label*="Unfollow"]',
      'button[aria-label*="Following"]'
    ],
    unfollowConfirmButton: [
      'button:has-text("Unfollow")',
      'button:has-text("Confirm")',
      'button[aria-label*="Unfollow"]',
      'button[aria-label*="Confirm"]',
      'div[role="dialog"] button:has-text("Unfollow")',
      'div[role="dialog"] button:has-text("Confirm")'
    ]
  },

  // Scrolling Configuration (Human-like behavior)
  scroll: {
    delayMinMs: 800, // Delay tối thiểu giữa các lần scroll
    delayMaxMs: 2000, // Delay tối đa giữa các lần scroll
    incrementPx: 300, // Số pixel scroll mỗi lần
    maxAttempts: 10, // Số lần scroll tối đa
    pauseBetweenScrollsMs: 1000 // Pause giữa các lần scroll
  },

  // Window Globals để check preloaded data
  // STABLE: Các patterns này ít thay đổi hơn DOM selectors
  windowGlobals: [
    '__relayStore',
    '__INITIAL_DATA__',
    '__RELAY_STORE__',
    'window.__relayStore',
    'window.__INITIAL_DATA__'
  ],

  // Output Configuration
  output: {
    dir: 'output',
    filename: 'threads_feed.json',
    filenameFiltered: 'threads_feed_filtered.json'
  },

  // Filter Criteria (có thể customize)
  // ============================================================================
  // CÁCH SỬ DỤNG:
  // 1. Xóa dấu // ở đầu dòng để bật filter đó
  // 2. Thay đổi giá trị theo nhu cầu
  // 3. Có thể kết hợp nhiều filter cùng lúc
  // 
  // VÍ DỤ:
  //   min_likes: 10,        // Chỉ lấy posts có >= 10 likes
  //   has_media: true,       // VÀ có media
  //   username: 'newscientist' // VÀ từ username này
  // ============================================================================
  filter: {
    // Filter theo số lượng likes
     min_likes: 200,        // Chỉ lấy posts có >= 10 likes
    // max_likes: 1000,      // Chỉ lấy posts có <= 1000 likes
    
    // Filter theo số lượng replies/reposts
    // min_replies: 5,       // Chỉ lấy posts có >= 5 replies
    // min_reposts: 2,       // Chỉ lấy posts có >= 2 reposts
    
    // Filter theo media
    // has_media: true,      // Chỉ lấy posts có media (images/videos)
    
    // Filter theo username
    // username: 'newscientist', // Chỉ lấy posts từ username này (exact match)
    
    // Filter theo nội dung text
    // text_contains: 'NASA', // Chỉ lấy posts có chứa text này (case-insensitive)
    
    // Filter theo thời gian (Unix timestamp - seconds)
    // after_timestamp: 1704067200,  // Chỉ lấy posts sau thời điểm này (ví dụ: 2024-01-01)
    // before_timestamp: 1735689600  // Chỉ lấy posts trước thời điểm này (ví dụ: 2025-01-01)
    
    // VÍ DỤ: Filter posts có >= 50 likes và có media
    // min_likes: 50,
    // has_media: true
  },

  // Extraction Settings
  extraction: {
    maxItems: null, // null = không giới hạn, hoặc set số tối đa items
    enableDebugLogging: false, // Set true để bật debug logs chi tiết
    extractMediaUrls: true, // Extract media URLs từ posts
    extractTimestamps: true // Extract timestamps từ posts
  },

  // API Server Configuration
  api: {
    port: 3000,
    host: '0.0.0.0',
    cache: {
      ttl: 5 * 60 * 1000, // 5 minutes in ms
      enabled: true
    },
    cors: {
      enabled: true,
      origin: '*' // hoặc specific origins như 'http://localhost:3001'
    },
    // API Request Timeout Configuration
    timeout: {
      default: 300000,        // 5 minutes default timeout for API requests
      feedExtraction: 300000, // 5 minutes for feed extraction operations
      quickOperation: 30000,  // 30 seconds for quick operations (health, stats, config)
      interaction: 120000,    // 2 minutes for interaction operations (like, comment, etc.)
      bulkOperation: 600000   // 10 minutes for bulk operations (bulk login, etc.)
    },
    // Account ID extraction configuration
    accountId: {
      // Enable JWT token parsing (optional)
      parseJWT: false, // Set to true to enable JWT parsing
      jwtSecret: process.env.JWT_SECRET || null, // Required if parseJWT is true
      
      // Custom header names to check (optional)
      customHeaders: [
        // 'X-Custom-Account-ID',
        // 'Account-Identifier'
      ],
      
      // Logging for debugging (optional)
      logExtraction: false // Set to true to log where account_id was found
    }
  },

  // Interactions Configuration (EXPERIMENTAL - Violates read-only principle)
  // ⚠️ WARNING: Enabling this feature violates the read-only principle of this tool
  // Use at your own risk. May result in account restrictions or bans.
  interactions: {
    enabled: true, // Mặc định tắt để tránh vi phạm read-only
    // Multiple accounts support
    // Account ID as key, credentials as value
    accounts: {
      // Example:
      // 'user1': {
      //   username: process.env.THREADS_USERNAME_user1 || null,
      //   password: process.env.THREADS_PASSWORD_user1 || null
      // },
      // 'user2': {
      //   username: process.env.THREADS_USERNAME_user2 || null,
      //   password: process.env.THREADS_PASSWORD_user2 || null
      // }
    },
    // Backward compatibility: single account (deprecated, use accounts object instead)
    login: {
      username: process.env.THREADS_USERNAME || '', // Username or email
      password: process.env.THREADS_PASSWORD || '', // Password
      sessionStoragePath: 'output/threads_session.json', // Path to save session cookies
      autoLogin: true, // Tự động login nếu chưa login
      loginTimeout: 60000 // Timeout cho login process (ms)
    },
    like: {
      delayBeforeClick: 500, // Delay trước khi click like (ms)
      delayAfterClick: 1000, // Delay sau khi click (ms)
      retryAttempts: 3 // Số lần thử lại nếu fail
    },
    comment: {
      delayBeforeType: 500, // Delay trước khi gõ comment (ms)
      typingSpeed: 50, // Tốc độ gõ (ms per character)
      delayAfterSubmit: 2000, // Delay sau khi submit (ms)
      retryAttempts: 3 // Số lần thử lại nếu fail
    },
    repost: {
      delayBeforeClick: 500, // Delay trước khi click repost (ms)
      delayAfterClick: 1000, // Delay sau khi click (ms)
      retryAttempts: 3 // Số lần thử lại nếu fail
    },
    share: {
      delayBeforeClick: 500, // Delay trước khi click share (ms)
      delayAfterClick: 1000, // Delay sau khi click (ms)
      retryAttempts: 3 // Số lần thử lại nếu fail
    },
    follow: {
      delayBeforeClick: 500, // Delay trước khi click follow (ms)
      delayAfterClick: 1000, // Delay sau khi click (ms)
      retryAttempts: 3 // Số lần thử lại nếu fail
    },
    // Feed Browsing and Commenting Configuration
    feedBrowsing: {
      maxPostsToComment: 5, // Số posts tối đa để comment (null = tất cả posts đã lọc)
      randomSelection: true, // Chọn posts ngẫu nhiên (true) hoặc theo thứ tự (false)
      commentDelayMin: 5000, // Delay tối thiểu giữa các comments (ms)
      commentDelayMax: 15000, // Delay tối đa giữa các comments (ms)
      // Comment templates - có thể dùng {username}, {@username}, {postText}
      commentTemplates: [
        'Nice post! 👍',
        'Great content!',
        'Love this! ❤️',
        'Amazing! 🔥',
        'Thanks for sharing!',
        'This is awesome!',
        'Really interesting!',
        'Well said! 👏'
      ],
      // Filter criteria mặc định cho posts (có thể override khi gọi hàm)
      filterCriteria: {
        // min_likes: 10, // Chỉ comment trên posts có >= 10 likes
        // has_media: true, // Chỉ comment trên posts có media
        // min_replies: 5, // Chỉ comment trên posts có >= 5 replies
        // Có thể thêm các filter khác theo nhu cầu
      }
    }
  }
};

/**
 * Get session path for a specific account
 * @param {string|null} accountId - Account ID (null for default/fallback)
 * @returns {string} Session file path
 */
/**
 * Normalize username to account ID
 * Removes @ prefix and special characters, keeps alphanumeric, underscore, hyphen
 * @param {string} username - Username to normalize
 * @returns {string} Normalized account ID
 */
export function normalizeAccountId(username) {
  if (!username || typeof username !== 'string') {
    return null;
  }
  // Remove @ prefix, replace special chars with underscore, keep alphanumeric, underscore, hyphen
  return username
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
}

/**
 * Find account ID in config by username
 * Searches in both accounts object and login (for backward compatibility)
 * @param {string} username - Username to search for
 * @returns {string|null} Account ID if found, null otherwise
 */
export function findAccountByUsername(username) {
  if (!username || typeof username !== 'string') {
    return null;
  }
  
  const normalizedUsername = username.toLowerCase().trim();
  
  // Search in accounts object
  if (CONFIG.interactions.accounts) {
    for (const [accountId, accountConfig] of Object.entries(CONFIG.interactions.accounts)) {
      if (accountConfig && accountConfig.username) {
        const configUsername = accountConfig.username.toLowerCase().trim();
        if (configUsername === normalizedUsername) {
          return accountId;
        }
      }
    }
  }
  
  // Search in login (backward compatibility)
  if (CONFIG.interactions.login && CONFIG.interactions.login.username) {
    const loginUsername = CONFIG.interactions.login.username.toLowerCase().trim();
    if (loginUsername === normalizedUsername) {
      // Return normalized username as account ID for backward compatibility
      return normalizeAccountId(username);
    }
  }
  
  return null;
}

/**
 * Get account credentials from config
 * First checks accounts object, then falls back to login (backward compatibility)
 * @param {string|null} accountId - Account ID
 * @returns {Object|null} Credentials object with username and password, or null
 */
export function getAccountCredentials(accountId) {
  if (!accountId) {
    // Fallback to login config (backward compatibility)
    if (CONFIG.interactions.login && CONFIG.interactions.login.username && CONFIG.interactions.login.password) {
      return {
        username: CONFIG.interactions.login.username,
        password: CONFIG.interactions.login.password
      };
    }
    return null;
  }
  
  // Check accounts object first
  if (CONFIG.interactions.accounts && CONFIG.interactions.accounts[accountId]) {
    const account = CONFIG.interactions.accounts[accountId];
    if (account.username && account.password) {
      return {
        username: account.username,
        password: account.password
      };
    }
  }
  
  // Fallback to login config (backward compatibility)
  if (CONFIG.interactions.login && CONFIG.interactions.login.username && CONFIG.interactions.login.password) {
    // Only use login config if accountId matches normalized login username
    const normalizedLoginUsername = normalizeAccountId(CONFIG.interactions.login.username);
    if (accountId === normalizedLoginUsername) {
      return {
        username: CONFIG.interactions.login.username,
        password: CONFIG.interactions.login.password
      };
    }
  }
  
  return null;
}

/**
 * Get session path for a specific account
 * @param {string|null} accountId - Account ID (null for default/fallback)
 * @returns {string} Session file path
 */
export function getSessionPath(accountId) {
  if (accountId) {
    return `./profile_threads/${accountId}/threads_session.json`;
  }
  // Fallback to default path for backward compatibility
  return CONFIG.interactions.login.sessionStoragePath || 'output/threads_session.json';
}

/**
 * Get profile directory path for a specific account
 * @param {string|null} accountId - Account ID (null for default/fallback)
 * @param {string|null} customProfilePath - Custom profile path provided by client (optional)
 * @returns {string|null} Profile directory path, or null for temporary context
 */
export function getProfilePath(accountId, customProfilePath = null) {
  // Nếu client cung cấp custom path, sử dụng nó (ưu tiên cao nhất)
  if (customProfilePath) {
    return customProfilePath;
  }
  
  // Nếu persistent profile bị tắt hoặc yêu cầu explicit path, không tạo profile tự động
  if (!CONFIG.browser.persistentProfile.enabled || CONFIG.browser.persistentProfile.requireExplicitPath) {
    return null;
  }
  
  // Fallback: chỉ tạo profile path nếu accountId được cung cấp và persistent profile được enable
  // (backward compatibility - nhưng mặc định sẽ không chạy vào đây vì enabled = false)
  if (accountId) {
    return `./profile_threads/${accountId}`;
  }
  
  // Return null to indicate no persistent profile (use temporary context)
  return null;
}

/**
 * Validate and normalize base directory path
 * @param {string} baseDir - Base directory path
 * @returns {string|null} Normalized path or null if invalid
 */
export function validateBaseDirectory(baseDir) {
  if (!baseDir || typeof baseDir !== 'string') {
    return null;
  }
  
  const trimmed = baseDir.trim();
  if (trimmed.length === 0) {
    return null;
  }
  
  // Reject dangerous paths (path traversal attacks)
  if (trimmed.includes('..') || trimmed.includes('//')) {
    return null;
  }
  
  // Reject paths that are too long
  if (trimmed.length > 500) {
    return null;
  }
  
  // Normalize path (remove trailing slashes)
  return trimmed.replace(/\/+$/, '');
}

/**
 * Create profile path from base directory and profile_id
 * @param {string} baseDirectory - Base directory path
 * @param {string} profileId - Profile ID (account_id or username)
 * @returns {string} Full profile path
 */
export function createProfilePath(baseDirectory, profileId) {
  const normalizedBase = validateBaseDirectory(baseDirectory);
  if (!normalizedBase) {
    throw new Error('Invalid base directory');
  }
  
  // Validate profile_id format
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('Profile ID is required');
  }
  
  // Basic validation: alphanumeric, underscore, hyphen
  const profileIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!profileIdPattern.test(profileId)) {
    throw new Error(`Invalid profile ID format: ${profileId}`);
  }
  
  // Combine base directory and profile_id
  return `${normalizedBase}/${profileId}`;
}

/**
 * Extract base directory from request
 * @param {Object} req - Express request object
 * @returns {string|null} Base directory path or null if not found
 */
export function extractBaseDirectory(req) {
  // Try query parameter first
  if (req.query?.base_directory) {
    return validateBaseDirectory(req.query.base_directory);
  }
  
  // Try request body
  if (req.body?.base_directory) {
    return validateBaseDirectory(req.body.base_directory);
  }
  
  // Try header
  const headerNames = ['x-base-directory', 'X-Base-Directory', 'base-directory', 'Base-Directory'];
  for (const headerName of headerNames) {
    const value = req.headers[headerName.toLowerCase()] || req.headers[headerName];
    if (value) {
      return validateBaseDirectory(value);
    }
  }
  
  return null;
}

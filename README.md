# Qrtools - Threads Feed Extraction Tools

Bộ công cụ để nghiên cứu và trích xuất dữ liệu từ Threads (Meta) một cách an toàn, chỉ đọc (read-only).

## 📋 Tổng quan

Qrtools bao gồm 3 công cụ chính:

1. **Threads HTML Parser** (Python) - Parse HTML files từ Threads và extract tất cả dữ liệu có thể
2. **Threads Feed Extractor** (Node.js) - Extract live feed data từ Threads web bằng Playwright
3. **Threads Feed API Server** (Node.js) - REST API server để expose extraction functionality

## ✨ Danh sách tính năng

### 🔧 Công cụ chính

- **Threads HTML Parser (Python)**
  - Parse HTML files từ Threads và extract tất cả dữ liệu có thể
  - Xuất dữ liệu ra JSON và CSV
  - Extract posts, users, GraphQL queries, metadata
  - Hỗ trợ parse file HTML tùy chỉnh

- **Threads Feed Extractor (CLI - Node.js)**
  - Extract live feed data từ Threads web bằng Playwright
  - Hỗ trợ extract home feed và user profile posts
  - Tự động scroll và load thêm content
  - Multi-strategy extraction (GraphQL, Relay, DOM)
  - Data normalization và filtering
  - Export ra JSON format

- **Threads Feed API Server (REST API)**
  - REST API server để expose extraction functionality
  - Modular architecture với routes tách biệt
  - CORS support
  - Request logging middleware
  - Health check và stats endpoints

### 📊 Trích xuất dữ liệu

- **Multi-strategy Extraction**
  - GraphQL Interception (Most Reliable) - Intercept network requests
  - Relay Store (Fallback) - Read từ window.__relayStore
  - DOM Parsing (Last Resort) - Parse rendered HTML
  - Tự động fallback giữa các strategies

- **Data Extraction**
  - Extract posts với đầy đủ metadata (likes, replies, reposts, shares)
  - Extract user information (username, display name, avatar, verified status)
  - Extract media URLs (images, videos)
  - Extract timestamps (Unix và ISO 8601)
  - Extract hashtags, mentions, links
  - Extract thread relationships (replies, quoted posts)
  - Extract view counts (nếu có)

- **Feed Loading Analysis**
  - Tự động phân tích feed loading strategy
  - Hỗ trợ SSR-preloaded data
  - Hỗ trợ GraphQL API data
  - Hỗ trợ Relay Store data

- **Shortcode Encoding**
  - Tự động encode post_id thành shortcode (base64url)
  - Generate post URLs từ post_id
  - Research tools cho shortcode encoding

### 🔍 Lọc và tìm kiếm

- **Post Filtering**
  - Filter theo số lượng likes (min/max)
  - Filter theo số lượng replies, reposts, shares
  - Filter theo có media hay không
  - Filter theo username (exact match)
  - Filter theo text content (contains)
  - Filter theo timestamp (after/before)
  - Limit số lượng items

- **User Posts Extraction**
  - Extract posts từ profile của user cụ thể
  - Hỗ trợ filter criteria giống như home feed
  - Cache riêng cho từng user

### 💾 Cache và Performance

- **Caching System**
  - Memory cache với TTL (default 5 phút)
  - Cache key dựa trên filter criteria
  - Cache riêng cho home feed và user posts
  - Tự động invalidation sau TTL
  - Manual cache clearing
  - Cache stats và monitoring

- **Performance Optimization**
  - Connection pooling
  - Batch requests support
  - Retry logic với exponential backoff
  - Circuit breaker pattern support

### 🔐 Session Management

- **Session Handling**
  - Tự động lưu session cookies
  - Tự động load session từ file
  - Auto-login nếu session hết hạn
  - Manual login support
  - Session persistence trong file JSON

- **Multi-Account Support (Account ID Extraction)**
  - Hỗ trợ nhiều tài khoản với session riêng biệt
  - Account ID có thể được truyền qua query params, body, hoặc headers
  - Session được lưu riêng cho từng account trong `profile_threads/{accountId}/`
  - Hỗ trợ JWT token parsing (optional)
  - Custom headers support
  - Tự động fallback về default session nếu không có account ID

### ⚠️ EXPERIMENTAL: Post Interactions

- **Like/Unlike Posts**
  - Like một post
  - Unlike một post đã like
  - Check trạng thái like

- **Comment on Posts**
  - Comment trên một post
  - Hỗ trợ custom comment text
  - Typing speed simulation
  - Retry logic với error handling

- **Repost/Quote Posts**
  - Repost một post
  - Quote một post với comment
  - Unrepost một post đã repost
  - Check trạng thái repost

- **Share Posts**
  - Share post (copy link)
  - Mở share menu
  - Hỗ trợ multiple platforms

### ⚠️ EXPERIMENTAL: User Interactions

- **Follow/Unfollow Users**
  - Follow một user
  - Unfollow một user đã follow
  - Check trạng thái follow

### ⚠️ EXPERIMENTAL: Feed Browsing và Automated Commenting

- **Feed Browsing và Commenting**
  - Duyệt feed và lọc posts theo tiêu chí
  - Tự động comment trên các posts đã lọc
  - Random selection hoặc sequential selection
  - Configurable comment templates với variables
  - Random delays giữa các comments     
  - Error handling cho từng comment attempt

- **User Selection và Commenting**
  - Chọn user từ feed (random hoặc specific)
  - Extract danh sách users từ feed
  - Comment trên các posts của user được chọn
  - Filter posts của user trước khi comment

### 🌐 API Endpoints

- **Feed Endpoints**
  - `GET /api/feed` - Lấy feed items với filtering
  - `GET /api/feed/:postId` - Lấy một post cụ thể
  - `POST /api/feed/refresh` - Force refresh feed
  - `GET /api/user/:username/posts` - Lấy posts từ user

- **Cache Management Endpoints**
  - `DELETE /api/cache` - Xóa cache (tất cả hoặc theo user)
  - `GET /api/health` - Health check
  - `GET /api/stats` - Thống kê về feed và cache
  - `GET /api/config` - Xem cấu hình hiện tại

- **Post Interaction Endpoints** (Experimental)
  - `POST /api/post/:postId/like` - Like post
  - `DELETE /api/post/:postId/like` - Unlike post
  - `POST /api/post/:postId/comment` - Comment trên post
  - `GET /api/post/:postId/interactions` - Check interaction status
  - `POST /api/post/:postId/repost` - Repost post
  - `POST /api/post/:postId/quote` - Quote post
  - `DELETE /api/post/:postId/repost` - Unrepost
  - `GET /api/post/:postId/repost-status` - Check repost status
  - `POST /api/post/:postId/share` - Share post
  - `POST /api/posts/bulk-like` - Like hàng loạt nhiều posts
  - `POST /api/posts/bulk-comment` - Comment hàng loạt trên nhiều posts

- **User Interaction Endpoints** (Experimental)
  - `POST /api/user/:username/follow` - Follow user
  - `DELETE /api/user/:username/follow` - Unfollow user
  - `GET /api/user/:username/follow-status` - Check follow status

- **Feed Browsing Endpoints** (Experimental)
  - `POST /api/feed/browse-and-comment` - Duyệt feed và comment
  - `POST /api/feed/select-user-and-comment` - Chọn user và comment

- **Authentication Endpoints** (Experimental)
  - `POST /api/login` - Login vào Threads

### 🛠️ Data Processing

- **Data Normalization**
  - Normalize post data về format chuẩn
  - Normalize user data
  - Normalize media data
  - Normalize text content (hashtags, mentions, links)
  - Timestamp conversion (Unix ↔ ISO 8601)

- **Data Export**
  - Export ra JSON format
  - Export ra CSV format (Python parser)
  - Custom output file paths
  - Filtered output files

### 🎯 Error Handling

- **Error Handling Features**
  - Retry logic với exponential backoff
  - Structured logging (DEBUG, INFO, WARN, ERROR)
  - Input validation
  - Error classification (SessionExpired, ElementNotFound, RateLimit, TimeoutError, etc.)
  - Error recovery (re-login, retry với selectors khác)
  - Comprehensive timeout handling với fail-fast strategy
  - Clear timeout error messages với context (operation, timeout value, elapsed time)

### 🔧 Configuration

- **Centralized Configuration**
  - Tất cả config trong một file (`src/config.js`)
  - Environment variables support
  - Browser settings (headless, timeouts)
  - API timeout configuration (per operation type)
  - Scrolling behavior configuration
  - Extraction settings
  - Filter criteria
  - API settings (port, host, cache, CORS, timeout)
  - Output settings
  - Interactions settings (nếu enabled)

### 📚 Integration Support

- **Integration Patterns**
  - Python wrapper examples (FastAPI, Flask)
  - JavaScript/Node.js examples (Express, Next.js)
  - Direct import support (Node.js)
  - Subprocess wrapper (Python)
  - Error handling và retry patterns
  - Caching strategies (Redis, in-memory)
  - Performance optimization examples

### 📖 Documentation

- **Documentation Features**
  - Comprehensive README với examples
  - API documentation (docs/API.md)
  - Code examples cho mọi tính năng
  - Troubleshooting guide
  - Architecture documentation
  - Fragility analysis

### 🔒 Security và Ethics

- **Read-only Principle**
  - Chỉ đọc dữ liệu (read-only)
  - Không bypass authentication
  - Không replay GraphQL APIs manually
  - Không hardcode tokens/cookies
  - Chỉ simulate hành vi người dùng thật
  - Interactions features mặc định TẮT và có cảnh báo rõ ràng

## ⚠️ Lưu ý quan trọng

**Đây là công cụ nghiên cứu và học tập:**
- ✅ Chỉ đọc dữ liệu (read-only)
- ✅ Không bypass authentication
- ✅ Không replay GraphQL APIs manually
- ✅ Không hardcode tokens/cookies
- ✅ Không tự động hóa likes/posts/follows
- ✅ Chỉ simulate hành vi người dùng thật trong browser

## 🚀 Cài đặt nhanh

### Yêu cầu hệ thống

- **Python 3.6+** (cho HTML Parser)
- **Node.js 18+** (cho Feed Extractor và API Server)
- **Playwright browsers** (tự động cài khi chạy lần đầu)

### Cài đặt

```bash
# Clone hoặc download project
cd qrtools

# Cài đặt Python dependencies
python3 -m venv venv
source venv/bin/activate  # Linux/Mac/WSL
pip install -r requirements.txt

# Cài đặt Node.js dependencies
npm install

# Cài đặt Playwright browsers
npx playwright install chromium
```

Hoặc sử dụng setup script:

```bash
chmod +x setup.sh
bash setup.sh
```

---

## 📦 Cấu trúc dự án

```
qrtools/
├── threads_parser.py          # Python HTML parser
├── threads_feed_extractor.js  # Main entry point (backward compatible)
├── api_server.js              # REST API server (main entry point)
│
├── src/                       # Modular source code
│   ├── cli.js                 # CLI entry point
│   ├── extractor.js           # Main extraction orchestrator
│   ├── config.js              # Centralized configuration
│   │
│   ├── api/                    # API server modules
│   │   ├── middleware.js      # CORS and request logging
│   │   ├── utils/             # API utilities
│   │   │   ├── cache-utils.js # Cache management
│   │   │   └── query-parser.js # Query parameter parsing
│   │   └── routes/            # API route handlers
│   │       ├── feed-routes.js # Feed endpoints
│   │       ├── cache-routes.js # Cache/health/stats/config endpoints
│   │       ├── post-interaction-routes.js # Post interaction endpoints
│   │       ├── user-interaction-routes.js # User interaction endpoints
│   │       └── feed-browsing-routes.js # Feed browsing and commenting endpoints
│   │
│   ├── browser/               # Browser management
│   │   ├── browser-manager.js
│   │   ├── scrolling.js
│   │   └── feed-helpers.js
│   │
│   ├── network/               # Network interception
│   │   └── graphql-interceptor.js
│   │
│   ├── extractors/            # Extraction strategies
│   │   ├── graphql-extractor.js
│   │   ├── relay-extractor.js
│   │   ├── dom-extractor.js
│   │   └── index.js
│   │
│   ├── interactions/          # Post and user interactions (experimental)
│   │   ├── session.js         # Session management
│   │   ├── post-helpers.js    # Post interaction helpers
│   │   ├── user-helpers.js    # User interaction helpers
│   │   ├── like.js            # Like/unlike functionality
│   │   ├── comment.js         # Comment functionality
│   │   ├── repost.js          # Repost/quote functionality
│   │   ├── share.js           # Share functionality
│   │   ├── follow.js          # Follow functionality
│   │   ├── unfollow.js        # Unfollow functionality
│   │   ├── post-status.js    # Post interaction status
│   │   ├── user-status.js    # User follow status
│   │   ├── feed-browsing.js    # Feed browsing and commenting
│   │   ├── user-selection.js  # User selection and commenting
│   │   ├── post-interactions.js # Post interactions index (re-exports)
│   │   └── user-interactions.js # User interactions index (re-exports)
│   │
│   ├── normalizers/           # Data normalization
│   │   ├── post-normalizer.js
│   │   ├── user-normalizer.js
│   │   ├── media-normalizer.js
│   │   ├── text-normalizer.js
│   │   └── index.js
│   │
│   ├── filters/               # Post filtering
│   │   └── post-filter.js
│   │
│   └── utils/                 # Utilities
│       ├── file-utils.js
│       ├── shortcode-encoder.js
│       ├── shortcode-research.js
│       └── shortcode-browser-inspector.js
│
├── examples/                  # Example scripts
│   ├── interact-example.js    # Post interaction examples
│   └── feed-browsing-example.js # Feed browsing and commenting examples
│
├── scripts/                   # Utility scripts
│   └── test-encoding.js       # Test shortcode encoding
│
├── output/                    # Output files (auto-created)
│   ├── threads_feed.json
│   ├── threads_feed_filtered.json
│   └── threads_session.json  # Saved session (if interactions enabled, default account)
│
├── profile_threads/          # Multi-account session storage (auto-created)
│   └── {accountId}/          # Per-account directory
│       └── threads_session.json  # Account-specific session
│
├── requirements.txt           # Python dependencies
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

---

## 🛠️ Sử dụng

### 1. Threads HTML Parser (Python)

Parse HTML files từ Threads và extract tất cả dữ liệu có thể.

#### Cách sử dụng

```bash
# Activate virtual environment
source venv/bin/activate

# Parse file mặc định (t.txt)
python3 threads_parser.py

# Parse file khác
python3 threads_parser.py path/to/file.html
```

#### Output

Tạo thư mục `output/` với các files:
- `posts.json` / `posts.csv` - Danh sách posts
- `users.json` / `users.csv` - Danh sách users
- `graphql_queries.json` / `graphql_queries.txt` - GraphQL queries
- `metadata.json` - Feature flags, config, metadata

#### Cấu trúc dữ liệu

**Posts:**
```json
{
  "id": "post_id",
  "text": "post content",
  "author_id": "user_id",
  "author_username": "username",
  "timestamp": "timestamp",
  "likes": 123,
  "comments": 45,
  "reposts": 67,
  "shares": 10
}
```

---

### 2. Threads Feed Extractor (CLI)

Extract live feed data từ Threads web.

#### Cách sử dụng

```bash
# Sử dụng CLI entry point (khuyến nghị)
npm run cli

# Hoặc sử dụng entry point cũ (backward compatible)
npm start
```

#### Output Format

Feed items được normalize về format:

```json
{
  "post_id": "3817952812169631580",
  "username": "may__lily",
  "text": "Post content...",
  "like_count": 11476,
  "reply_count": 38,
  "repost_count": 468,
  "share_count": 75,
  "media_urls": ["https://..."],
  "timestamp": 1769355464,
  "timestamp_iso": "2026-01-25T15:37:44.000Z",
  "user_id": "63414013443",
  "user_display_name": "Phuong Ly",
  "user_avatar_url": "https://...",
  "is_verified": true,
  "post_url": "https://www.threads.com/@may__lily/post/DT8F9qykxdc",
  "shortcode": "DT8F9qykxdc",
  "is_reply": false,
  "parent_post_id": null,
  "thread_id": "3817952812169631580",
  "quoted_post": null,
  "hashtags": ["#hashtag1", "#hashtag2"],
  "mentions": ["@user1", "@user2"],
  "links": ["https://..."],
  "media_type": 1,
  "video_duration": null,
  "view_count": 0
}
```

#### Filtering

Chỉnh sửa `CONFIG.filter` trong `src/config.js`:

```javascript
filter: {
  min_likes: 100,
  max_likes: 10000,
  min_replies: 5,
  min_reposts: 10,
  min_shares: 5,
  has_media: true,
  username: 'newscientist',
  text_contains: 'NASA'
}
```

#### Output Files

- `output/threads_feed.json` - Tất cả feed items
- `output/threads_feed_filtered.json` - Items đã filter (nếu có filter)

---

### 3. Threads Feed API Server

REST API server để expose extraction functionality.

**Cấu trúc Modular:**
API server đã được refactor thành cấu trúc modular để dễ maintain:
- `api_server.js` - Main entry point, setup Express và register routes
- `src/api/middleware.js` - CORS và request logging middleware
- `src/api/utils/` - Utilities (cache management, query parsing)
- `src/api/routes/` - Route handlers được tách thành các file riêng theo chức năng

#### Khởi động server

```bash
npm run api
# Hoặc
node api_server.js
```

Server chạy tại `http://0.0.0.0:3000` (hoặc port trong `CONFIG.api.port`).

#### API Endpoints

##### `GET /api/feed`

Lấy feed items với optional filtering.

**Query Parameters:**
- `min_likes` (number) - Minimum like count
- `max_likes` (number) - Maximum like count
- `min_replies` (number) - Minimum reply count
- `min_reposts` (number) - Minimum repost count
- `min_shares` (number) - Minimum share count
- `max_shares` (number) - Maximum share count
- `has_media` (boolean) - Only posts with media
- `username` (string) - Filter by username (exact match)
- `text_contains` (string) - Filter posts containing text
- `after_timestamp` (number) - Posts after timestamp (Unix seconds)
- `before_timestamp` (number) - Posts before timestamp (Unix seconds)
- `limit` (number) - Limit number of items
- `refresh` (boolean) - Force refresh cache

**Example:**
```bash
curl "http://localhost:3000/api/feed?min_likes=200&has_media=true&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "post_id": "3817952812169631580",
      "username": "may__lily",
      "text": "Post content...",
      "like_count": 11476,
      "reply_count": 38,
      "repost_count": 468,
      "share_count": 75,
      "media_urls": ["https://..."],
      "timestamp": 1769355464,
      "timestamp_iso": "2026-01-25T15:37:44.000Z",
      "user_id": "63414013443",
      "user_display_name": "Phuong Ly",
      "user_avatar_url": "https://...",
      "is_verified": true,
      "post_url": "https://www.threads.com/@may__lily/post/DT8F9qykxdc",
      "shortcode": "DT8F9qykxdc",
      "is_reply": false,
      "parent_post_id": null,
      "thread_id": "3817952812169631580",
      "quoted_post": null,
      "hashtags": ["#hashtag1"],
      "mentions": ["@user1"],
      "links": ["https://..."],
      "media_type": 1,
      "video_duration": null,
      "view_count": 0
    }
  ],
  "meta": {
    "total": 27,
    "filtered": 15,
    "cached": true,
    "lastUpdated": "2026-01-31T09:01:38.558Z",
    "cacheExpiresAt": "2026-01-31T09:06:38.558Z",
    "timestamp": "2026-01-31T09:30:00.000Z",
    "request_id": "abc123"
  }
}
```

##### `GET /api/feed/:postId`

Lấy một post cụ thể theo ID.

**Example:**
```bash
curl "http://localhost:3000/api/feed/3817952812169631580"
```

##### `GET /api/user/:username/posts`

Lấy posts từ profile của một user.

**URL Parameters:**
- `username` (string) - Username (có thể có hoặc không có @ prefix)

**Query Parameters:** (giống như `GET /api/feed`)

**Example:**
```bash
# Lấy posts từ user
curl "http://localhost:3000/api/user/may__lily/posts?min_likes=100&has_media=true&limit=20"

# Username có @ prefix cũng được
curl "http://localhost:3000/api/user/@may__lily/posts"
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "username": "may__lily",
    "total": 45,
    "filtered": 25,
    "cached": false,
    "lastUpdated": "2026-01-31T09:30:00.000Z",
    "cacheExpiresAt": "2026-01-31T09:35:00.000Z"
  }
}
```

**Lưu ý:**
- Cache được lưu riêng cho từng user và filter criteria
- Có thể clear cache cho user cụ thể: `DELETE /api/cache?username=may__lily`

##### `POST /api/feed/refresh`

Force refresh feed data (bỏ qua cache).

**Request Body (optional):**
```json
{
  "min_likes": 200,
  "has_media": true,
  "limit": 50
}
```

Hoặc dùng query parameters:
```bash
curl -X POST "http://localhost:3000/api/feed/refresh?min_likes=200&limit=50"
```

##### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-01-31T09:30:00.000Z",
  "cache": {
    "enabled": true,
    "hasData": true,
    "age": 120000
  }
}
```

##### `DELETE /api/cache`

Xóa cache thủ công.

**Query Parameters:**
- `username` (string, optional) - Chỉ xóa cache cho user cụ thể

**Example:**
```bash
# Xóa tất cả cache
curl -X DELETE http://localhost:3000/api/cache

# Xóa cache cho user cụ thể
curl -X DELETE "http://localhost:3000/api/cache?username=may__lily"
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "cache": {
    "homeFeed": {
      "hadData": true,
      "itemsCleared": 27
    },
    "userCache": {
      "usersCleared": 0,
      "totalEntriesCleared": 0
    }
  }
}
```

##### `GET /api/stats`

Lấy thống kê về feed data và cache.

**Response:**
```json
{
  "success": true,
  "data": {
    "cache": {
      "enabled": true,
      "homeFeed": {
        "hasData": true,
        "itemCount": 27,
        "age": 120000,
        "ageFormatted": "120s",
        "expiresAt": "2026-01-31T09:35:00.000Z"
      },
      "userCache": {
        "enabled": true,
        "totalUsers": 2,
        "totalItems": 45,
        "entries": [
          {
            "username": "may__lily",
            "itemCount": 25,
            "age": 60000,
            "ageFormatted": "60s"
          }
        ]
      },
      "ttl": 300000,
      "ttlFormatted": "300s"
    },
    "extraction": {
      "maxItems": null,
      "extractMediaUrls": true,
      "extractTimestamps": true
    },
    "server": {
      "uptime": 3600,
      "uptimeFormatted": "3600s",
      "memory": {
        "used": 150,
        "total": 200,
        "unit": "MB"
      }
    },
    "feed": {
      "totalItems": 27,
      "itemsWithMedia": 15,
      "itemsWithTimestamps": 27,
      "uniqueUsernames": 20,
      "engagement": {
        "totalLikes": 5400,
        "totalReplies": 320,
        "totalReposts": 150,
        "totalShares": 75,
        "averageLikes": 200,
        "averageReplies": 12,
        "averageReposts": 6,
        "averageShares": 3
      }
    }
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

##### `GET /api/config`

Xem cấu hình hiện tại của API.

**Response:**
```json
{
  "success": true,
  "data": {
    "api": {
      "port": 3000,
      "host": "0.0.0.0",
      "cache": {
        "enabled": true,
        "ttl": 300000,
        "ttlFormatted": "300s"
      },
      "cors": {
        "enabled": true,
        "origin": "*"
      }
    },
    "threads": {
      "url": "https://www.threads.net"
    },
    "extraction": {
      "maxItems": null,
      "enableDebugLogging": false,
      "extractMediaUrls": true,
      "extractTimestamps": true
    },
    "browser": {
      "headless": false,
      "navigationTimeout": 60000,
      "waitForSelectorTimeout": 5000
    },
    "scroll": {
      "delayMinMs": 800,
      "delayMaxMs": 2000,
      "incrementPx": 300,
      "maxAttempts": 10
    }
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### Caching

API server sử dụng memory cache:
- **TTL**: Default 5 phút (config trong `CONFIG.api.cache.ttl`)
- **Cache Key**: Dựa trên filter criteria và account ID (nếu có)
- **Invalidation**: Tự động sau TTL, manual qua `/refresh` hoặc `DELETE /api/cache`
- **User Cache**: Cache riêng cho từng user và filter criteria
- **Account Isolation**: Cache được tách biệt theo account ID (nếu sử dụng multi-account)

#### Multi-Account Support

API server hỗ trợ nhiều tài khoản với session riêng biệt:

**Cách truyền Account ID:**

1. **Query Parameter** (ưu tiên cao nhất):
   ```bash
   curl "http://localhost:3000/api/feed?account_id=user123"
   ```

2. **Request Body**:
   ```bash
   curl -X POST "http://localhost:3000/api/feed/refresh" \
     -H "Content-Type: application/json" \
     -d '{"account_id": "user123", "min_likes": 100}'
   ```

3. **HTTP Header**:
   ```bash
   curl -H "X-Account-ID: user123" "http://localhost:3000/api/feed"
   ```

4. **JWT Token** (nếu enabled trong config):
   ```bash
   curl -H "Authorization: Bearer <jwt_token>" "http://localhost:3000/api/feed"
   ```

**Session Storage:**
- Session được lưu tại `profile_threads/{accountId}/threads_session.json`
- Nếu không có account ID, sử dụng default path: `output/threads_session.json`
- Mỗi account có session riêng, không ảnh hưởng lẫn nhau

**Configuration:**
```javascript
api: {
  accountId: {
    parseJWT: false, // Enable JWT parsing
    jwtSecret: process.env.JWT_SECRET || null,
    customHeaders: ['X-Custom-Account-ID'], // Custom headers
    logExtraction: false // Log extraction for debugging
  }
}
```

#### Browser Profile Path (Client-Side Profile)

**Lưu ý quan trọng về bảo mật:** Mặc định, hệ thống không lưu browser profile ở máy chủ để đảm bảo bảo mật và quyền riêng tư. Browser profile chỉ được tạo khi client chỉ định rõ ràng `profile_path`.

**Profile Path có thể được truyền qua:**

1. **Query Parameter**: 
   - `?profile_path=/path/to/profile` hoặc `?profile_dir=/path/to/profile` (full path)
   - `?profile_id=account_01&base_directory=/home/user/profiles` (profile ID với base directory)
2. **Request Body**: 
   - `{"profile_path": "/path/to/profile"}` hoặc `{"profile_dir": "/path/to/profile"}` (full path)
   - `{"profile_id": "account_01", "base_directory": "/home/user/profiles"}` (profile ID với base directory)
3. **HTTP Header**: 
   - `X-Profile-Path: /path/to/profile` hoặc `profile-path: /path/to/profile` (full path)
   - `X-Profile-Id: account_01` và `X-Base-Directory: /home/user/profiles` (profile ID với base directory)

**Lưu ý:**
- Nếu không có `profile_path`, hệ thống sẽ sử dụng temporary browser context (không lưu profile)
- Profile path phải là absolute path hoặc relative path hợp lệ
- Path không được chứa `..` hoặc `//` để tránh path traversal attacks
- Profile path được validate trước khi sử dụng
- **Profile ID**: Có thể sử dụng `profile_id` thay vì full path, nhưng cần cung cấp `base_directory` để resolve thành full path (`{base_directory}/{profile_id}`)
- **Base Directory**: Có thể được truyền qua query parameter, request body, hoặc header `X-Base-Directory`

**Ví dụ:**
```bash
# Sử dụng full path qua query parameter
curl "http://localhost:3000/api/feed?profile_path=/home/user/browser_profiles/my_profile"

# Sử dụng profile_id với base_directory (tiện hơn)
curl "http://localhost:3000/api/feed?profile_id=account_01&base_directory=/home/user/profiles"

# Sử dụng header
curl -H "X-Profile-Path: /home/user/browser_profiles/my_profile" "http://localhost:3000/api/feed"

# Sử dụng profile_id qua header
curl -H "X-Profile-Id: account_01" -H "X-Base-Directory: /home/user/profiles" "http://localhost:3000/api/feed"

# Kết hợp account_id và profile_id
curl "http://localhost:3000/api/feed?account_id=user123&profile_id=user123&base_directory=/home/user/profiles"
```

**Cấu hình:**
- `CONFIG.browser.persistentProfile.enabled` - Tắt mặc định (false) để không tự động tạo profile
- `CONFIG.browser.persistentProfile.requireExplicitPath` - Yêu cầu client phải chỉ định path rõ ràng (true)

#### Configuration

Cấu hình trong `src/config.js`:

```javascript
api: {
  port: 3000,
  host: '0.0.0.0',
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    enabled: true
  },
  cors: {
    enabled: true,
    origin: '*' // hoặc specific origins
  }
}
```

---

## ⚠️ EXPERIMENTAL: Post Interactions (Like & Comment)

**CẢNH BÁO QUAN TRỌNG:**

Tính năng này **vi phạm nguyên tắc read-only** của công cụ này. Sử dụng có thể dẫn đến:
- Tài khoản bị hạn chế hoặc ban
- Rate limiting từ Threads
- Vi phạm Terms of Service của Threads

**Tính năng này mặc định TẮT** và chỉ nên được sử dụng cho mục đích nghiên cứu và học tập.

### Kích hoạt Interactions

Để kích hoạt, chỉnh sửa `src/config.js`:

```javascript
interactions: {
  enabled: true, // ⚠️ CẢNH BÁO: Vi phạm read-only principle
  login: {
    username: process.env.THREADS_USERNAME || 'your_username',
    password: process.env.THREADS_PASSWORD || 'your_password',
    sessionStoragePath: 'output/threads_session.json',
    autoLogin: true, // Tự động login nếu chưa login
    loginTimeout: 60000
  },
  like: {
    delayBeforeClick: 500,
    delayAfterClick: 1000,
    retryAttempts: 3
  },
  comment: {
    delayBeforeType: 500,
    typingSpeed: 50,
    delayAfterSubmit: 2000,
    retryAttempts: 3
  },
  feedBrowsing: {
    maxPostsToComment: 5, // Số posts tối đa để comment (null = tất cả posts đã lọc)
    randomSelection: true, // Chọn posts ngẫu nhiên (true) hoặc theo thứ tự (false)
    commentDelayMin: 5000, // Delay tối thiểu giữa các comments (ms)
    commentDelayMax: 15000, // Delay tối đa giữa các comments (ms)
    commentTemplates: [
      'Nice post! 👍',
      'Great content!',
      'Thanks for sharing!',
      'Interesting! 💡',
      'Love this! ❤️'
    ]
  }
}
```

**Lưu ý về Login:**

1. **Sử dụng Environment Variables (Khuyến nghị):**
   ```bash
   export THREADS_USERNAME="your_username"
   export THREADS_PASSWORD="your_password"
   ```

2. **Hoặc set trực tiếp trong config** (không khuyến nghị cho production):
   ```javascript
   login: {
     username: 'your_username',
     password: 'your_password'
   }
   ```

3. **Session Management:**
   - Session cookies sẽ được lưu vào `output/threads_session.json`
   - Lần chạy sau sẽ tự động load session, không cần login lại
   - Nếu session hết hạn, sẽ tự động login lại (nếu `autoLogin: true`)

4. **Manual Login:**
   - Có thể login thủ công trong browser, code sẽ detect và sử dụng session đó
   - Hoặc gọi `loginToThreads(page, username, password)` trước khi dùng interactions

### API Endpoints

#### `POST /api/login`

Login vào Threads (cần thiết để sử dụng like/comment).

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

Hoặc dùng query parameters:
```bash
curl -X POST "http://localhost:3000/api/login?username=your_username&password=your_password"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Login successful"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Lưu ý:**
- Session sẽ được lưu tự động vào `output/threads_session.json`
- Lần request sau sẽ tự động sử dụng session đã lưu
- Nếu session hết hạn, cần login lại

#### `POST /api/post/:postId/like`

Like một post.

**Query Parameters:**
- `username` (string, optional) - Username để tạo post URL
- `shortcode` (string, optional) - Shortcode để tạo post URL
- `postUrl` (string, optional) - URL trực tiếp của post (ưu tiên cao nhất)

**Example:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/like?username=may__lily&shortcode=DT8F9qykxdc"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "alreadyLiked": false,
    "message": "Post liked successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### `DELETE /api/post/:postId/like`

Unlike một post.

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/post/3817952812169631580/like"
```

#### `POST /api/post/:postId/comment`

Comment trên một post.

**Request Body:**
```json
{
  "comment": "Great post! 👍",
  "username": "may__lily",
  "shortcode": "DT8F9qykxdc"
}
```

Hoặc dùng query parameters:
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/comment?comment=Great%20post!"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Comment posted successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### `GET /api/post/:postId/interactions`

Lấy trạng thái interactions của một post (đã like chưa, etc.).

**Example:**
```bash
curl "http://localhost:3000/api/post/3817952812169631580/interactions"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isLiked": true,
    "canInteract": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### `POST /api/post/:postId/repost`

Repost một post.

**Query Parameters:**
- `username` (string, optional) - Username để tạo post URL
- `shortcode` (string, optional) - Shortcode để tạo post URL
- `postUrl` (string, optional) - URL trực tiếp của post

**Example:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/repost?username=may__lily&shortcode=DT8F9qykxdc"
```

#### `POST /api/post/:postId/quote`

Quote một post với comment.

**Request Body:**
```json
{
  "quote": "Great insights! 💡",
  "username": "may__lily",
  "shortcode": "DT8F9qykxdc"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/quote" \
  -H "Content-Type: application/json" \
  -d '{"quote": "Great insights! 💡"}'
```

#### `DELETE /api/post/:postId/repost`

Unrepost một post đã repost.

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/post/3817952812169631580/repost"
```

#### `GET /api/post/:postId/repost-status`

Lấy trạng thái repost của một post (đã repost chưa).

**Query Parameters:**
- `username` (string, optional) - Username để tạo post URL
- `shortcode` (string, optional) - Shortcode để tạo post URL
- `postUrl` (string, optional) - URL trực tiếp của post

**Example:**
```bash
curl "http://localhost:3000/api/post/3817952812169631580/repost-status?username=may__lily&shortcode=DT8F9qykxdc"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isReposted": true,
    "canInteract": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### `POST /api/post/:postId/share`

Share một post (copy link hoặc mở share menu).

**Query Parameters:**
- `platform` (string, optional) - Platform to share to (default: 'copy')

**Example:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/share?platform=copy"
```

#### `POST /api/user/:username/follow`

Follow một user.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/user/may__lily/follow"
```

#### `DELETE /api/user/:username/follow`

Unfollow một user.

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/user/may__lily/follow"
```

#### `GET /api/user/:username/follow-status`

Lấy trạng thái follow của một user (đã follow chưa).

**Example:**
```bash
curl "http://localhost:3000/api/user/may__lily/follow-status"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isFollowing": true,
    "canInteract": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

### Sử dụng trong Code

#### JavaScript/Node.js

```javascript
import { 
  likePost, 
  commentOnPost, 
  loginToThreads,
  repostPost,
  quotePost,
  unrepostPost,
  sharePost,
  getRepostStatus
} from './src/interactions/post-interactions.js';
import {
  followUser,
  unfollowUser
} from './src/interactions/user-interactions.js';
import { launchBrowser } from './src/browser/browser-manager.js';

const { browser, context } = await launchBrowser();
const page = await context.newPage();

// Option 1: Manual login (nếu muốn login thủ công)
const loginResult = await loginToThreads(page, 'your_username', 'your_password');
if (!loginResult.success) {
  console.error('Login failed:', loginResult.error);
  await browser.close();
  return;
}

// Option 2: Auto-login (nếu đã set CONFIG.interactions.login.username/password)
// Code sẽ tự động login nếu CONFIG.interactions.login.autoLogin = true
// Không cần gọi loginToThreads() manually

// Like a post (sẽ tự động check login và login nếu cần)
const likeResult = await likePost(page, '3817952812169631580', {
  username: 'may__lily',
  shortcode: 'DT8F9qykxdc'
});

// Comment on a post
const commentResult = await commentOnPost(
  page,
  '3817952812169631580',
  'Great post! 👍',
  { username: 'may__lily', shortcode: 'DT8F9qykxdc' }
);

// Repost a post
const repostResult = await repostPost(page, '3817952812169631580', {
  username: 'may__lily',
  shortcode: 'DT8F9qykxdc'
});

// Quote a post with comment
const quoteResult = await quotePost(
  page,
  '3817952812169631580',
  'Great insights! 💡',
  { username: 'may__lily', shortcode: 'DT8F9qykxdc' }
);

// Unrepost a post
const unrepostResult = await unrepostPost(page, '3817952812169631580', {
  username: 'may__lily',
  shortcode: 'DT8F9qykxdc'
});

// Check repost status
const repostStatusResult = await getRepostStatus(page, '3817952812169631580', {
  username: 'may__lily',
  shortcode: 'DT8F9qykxdc'
});
console.log(`Is Reposted: ${repostStatusResult.isReposted}`);

// Share a post (copy link)
const shareResult = await sharePost(page, '3817952812169631580', 'copy', {
  username: 'may__lily',
  shortcode: 'DT8F9qykxdc'
});

// Follow a user
const followResult = await followUser(page, 'may__lily');

// Unfollow a user
const unfollowResult = await unfollowUser(page, 'may__lily');

await browser.close();
```

**Session Management:**
- Session cookies được tự động lưu vào `output/threads_session.json`
- Lần chạy sau sẽ tự động load session, không cần login lại
- Nếu session hết hạn, sẽ tự động login lại (nếu `autoLogin: true`)

#### Python (via API)

```python
import requests

# Login first (optional if credentials are set in config)
response = requests.post(
    'http://localhost:3000/api/login',
    json={
        'username': 'your_username',
        'password': 'your_password'
    }
)
login_result = response.json()
print(f"Login: {login_result['success']}")

# Like a post (will auto-login if credentials are set in config)
response = requests.post(
    'http://localhost:3000/api/post/3817952812169631580/like',
    params={'username': 'may__lily', 'shortcode': 'DT8F9qykxdc'}
)
result = response.json()

# Comment on a post (will auto-login if credentials are set in config)
response = requests.post(
    'http://localhost:3000/api/post/3817952812169631580/comment',
    json={'comment': 'Great post! 👍'}
)
result = response.json()
```

### Example Script

Xem file `examples/interact-example.js` để biết các ví dụ chi tiết:

```bash
# Uncomment examples trong file và chạy
node examples/interact-example.js
```

### Error Handling

Tất cả interaction functions đều có error handling cải thiện:

1. **Retry Logic với Exponential Backoff**: Tự động retry với delay tăng dần
2. **Structured Logging**: Log chi tiết với levels (DEBUG, INFO, WARN, ERROR)
3. **Input Validation**: Validate tất cả inputs trước khi thực hiện
4. **Error Classification**: Phân loại errors (SessionExpired, ElementNotFound, RateLimit, etc.)
5. **Error Recovery**: Tự động recovery cho một số lỗi (re-login, retry với selectors khác)

**Error Types:**
- `SessionExpiredError` - Session hết hạn, cần login lại
- `ElementNotFoundError` - Không tìm thấy element trên page
- `RateLimitError` - Bị rate limit, cần đợi
- `NavigationError` - Lỗi khi navigate
- `ValidationError` - Input validation failed
- `TimeoutError` - Operation timeout

### Lưu ý

1. **Selectors có thể fragile**: UI của Threads có thể thay đổi, khiến selectors không hoạt động
2. **Rate limiting**: Threads có thể áp dụng rate limiting cho các hành động tương tác
3. **Account safety**: Sử dụng với tài khoản test, không dùng tài khoản chính
4. **Human-like behavior**: Code đã cố gắng mô phỏng hành vi người dùng thật với delays và typing speed
5. **Error handling**: Tất cả functions đều có retry logic với exponential backoff và error recovery
6. **Session management**: Session được tự động lưu và load, giảm số lần login cần thiết

---

## ⚠️ EXPERIMENTAL: Feed Browsing and Automated Commenting

**CẢNH BÁO QUAN TRỌNG:**

Tính năng này cho phép tự động duyệt feed, lọc posts, và comment trên nhiều posts. Tính năng này **vi phạm nguyên tắc read-only** và có thể dẫn đến:
- Tài khoản bị hạn chế hoặc ban
- Rate limiting từ Threads
- Vi phạm Terms of Service của Threads

**Tính năng này mặc định TẮT** và chỉ nên được sử dụng cho mục đích nghiên cứu và học tập.

### Tính năng

1. **Feed Browsing và Commenting**: Duyệt feed, lọc posts theo tiêu chí, và tự động comment trên các posts đã lọc
2. **User Selection và Commenting**: Chọn user từ feed và comment trên các posts của user đó

### Cấu hình

Thêm cấu hình `feedBrowsing` vào `src/config.js`:

```javascript
interactions: {
  enabled: true, // ⚠️ CẢNH BÁO: Vi phạm read-only principle
  feedBrowsing: {
    maxPostsToComment: 5, // Số posts tối đa để comment (null = tất cả posts đã lọc)
    randomSelection: true, // Chọn posts ngẫu nhiên (true) hoặc theo thứ tự (false)
    commentDelayMin: 5000, // Delay tối thiểu giữa các comments (ms)
    commentDelayMax: 15000, // Delay tối đa giữa các comments (ms)
    commentTemplates: [
      'Nice post! 👍',
      'Great content!',
      'Thanks for sharing!',
      'Interesting! 💡',
      'Love this! ❤️'
    ]
  }
}
```

**Comment Templates:**
- Có thể sử dụng các biến: `{username}`, `{@username}`, `{postText}`
- Ví dụ: `"Great post @{username}!"` → `"Great post @may__lily!"`

### API Endpoints

#### `POST /api/feed/browse-and-comment`

Duyệt feed, lọc posts, và comment trên các posts đã lọc.

**Request Body:**
```json
{
  "filterCriteria": {
    "min_likes": 10,
    "has_media": true,
    "min_replies": 5,
    "username": "may__lily",
    "text_contains": "NASA"
  },
  "maxPostsToComment": 5,
  "randomSelection": true,
  "commentTemplates": ["Nice post!", "Great content!"],
  "commentDelayMin": 5000,
  "commentDelayMax": 15000,
  "maxItems": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalExtracted": 50,
    "totalFiltered": 15,
    "totalCommented": 5,
    "successful": 4,
    "failed": 1,
    "results": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "text": "Post content...",
        "success": true,
        "error": null,
        "comment": "Nice post! 👍"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

#### `POST /api/feed/select-user-and-comment`

Chọn user từ feed và comment trên các posts của user đó.

**Request Body:**
```json
{
  "username": "may__lily",
  "filterCriteria": {
    "min_likes": 10,
    "has_media": true
  },
  "maxPostsToComment": 3,
  "commentTemplates": ["Great post!", "Thanks for sharing!"],
  "maxItems": 30
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedUser": "may__lily",
    "totalPosts": 20,
    "totalFiltered": 8,
    "totalCommented": 3,
    "successful": 3,
    "failed": 0,
    "results": [...]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

### Sử dụng trong Code

#### JavaScript/Node.js

```javascript
import {
  browseFeedAndComment,
  selectUserAndComment,
  commentOnUserPosts,
  selectUserFromFeed,
  extractUsersFromFeed
} from './src/interactions/post-interactions.js';
import { launchBrowser } from './src/browser/browser-manager.js';

const { browser, context } = await launchBrowser();
const page = await context.newPage();

// Option 1: Browse feed and comment on filtered posts
const result = await browseFeedAndComment(page, {
  filterCriteria: {
    min_likes: 10,
    has_media: true,
    min_replies: 5
  },
  maxPostsToComment: 5,
  randomSelection: true,
  commentTemplates: ['Nice post! 👍', 'Great content!'],
  maxItems: 50
});

console.log(`Commented on ${result.successful} posts`);

// Option 2: Select a user from feed and comment on their posts
const userResult = await selectUserAndComment(page, {
  username: 'may__lily', // Optional: specify user
  // If username not specified, will select random user from feed
  filterCriteria: {
    min_likes: 10,
    has_media: true
  },
  maxPostsToComment: 3,
  maxItems: 30
});

console.log(`Selected user: ${userResult.selectedUser}`);
console.log(`Commented on ${userResult.successful} posts`);

// Option 3: Extract users from feed and select one
const users = await extractUsersFromFeed(page, { maxItems: 50 });
console.log(`Found ${users.length} users in feed`);

const selectedUser = await selectUserFromFeed(page, { maxItems: 50 });
console.log(`Selected user: ${selectedUser.username}`);

// Then comment on their posts
const commentResult = await commentOnUserPosts(page, selectedUser.username, {
  filterCriteria: { min_likes: 10 },
  maxPostsToComment: 3
});

await browser.close();
```

#### Python (via API)

```python
import requests

# Browse feed and comment
response = requests.post(
    'http://localhost:3000/api/feed/browse-and-comment',
    json={
        'filterCriteria': {
            'min_likes': 10,
            'has_media': True
        },
        'maxPostsToComment': 5,
        'randomSelection': True
    }
)
result = response.json()
print(f"Commented on {result['data']['successful']} posts")

# Select user and comment
response = requests.post(
    'http://localhost:3000/api/feed/select-user-and-comment',
    json={
        'username': 'may__lily',
        'filterCriteria': {'min_likes': 10},
        'maxPostsToComment': 3
    }
)
result = response.json()
print(f"Selected user: {result['data']['selectedUser']}")
```

### Example Script

Xem file `examples/feed-browsing-example.js` để biết các ví dụ chi tiết:

```bash
# Uncomment examples trong file và chạy
node examples/feed-browsing-example.js
```

### Lưu ý

1. **Username và Text Extraction**: Hệ thống đã được cải tiến để extract username và text content từ GraphQL responses, đặc biệt từ nested structures như `text_post_app_thread.thread_items[].post`
2. **Post Filtering**: Sử dụng cùng filter criteria như feed extraction (`min_likes`, `has_media`, `min_replies`, etc.)
3. **Human-like Behavior**: Random delays giữa các comments, random selection, và typing speed để mô phỏng hành vi người dùng thật
4. **Error Handling**: Mỗi comment attempt có error handling riêng, failures không làm dừng toàn bộ process
5. **Session Management**: Tự động sử dụng saved session, không cần login lại mỗi lần

---

## 🔌 Tích hợp API vào dự án khác

Hướng dẫn chi tiết về cách tích hợp Threads Feed API vào các dự án khác.

### 1. Setup và Deployment

#### Khởi động API Server

**Development:**
```bash
# Từ thư mục qrtools
npm run api
# Hoặc
node api_server.js
```

Server sẽ chạy tại `http://localhost:3000` (hoặc port được cấu hình trong `CONFIG.api.port`).

**Production với PM2:**
```bash
# Cài đặt PM2
npm install -g pm2

# Khởi động server
pm2 start api_server.js --name threads-api

# Tự động restart khi server restart
pm2 startup
pm2 save

# Xem logs
pm2 logs threads-api

# Monitor
pm2 monit
```

**Production với systemd (Linux):**
```bash
# Tạo service file: /etc/systemd/system/threads-api.service
[Unit]
Description=Threads Feed API Server
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/qrtools
ExecStart=/usr/bin/node api_server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable và start
sudo systemctl enable threads-api
sudo systemctl start threads-api
```

#### Environment Variables

Tạo file `.env` hoặc set environment variables:

```bash
# API Configuration
THREADS_API_PORT=3000
THREADS_API_HOST=0.0.0.0

# Threads Credentials (nếu dùng interactions)
THREADS_USERNAME=your_username
THREADS_PASSWORD=your_password

# Node Environment
NODE_ENV=production
```

Sử dụng trong `src/config.js`:
```javascript
api: {
  port: process.env.THREADS_API_PORT || 3000,
  host: process.env.THREADS_API_HOST || '0.0.0.0'
}
```

#### Health Check và Monitoring

API cung cấp health check endpoint:

```bash
# Health check
curl http://localhost:3000/api/health

# Stats
curl http://localhost:3000/api/stats

# Config
curl http://localhost:3000/api/config
```

**Monitoring với PM2:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

### 2. Quick Start

#### Python

```python
import requests
from typing import Optional, Dict, List

class ThreadsAPI:
    def __init__(self, base_url: str = "http://localhost:3000/api"):
        self.base_url = base_url
    
    def get_feed(self, filters: Optional[Dict] = None, limit: Optional[int] = None) -> List[Dict]:
        """Get feed items with optional filters"""
        params = filters or {}
        if limit:
            params['limit'] = limit
        
        response = requests.get(f"{self.base_url}/feed", params=params)
        response.raise_for_status()
        return response.json()['data']
    
    def get_user_posts(self, username: str, filters: Optional[Dict] = None) -> List[Dict]:
        """Get posts from a specific user"""
        params = filters or {}
        response = requests.get(
            f"{self.base_url}/user/{username}/posts",
            params=params
        )
        response.raise_for_status()
        return response.json()['data']
    
    def refresh_feed(self, filters: Optional[Dict] = None) -> List[Dict]:
        """Force refresh feed (bypass cache)"""
        response = requests.post(
            f"{self.base_url}/feed/refresh",
            json=filters or {}
        )
        response.raise_for_status()
        return response.json()['data']

# Usage
api = ThreadsAPI()

# Get feed with filters
posts = api.get_feed({
    'min_likes': 200,
    'has_media': True
}, limit=10)

# Get user posts
user_posts = api.get_user_posts('may__lily', {
    'min_likes': 100,
    'limit': 20
})
```

#### JavaScript/Node.js

```javascript
class ThreadsAPI {
  constructor(baseURL = 'http://localhost:3000/api') {
    this.baseURL = baseURL;
  }

  async getFeed(filters = {}, limit = null) {
    const params = new URLSearchParams(filters);
    if (limit) params.append('limit', limit);

    const response = await fetch(`${this.baseURL}/feed?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    
    const data = await response.json();
    return data.data;
  }

  async getUserPosts(username, filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseURL}/user/${username}/posts?${params}`);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    
    const data = await response.json();
    return data.data;
  }

  async refreshFeed(filters = {}) {
    const response = await fetch(`${this.baseURL}/feed/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    
    const data = await response.json();
    return data.data;
  }
}

// Usage
const api = new ThreadsAPI();

// Get feed with filters
const posts = await api.getFeed({
  min_likes: 200,
  has_media: true
}, 10);

// Get user posts
const userPosts = await api.getUserPosts('may__lily', {
  min_likes: 100,
  limit: 20
});
```

---

### 3. Integration Patterns

#### Python: FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import requests
import asyncio
from httpx import AsyncClient

app = FastAPI()

class FeedFilters(BaseModel):
    min_likes: Optional[int] = None
    max_likes: Optional[int] = None
    has_media: Optional[bool] = None
    username: Optional[str] = None
    limit: Optional[int] = None

THREADS_API_URL = "http://localhost:3000/api"

@app.get("/threads/feed")
async def get_threads_feed(filters: FeedFilters = None):
    """Proxy to Threads API with error handling"""
    async with AsyncClient() as client:
        try:
            params = filters.dict(exclude_none=True) if filters else {}
            response = await client.get(
                f"{THREADS_API_URL}/feed",
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=503, detail=f"Threads API error: {str(e)}")

@app.get("/threads/user/{username}/posts")
async def get_user_posts(username: str, min_likes: Optional[int] = None):
    """Get posts from specific user"""
    async with AsyncClient() as client:
        try:
            params = {}
            if min_likes:
                params['min_likes'] = min_likes
            
            response = await client.get(
                f"{THREADS_API_URL}/user/{username}/posts",
                params=params,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=503, detail=f"Threads API error: {str(e)}")
```

#### Python: Flask Integration

```python
from flask import Flask, jsonify, request
import requests
from functools import wraps
import time

app = Flask(__name__)
THREADS_API_URL = "http://localhost:3000/api"

def retry_on_failure(max_retries=3, delay=1):
    """Decorator for retry logic"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    if attempt == max_retries - 1:
                        raise
                    time.sleep(delay * (attempt + 1))
            return None
        return wrapper
    return decorator

@retry_on_failure(max_retries=3)
def call_threads_api(endpoint, params=None, method='GET', json_data=None):
    """Helper function to call Threads API with retry"""
    url = f"{THREADS_API_URL}{endpoint}"
    
    if method == 'GET':
        response = requests.get(url, params=params, timeout=30)
    elif method == 'POST':
        response = requests.post(url, params=params, json=json_data, timeout=30)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    response.raise_for_status()
    return response.json()

@app.route('/threads/feed', methods=['GET'])
def get_feed():
    """Get Threads feed with filters"""
    try:
        filters = {
            'min_likes': request.args.get('min_likes', type=int),
            'has_media': request.args.get('has_media', type=bool),
            'limit': request.args.get('limit', type=int)
        }
        # Remove None values
        filters = {k: v for k, v in filters.items() if v is not None}
        
        result = call_threads_api('/feed', params=filters)
        return jsonify(result)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 503

@app.route('/threads/user/<username>/posts', methods=['GET'])
def get_user_posts(username):
    """Get posts from specific user"""
    try:
        params = {
            'min_likes': request.args.get('min_likes', type=int),
            'limit': request.args.get('limit', type=int)
        }
        params = {k: v for k, v in params.items() if v is not None}
        
        result = call_threads_api(f'/user/{username}/posts', params=params)
        return jsonify(result)
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 503
```

#### JavaScript: Express Integration

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

const THREADS_API_URL = 'http://localhost:3000/api';

// Retry helper
async function retryRequest(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
}

// Helper to call Threads API
async function callThreadsAPI(endpoint, options = {}) {
  const { params, method = 'GET', data } = options;
  
  return retryRequest(async () => {
    const response = await axios({
      url: `${THREADS_API_URL}${endpoint}`,
      method,
      params,
      data,
      timeout: 30000
    });
    return response.data;
  });
}

app.get('/threads/feed', async (req, res) => {
  try {
    const filters = {
      min_likes: req.query.min_likes ? parseInt(req.query.min_likes) : undefined,
      has_media: req.query.has_media === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const result = await callThreadsAPI('/feed', { params: filters });
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get('/threads/user/:username/posts', async (req, res) => {
  try {
    const { username } = req.params;
    const params = {
      min_likes: req.query.min_likes ? parseInt(req.query.min_likes) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    Object.keys(params).forEach(key => 
      params[key] === undefined && delete params[key]
    );
    
    const result = await callThreadsAPI(`/user/${username}/posts`, { params });
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});
```

#### JavaScript: Next.js Integration

```javascript
// pages/api/threads/feed.js
import axios from 'axios';

const THREADS_API_URL = process.env.THREADS_API_URL || 'http://localhost:3000/api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filters = {
      min_likes: req.query.min_likes ? parseInt(req.query.min_likes) : undefined,
      has_media: req.query.has_media === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const response = await axios.get(`${THREADS_API_URL}/feed`, {
      params: filters,
      timeout: 30000
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Threads API error:', error);
    res.status(503).json({ 
      error: 'Failed to fetch Threads feed',
      details: error.message 
    });
  }
}

// pages/api/threads/user/[username]/posts.js
import axios from 'axios';

const THREADS_API_URL = process.env.THREADS_API_URL || 'http://localhost:3000/api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username } = req.query;
    const params = {
      min_likes: req.query.min_likes ? parseInt(req.query.min_likes) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    Object.keys(params).forEach(key => 
      params[key] === undefined && delete params[key]
    );

    const response = await axios.get(
      `${THREADS_API_URL}/user/${username}/posts`,
      { params, timeout: 30000 }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Threads API error:', error);
    res.status(503).json({ 
      error: 'Failed to fetch user posts',
      details: error.message 
    });
  }
}
```

---

### 4. Advanced Topics

#### Error Handling và Retry Logic

**Python với exponential backoff:**
```python
import requests
import time
from typing import Callable, Any

def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_multiplier: float = 2.0,
    max_delay: float = 60.0
) -> Any:
    """Retry function with exponential backoff"""
    delay = initial_delay
    
    for attempt in range(max_retries):
        try:
            return func()
        except (requests.exceptions.RequestException, Exception) as e:
            if attempt == max_retries - 1:
                raise
            
            print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            time.sleep(delay)
            delay = min(delay * backoff_multiplier, max_delay)
    
    raise Exception("Max retries exceeded")

# Usage
def fetch_feed():
    response = requests.get('http://localhost:3000/api/feed', timeout=30)
    response.raise_for_status()
    return response.json()

try:
    data = retry_with_backoff(fetch_feed, max_retries=5)
except Exception as e:
    print(f"Failed to fetch feed: {e}")
```

**JavaScript với circuit breaker pattern:**
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function fetchFeed() {
  return breaker.execute(async () => {
    const response = await fetch('http://localhost:3000/api/feed');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}
```

#### Caching Strategies

**Python với Redis:**
```python
import redis
import json
import hashlib
import requests

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_cache_key(endpoint, params):
    """Generate cache key from endpoint and params"""
    key_data = f"{endpoint}:{json.dumps(params, sort_keys=True)}"
    return hashlib.md5(key_data.encode()).hexdigest()

def get_cached_feed(endpoint, params, ttl=300):
    """Get feed with caching"""
    cache_key = get_cache_key(endpoint, params)
    
    # Try cache first
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Fetch from API
    response = requests.get(f"http://localhost:3000/api{endpoint}", params=params)
    response.raise_for_status()
    data = response.json()
    
    # Cache result
    redis_client.setex(cache_key, ttl, json.dumps(data))
    
    return data
```

**JavaScript với in-memory cache:**
```javascript
class Cache {
  constructor(ttl = 300000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new Cache(300000); // 5 minutes

async function getCachedFeed(filters) {
  const cacheKey = JSON.stringify(filters);
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  
  // Fetch from API
  const params = new URLSearchParams(filters);
  const response = await fetch(`http://localhost:3000/api/feed?${params}`);
  const data = await response.json();
  
  // Cache result
  cache.set(cacheKey, data);
  
  return data;
}
```

#### Performance Optimization

**Batch Requests:**
```python
import asyncio
from httpx import AsyncClient

async def fetch_multiple_users(usernames):
    """Fetch posts from multiple users concurrently"""
    async with AsyncClient() as client:
        tasks = [
            client.get(f"http://localhost:3000/api/user/{username}/posts")
            for username in usernames
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        results = []
        for username, response in zip(usernames, responses):
            if isinstance(response, Exception):
                print(f"Error fetching {username}: {response}")
                continue
            results.append({
                'username': username,
                'posts': response.json()['data']
            })
        
        return results

# Usage
usernames = ['may__lily', 'user2', 'user3']
results = asyncio.run(fetch_multiple_users(usernames))
```

**Connection Pooling:**
```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Create session with connection pooling
session = requests.Session()

# Configure retry strategy
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504]
)

adapter = HTTPAdapter(
    max_retries=retry_strategy,
    pool_connections=10,
    pool_maxsize=20
)

session.mount("http://", adapter)
session.mount("https://", adapter)

# Use session for all requests
response = session.get('http://localhost:3000/api/feed')
```

---

### 5. Use Cases

#### Real-time Feed Monitoring

```python
import time
import requests
from datetime import datetime

def monitor_feed(keywords, interval=60):
    """Monitor feed for specific keywords"""
    seen_posts = set()
    
    while True:
        try:
            response = requests.get('http://localhost:3000/api/feed/refresh')
            posts = response.json()['data']
            
            for post in posts:
                post_id = post['post_id']
                if post_id in seen_posts:
                    continue
                
                seen_posts.add(post_id)
                
                # Check for keywords
                text = post.get('text', '').lower()
                if any(keyword.lower() in text for keyword in keywords):
                    print(f"[{datetime.now()}] New post matching keywords:")
                    print(f"  User: @{post['username']}")
                    print(f"  Text: {post['text'][:100]}...")
                    print(f"  URL: {post['post_url']}")
                    print()
        
        except Exception as e:
            print(f"Error: {e}")
        
        time.sleep(interval)

# Monitor for specific keywords
monitor_feed(['NASA', 'space', 'technology'], interval=60)
```

#### Scheduled Data Extraction

```python
import schedule
import time
import requests
import json
from datetime import datetime

def extract_and_save():
    """Extract feed and save to file"""
    try:
        response = requests.post('http://localhost:3000/api/feed/refresh', json={
            'min_likes': 100,
            'has_media': True,
            'limit': 50
        })
        data = response.json()['data']
        
        filename = f"feed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"Saved {len(data)} posts to {filename}")
    except Exception as e:
        print(f"Error: {e}")

# Schedule extraction every hour
schedule.every().hour.do(extract_and_save)

# Run scheduler
while True:
    schedule.run_pending()
    time.sleep(60)
```

#### Analytics Dashboard

```python
from flask import Flask, render_template_string
import requests
from collections import Counter

app = Flask(__name__)

@app.route('/analytics')
def analytics():
    """Generate analytics from feed data"""
    response = requests.get('http://localhost:3000/api/feed', params={
        'limit': 100
    })
    posts = response.json()['data']
    
    # Calculate statistics
    total_likes = sum(p.get('like_count', 0) for p in posts)
    total_replies = sum(p.get('reply_count', 0) for p in posts)
    avg_likes = total_likes / len(posts) if posts else 0
    
    # Top users
    user_counts = Counter(p['username'] for p in posts)
    top_users = user_counts.most_common(10)
    
    # Top hashtags
    all_hashtags = []
    for p in posts:
        all_hashtags.extend(p.get('hashtags', []))
    top_hashtags = Counter(all_hashtags).most_common(10)
    
    return render_template_string('''
    <h1>Threads Feed Analytics</h1>
    <h2>Statistics</h2>
    <p>Total Posts: {{ posts|length }}</p>
    <p>Total Likes: {{ total_likes }}</p>
    <p>Total Replies: {{ total_replies }}</p>
    <p>Average Likes: {{ "%.2f"|format(avg_likes) }}</p>
    
    <h2>Top Users</h2>
    <ul>
    {% for user, count in top_users %}
        <li>@{{ user }}: {{ count }} posts</li>
    {% endfor %}
    </ul>
    
    <h2>Top Hashtags</h2>
    <ul>
    {% for tag, count in top_hashtags %}
        <li>{{ tag }}: {{ count }}</li>
    {% endfor %}
    </ul>
    ''', posts=posts, total_likes=total_likes, total_replies=total_replies,
         avg_likes=avg_likes, top_users=top_users, top_hashtags=top_hashtags)
```

---

### 6. Troubleshooting

#### Common Issues

**1. Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution:** Đảm bảo API server đang chạy:
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Start server if not running
npm run api
```

**2. Timeout Errors**
```
Error: Request timeout after 30000ms
```
**Solution:** Tăng timeout hoặc kiểm tra network:
```python
# Python
response = requests.get(url, timeout=60)  # Increase timeout

# JavaScript
const controller = new AbortController();
setTimeout(() => controller.abort(), 60000); // 60s timeout
fetch(url, { signal: controller.signal });
```

**3. Rate Limiting**
```
Error: 429 Too Many Requests
```
**Solution:** Implement rate limiting và retry:
```python
import time
from functools import wraps

def rate_limit(max_calls=10, period=60):
    """Rate limiting decorator"""
    calls = []
    
    @wraps
    def decorator(func):
        def wrapper(*args, **kwargs):
            now = time.time()
            # Remove old calls
            calls[:] = [c for c in calls if c > now - period]
            
            if len(calls) >= max_calls:
                sleep_time = period - (now - calls[0])
                if sleep_time > 0:
                    time.sleep(sleep_time)
            
            calls.append(time.time())
            return func(*args, **kwargs)
        return wrapper
    return decorator

@rate_limit(max_calls=10, period=60)
def fetch_feed():
    return requests.get('http://localhost:3000/api/feed')
```

**4. Cache Issues**
```
Getting stale data even after refresh
```
**Solution:** Clear cache hoặc force refresh:
```python
# Force refresh
response = requests.post('http://localhost:3000/api/feed/refresh', json={})

# Or clear cache
requests.delete('http://localhost:3000/api/cache')
```

#### Debug Tips

**1. Enable Debug Logging:**
```javascript
// In your integration code
const response = await fetch('http://localhost:3000/api/feed');
console.log('Status:', response.status);
console.log('Headers:', response.headers);
const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
```

**2. Check API Health:**
```bash
# Health check
curl http://localhost:3000/api/health

# Stats
curl http://localhost:3000/api/stats

# Config
curl http://localhost:3000/api/config
```

**3. Monitor API Server Logs:**
```bash
# If using PM2
pm2 logs threads-api

# If using systemd
journalctl -u threads-api -f
```

---

### 7. Alternative Integration Methods

#### Import trực tiếp (Node.js)

Nếu dự án khác cũng dùng Node.js, có thể import trực tiếp:

```javascript
import { extractFeedData, extractUserPosts, CONFIG, filterPosts } from './qrtools/src/extractor.js';

// Extract home feed
const feedItems = await extractFeedData({
  maxItems: 50
});

// Extract user posts
const userPosts = await extractUserPosts('may__lily', {
  maxItems: 20
});

// Filter posts
const filtered = filterPosts(feedItems, {
  min_likes: 100,
  has_media: true
});
```

#### Python Wrapper (Subprocess)

Tạo Python wrapper để gọi Node.js script:

```python
import json
import subprocess
from pathlib import Path

class NodeFeedExtractor:
    def __init__(self, script_path=None):
        self.script_path = Path(script_path or 'qrtools/src/cli.js')
    
    def extract_feed(self, username=None, filters=None):
        """Extract feed data via Node.js subprocess"""
        cmd = ['node', str(self.script_path)]
        
        if username:
            cmd.extend(['--username', username])
        
        if filters:
            cmd.extend(['--filters', json.dumps(filters)])
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            raise Exception(f"Extraction failed: {result.stderr}")
        
        # Parse JSON output
        output_lines = result.stdout.strip().split('\n')
        json_line = [l for l in output_lines if l.startswith('{')][-1]
        return json.loads(json_line)

# Usage
extractor = NodeFeedExtractor()
posts = extractor.extract_feed(
    username='may__lily',
    filters={'min_likes': 100, 'has_media': True}
)
```

---

### Tài liệu tham khảo

- Xem [docs/API.md](docs/API.md) để biết chi tiết đầy đủ về tất cả API endpoints
- Xem [README.md](README.md) để biết cách sử dụng CLI và configuration

---

## 📊 Data Fields

### Post Fields

| Field | Type | Description |
|-------|------|-------------|
| `post_id` | string | Unique post ID |
| `username` | string | Post author username |
| `text` | string | Post text content |
| `like_count` | number | Number of likes |
| `reply_count` | number | Number of replies |
| `repost_count` | number | Number of reposts |
| `share_count` | number | Number of shares |
| `media_urls` | array | Array of media URLs |
| `timestamp` | number | Unix timestamp (seconds) |
| `timestamp_iso` | string | ISO 8601 timestamp |
| `user_id` | string | User ID |
| `user_display_name` | string | User display name |
| `user_avatar_url` | string | User avatar URL |
| `is_verified` | boolean | Is user verified |
| `post_url` | string | Post URL |
| `shortcode` | string | Post shortcode (for URL) |
| `is_reply` | boolean | Is this a reply |
| `parent_post_id` | string\|null | Parent post ID (if reply) |
| `thread_id` | string | Thread ID |
| `quoted_post` | object\|null | Quoted post data |
| `hashtags` | array | Array of hashtags |
| `mentions` | array | Array of mentions |
| `links` | array | Array of links |
| `media_type` | number | Media type (1=image, 2=video) |
| `video_duration` | number\|null | Video duration (seconds) |
| `view_count` | number | View count (if available) |

---

## 🏗️ Kiến trúc

### Extraction Strategy

Extractor sử dụng multi-strategy approach (theo thứ tự độ tin cậy):

1. **GraphQL Interception** (Most Reliable)
   - Intercept GraphQL network requests
   - Extract data từ responses
   - Resolve Relay `__ref` references
   - **Cải tiến mới**: Hỗ trợ extract từ nested structures như `text_post_app_thread.thread_items[].post` để lấy username và text content đầy đủ

2. **Relay Store** (Fallback)
   - Read từ `window.__relayStore` hoặc `window.__INITIAL_DATA__`
   - Parse normalized Relay store
   - Resolve composite keys (e.g., `threadId_userId`) để tìm user data và text content

3. **DOM Parsing** (Last Resort)
   - Parse rendered HTML elements
   - Extract data từ DOM attributes và text
   - **Cải tiến mới**: DOM fallback tự động chạy cho items thiếu username/text trước khi browser context đóng

### Feed Loading Analysis

Extractor tự động phân tích feed loading strategy:
- **SSR-preloaded**: Data có sẵn trong initial HTML
- **GraphQL**: Data được fetch qua GraphQL API
- **Relay Store**: Data trong normalized Relay store

### Shortcode Encoding

Threads sử dụng **base64url** encoding để convert numeric `post_id` thành shortcode cho URLs:
- `post_id: 3821612401750661495` → `shortcode: DUJGDtLk1l3`
- Implementation trong `src/utils/shortcode-encoder.js`
- Auto-encode nếu shortcode không có trong raw data

---

## 🔧 Configuration

Tất cả configuration được tập trung trong `src/config.js`:

```javascript
export const CONFIG = {
  // Threads URLs
  threads: {
    url: 'https://www.threads.net',
    graphqlEndpointPatterns: [...],
    feedQueryPatterns: [...]
  },
  
  // Browser settings
  browser: {
    headless: false,
    navigationTimeout: 60000,
    waitForSelectorTimeout: 5000
  },
  
  // Scrolling behavior
  scroll: {
    delayMinMs: 800,
    delayMaxMs: 2000,
    incrementPx: 300,
    maxAttempts: 10
  },
  
  // Extraction settings
  extraction: {
    maxItems: null, // null = no limit
    extractMediaUrls: true,
    extractTimestamps: true,
    enableDebugLogging: false
  },
  
  // Filter criteria
  filter: {
    min_likes: null,
    max_likes: null,
    min_replies: null,
    min_reposts: null,
    min_shares: null,
    has_media: null,
    username: null,
    text_contains: null
  },
  
  // API settings
  api: {
    port: 3000,
    host: '0.0.0.0',
    cache: {
      enabled: true,
      ttl: 5 * 60 * 1000 // 5 minutes
    },
    cors: {
      enabled: true,
      origin: '*' // hoặc specific origins
    },
    // Account ID extraction configuration
    accountId: {
      parseJWT: false, // Set true để enable JWT parsing
      jwtSecret: process.env.JWT_SECRET || null, // Required nếu parseJWT = true
      customHeaders: [], // Custom header names để check
      logExtraction: false // Set true để log account ID extraction
    }
  },
  
  // Output settings
  output: {
    filename: 'output/threads_feed.json',
    filenameFiltered: 'output/threads_feed_filtered.json'
  },
  
  // Interactions Configuration (EXPERIMENTAL)
  interactions: {
    enabled: false, // Set true to enable interactions (violates read-only principle)
    login: {
      username: process.env.THREADS_USERNAME || null,
      password: process.env.THREADS_PASSWORD || null,
      sessionStoragePath: 'output/threads_session.json',
      autoLogin: true,
      loginTimeout: 60000
    },
    // ... other interaction settings
  }
};
```

---

## 🐛 Troubleshooting

### Browser không mở

1. Kiểm tra Playwright browsers đã cài:
   ```bash
   npx playwright install chromium
   ```

2. Thử chạy với headless mode:
   ```javascript
   // Trong src/config.js
   browser: { headless: true }
   ```

3. Kiểm tra quyền truy cập display (Linux/WSL):
   ```bash
   export DISPLAY=:0
   ```

### Lỗi "Chromium distribution 'chrome' is not found"

Script tự động fallback sang bundled Chromium. Đảm bảo đã cài Playwright browsers:
```bash
npx playwright install chromium
```

### Không extract được data

1. Kiểm tra network tab trong browser để xem GraphQL requests
2. Enable debug logging:
   ```javascript
   // Trong src/config.js
   extraction: { enableDebugLogging: true }
   ```
3. Kiểm tra selectors có còn đúng không (Threads có thể đã update UI)

### API server không start

1. Kiểm tra port 3000 có đang được dùng không:
   ```bash
   lsof -i :3000  # Linux/Mac
   netstat -ano | findstr :3000  # Windows
   ```

2. Thử đổi port trong `src/config.js`:
   ```javascript
   api: { port: 3001 }
   ```

### Cache không hoạt động

1. Kiểm tra cache enabled:
   ```bash
   curl http://localhost:3000/api/config
   ```

2. Clear cache thủ công:
   ```bash
   curl -X DELETE http://localhost:3000/api/cache
   ```

### Timeout errors (504 Gateway Timeout)

Timeout errors xảy ra khi request mất quá nhiều thời gian để hoàn thành. Mỗi loại operation có timeout riêng:

- **Feed extraction**: 5 phút (300000ms)
- **Interaction operations**: 2 phút (120000ms)
- **Quick operations**: 30 giây (30000ms)
- **Bulk operations**: 10 phút (600000ms)

**Cấu hình timeout:**

Timeout values có thể được cấu hình trong `src/config.js`:

```javascript
api: {
  timeout: {
    default: 300000,        // 5 minutes default
    feedExtraction: 300000, // 5 minutes for feed extraction
    quickOperation: 30000,  // 30 seconds for quick operations
    interaction: 120000,    // 2 minutes for interactions
    bulkOperation: 600000   // 10 minutes for bulk operations
  }
}
```

**Nếu gặp timeout thường xuyên:**

1. **Kiểm tra kết nối mạng:**
   - Đảm bảo kết nối internet ổn định
   - Kiểm tra firewall/proxy settings

2. **Tăng timeout value:**
   - Tăng timeout trong config nếu operation thường mất nhiều thời gian
   - Ví dụ: Tăng `feedExtraction` lên 600000ms (10 phút) nếu feed lớn

3. **Giảm workload:**
   - Giảm `maxItems` khi extract feed
   - Giảm số lượng posts khi comment/browse

4. **Kiểm tra logs:**
   - Xem logs để xác định operation nào đang chậm
   - Timeout errors bao gồm thông tin về operation, timeout value, và elapsed time

**Timeout Error Response:**

```json
{
  "success": false,
  "error": "Operation \"feed_extraction\" timed out after 300000ms",
  "errorCode": "TIMEOUT_ERROR",
  "timeout": 300000,
  "operation": "feed_extraction",
  "elapsedTime": 300123,
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Timeout Handling Strategy:**

- Fail-fast: Operations sẽ fail ngay lập tức khi timeout, không retry
- Clear error messages: Timeout errors bao gồm đầy đủ context để debug
- Per-operation timeouts: Mỗi loại operation có timeout phù hợp với độ phức tạp

---

## 📝 Fragility Analysis

### Fragile Parts (dễ break khi Threads update)

- **DOM Selectors**: UI changes có thể break selectors
- **GraphQL Endpoint URLs**: Endpoints có thể thay đổi
- **GraphQL Query Names**: Query names có thể đổi
- **Window Global Variables**: Global variable names có thể đổi
- **Data Structure Paths**: Nested paths trong responses có thể thay đổi

### Stable Parts (ít thay đổi)

- **GraphQL Response Structure**: Relay edges/nodes pattern thường ổn định
- **Network Interception Approach**: Playwright network interception ổn định
- **Scrolling Behavior**: Human-like scrolling ít bị detect
- **Multi-strategy Fallback**: Architecture cho phép thêm strategies mới

### Adaptation Strategy

Khi extraction fails:
1. Check network tab để tìm GraphQL endpoints mới
2. Inspect `window` object để tìm global variables mới
3. Update selectors dựa trên DOM structure mới
4. Thêm extraction strategies mới mà không cần rewrite core logic

---

## 📄 License

MIT

---

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request.

---

## 📚 References

- [Playwright Documentation](https://playwright.dev/)
- [Threads Web](https://www.threads.net)
- [Relay Documentation](https://relay.dev/)

---

## ⚡ Quick Reference

```bash
# Python HTML Parser
source venv/bin/activate
python3 threads_parser.py

# Node.js CLI
npm run cli

# API Server
npm run api

# Test shortcode encoding
node scripts/test-encoding.js

# Example interactions (⚠️ requires interactions.enabled = true)
node examples/interact-example.js

# Example feed browsing and commenting (⚠️ requires interactions.enabled = true)
node examples/feed-browsing-example.js
```

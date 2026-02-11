# Threads API Documentation

Tài liệu API đầy đủ cho Threads Feed Extractor API Server.

## Mục lục

1. [Giới thiệu](#giới-thiệu)
2. [Cấu hình cơ bản](#cấu-hình-cơ-bản)
3. [Feed Endpoints](#feed-endpoints)
4. [Cache & System Endpoints](#cache--system-endpoints)
5. [Post Interaction Endpoints](#post-interaction-endpoints)
6. [User Interaction Endpoints](#user-interaction-endpoints)
7. [Feed Browsing Endpoints](#feed-browsing-endpoints)
8. [Tham khảo](#tham-khảo)
9. [Examples](#examples)

---

## Giới thiệu

Threads API Server cung cấp REST API để:
- Extract và filter feed data từ Threads
- Tương tác với posts (like, comment, repost, share)
- Tương tác hàng loạt với nhiều posts (bulk like, bulk comment)
- Tương tác với users (follow, unfollow)
- Browse feed và comment tự động

### Base URL

```
http://localhost:3000/api
```

Mặc định server chạy tại `http://0.0.0.0:3000` (hoặc port được cấu hình trong `CONFIG.api.port`).

### Response Format

Tất cả responses đều có format chuẩn:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },  // Optional
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Timeout Error Response (504):**
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

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `403` - Forbidden (interactions disabled)
- `404` - Not Found
- `500` - Internal Server Error
- `504` - Gateway Timeout (request timed out)

### Authentication

Một số endpoints yêu cầu đăng nhập trước:
- Sử dụng `POST /api/login` để đăng nhập
- Session được lưu tự động vào `output/threads_session.json` (hoặc `profile_threads/{accountId}/threads_session.json` nếu có account ID)
- Các request sau sẽ tự động sử dụng session đã lưu

### Multi-Account Support (Account ID)

API server hỗ trợ nhiều tài khoản với session riêng biệt. Account ID có thể được truyền qua:

1. **Query Parameter**: `?account_id=user123`
2. **Request Body**: `{"account_id": "user123"}`
3. **HTTP Header**: `X-Account-ID: user123` hoặc `account-id: user123`
4. **JWT Token**: Nếu enabled trong config, account ID sẽ được extract từ JWT token
5. **Custom Headers**: Có thể cấu hình custom headers trong `CONFIG.api.accountId.customHeaders`

**Session Storage:**
- Với account ID: `profile_threads/{accountId}/threads_session.json`
- Không có account ID: `output/threads_session.json` (default)

**Ví dụ:**
```bash
# Sử dụng query parameter
curl "http://localhost:3000/api/feed?account_id=user123"

# Sử dụng header
curl -H "X-Account-ID: user123" "http://localhost:3000/api/feed"

# Sử dụng trong request body
curl -X POST "http://localhost:3000/api/feed/refresh" \
  -H "Content-Type: application/json" \
  -d '{"account_id": "user123", "min_likes": 100}'
```

### Browser Profile Path (Client-Side Profile)

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

# Sử dụng trong request body
curl -X POST "http://localhost:3000/api/feed/refresh" \
  -H "Content-Type: application/json" \
  -d '{"profile_path": "/home/user/browser_profiles/my_profile", "min_likes": 100}'

# Sử dụng profile_id trong request body
curl -X POST "http://localhost:3000/api/feed/refresh" \
  -H "Content-Type: application/json" \
  -d '{"profile_id": "account_01", "base_directory": "/home/user/profiles", "min_likes": 100}'

# Kết hợp account_id và profile_path
curl "http://localhost:3000/api/feed?account_id=user123&profile_path=/home/user/profiles/user123"

# Kết hợp account_id và profile_id
curl "http://localhost:3000/api/feed?account_id=user123&profile_id=user123&base_directory=/home/user/profiles"
```

**Cấu hình:**
- `CONFIG.browser.persistentProfile.enabled` - Tắt mặc định (false) để không tự động tạo profile
- `CONFIG.browser.persistentProfile.requireExplicitPath` - Yêu cầu client phải chỉ định path rõ ràng (true)

---

## Cấu hình cơ bản

### Khởi động Server

```bash
npm run api
# Hoặc
node api_server.js
```

### Cấu hình

Các cấu hình quan trọng trong `src/config.js`:

- `CONFIG.api.port` - Port của API server (mặc định: 3000)
- `CONFIG.api.cache.enabled` - Bật/tắt cache
- `CONFIG.api.cache.ttl` - Thời gian cache (mặc định: 5 phút)
- `CONFIG.interactions.enabled` - Bật/tắt interaction endpoints
- `CONFIG.api.accountId.parseJWT` - Bật/tắt JWT token parsing cho account ID
- `CONFIG.api.accountId.jwtSecret` - JWT secret (required nếu parseJWT = true)
- `CONFIG.api.accountId.customHeaders` - Custom headers để extract account ID
- `CONFIG.api.accountId.logExtraction` - Log account ID extraction cho debugging
- `CONFIG.browser.persistentProfile.enabled` - Bật/tắt persistent profile (mặc định: false)
- `CONFIG.browser.persistentProfile.requireExplicitPath` - Yêu cầu client chỉ định profile path (mặc định: true)

---

## Feed Endpoints

### GET /api/feed

Lấy feed items với optional filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `min_likes` | number | Minimum like count |
| `max_likes` | number | Maximum like count |
| `min_replies` | number | Minimum reply count |
| `min_reposts` | number | Minimum repost count |
| `min_shares` | number | Minimum share count |
| `max_shares` | number | Maximum share count |
| `has_media` | boolean | Chỉ lấy posts có media (images/videos) |
| `username` | string | Filter theo username (exact match) |
| `text_contains` | string | Filter posts chứa text này |
| `after_timestamp` | number | Posts sau timestamp (Unix seconds) |
| `before_timestamp` | number | Posts trước timestamp (Unix seconds) |
| `limit` | number | Giới hạn số lượng items |
| `refresh` | boolean | Force refresh (bỏ qua cache) |
| `account_id` | string | Account ID cho multi-account support (optional) |
| `profile_path` | string | Browser profile path (client-side, optional) |
| `profile_dir` | string | Alias cho `profile_path` (optional) |

**Example Request:**
```bash
curl "http://localhost:3000/api/feed?min_likes=200&has_media=true&limit=10"
```

**Example Response:**
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
    "cacheExpiresAt": "2026-01-31T09:06:38.558Z"
  }
}
```

**Notes:**
- Nếu cache còn valid và không có `refresh=true`, sẽ trả về cached data
- Cache TTL mặc định: 5 phút
- Filter được áp dụng sau khi extract data
- Cache được tách biệt theo account ID (nếu có)
- Account ID có thể được truyền qua query param `account_id`, header `X-Account-ID`, hoặc request body

---

### GET /api/feed/:postId

Lấy một post cụ thể theo ID.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Example Request:**
```bash
curl "http://localhost:3000/api/feed/3817952812169631580"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "post_id": "3817952812169631580",
    "username": "may__lily",
    "text": "Post content...",
    "like_count": 11476,
    ...
  },
  "meta": {
    "cached": true
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Post with ID 3817952812169631580 not found"
}
```

**Notes:**
- Tìm trong cache trước, nếu không có thì extract fresh data
- Nếu không tìm thấy trong feed, trả về 404

---

### GET /api/user/:username/posts

Lấy posts từ profile của một user.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (có thể có hoặc không có @ prefix) |

**Query Parameters:** (giống như `GET /api/feed`)

**Example Request:**
```bash
# Lấy posts từ user
curl "http://localhost:3000/api/user/may__lily/posts?min_likes=100&has_media=true&limit=20"

# Username có @ prefix cũng được
curl "http://localhost:3000/api/user/@may__lily/posts"
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "post_id": "3817952812169631580",
      "username": "may__lily",
      ...
    }
  ],
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

**Error Response (400):**
```json
{
  "success": false,
  "error": "Username is required"
}
```

**Notes:**
- Cache được lưu riêng cho từng user và filter criteria
- Có thể clear cache cho user cụ thể: `DELETE /api/cache?username=may__lily`
- Username sẽ được tự động loại bỏ @ prefix nếu có

---

### POST /api/feed/refresh

Force refresh feed data (bỏ qua cache).

**Request Body (optional):**
```json
{
  "min_likes": 200,
  "has_media": true,
  "limit": 50
}
```

**Query Parameters:** (giống như `GET /api/feed`)

**Example Request:**
```bash
# Dùng query parameters
curl -X POST "http://localhost:3000/api/feed/refresh?min_likes=200&limit=50"

# Dùng request body
curl -X POST "http://localhost:3000/api/feed/refresh" \
  -H "Content-Type: application/json" \
  -d '{"min_likes": 200, "limit": 50}'
```

**Example Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 50,
    "filtered": 30,
    "cached": false,
    "lastUpdated": "2026-01-31T09:30:00.000Z",
    "cacheExpiresAt": "2026-01-31T09:35:00.000Z"
  }
}
```

**Notes:**
- Luôn extract fresh data, bỏ qua cache
- Cache sẽ được update sau khi extract xong

---

## Cache & System Endpoints

### GET /api/health

Health check endpoint.

**Example Request:**
```bash
curl "http://localhost:3000/api/health"
```

**Example Response:**
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

---

### DELETE /api/cache

Xóa cache thủ công.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | (Optional) Chỉ xóa cache cho user cụ thể |

**Example Request:**
```bash
# Xóa tất cả cache
curl -X DELETE "http://localhost:3000/api/cache"

# Xóa cache cho user cụ thể
curl -X DELETE "http://localhost:3000/api/cache?username=may__lily"
```

**Example Response:**
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

---

### GET /api/stats

Lấy thống kê về feed data và cache.

**Example Request:**
```bash
curl "http://localhost:3000/api/stats"
```

**Example Response:**
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
        "totalUsers": 3,
        "totalItems": 45,
        "entries": [
          {
            "username": "may__lily",
            "itemCount": 15,
            "age": 60000,
            "ageFormatted": "60s"
          }
        ]
      },
      "ttl": 300000,
      "ttlFormatted": "300s"
    },
    "extraction": {
      "maxItems": 500,
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
      "itemsWithMedia": 20,
      "itemsWithTimestamps": 27,
      "uniqueUsernames": 15,
      "engagement": {
        "totalLikes": 50000,
        "totalReplies": 500,
        "totalReposts": 1000,
        "averageLikes": 1851,
        "averageReplies": 18,
        "averageReposts": 37
      }
    }
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### GET /api/config

Lấy cấu hình hiện tại (non-sensitive).

**Example Request:**
```bash
curl "http://localhost:3000/api/config"
```

**Example Response:**
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
      "maxItems": 500,
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
      "delayMinMs": 500,
      "delayMaxMs": 2000,
      "incrementPx": 500,
      "maxAttempts": 10
    },
    "interactions": {
      "enabled": true
    }
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

## Profile Management Endpoints

Quản lý browser profiles (client-side storage). Tất cả profiles được lưu ở phía client, server chỉ sử dụng paths mà client cung cấp.

### GET /api/profiles

List tất cả profiles có sẵn trong base directory mà client chỉ định.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_directory` | string (required) | Base directory path trên máy client để scan profiles |

**Example Request:**
```bash
curl "http://localhost:3000/api/profiles?base_directory=/home/user/profiles"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "profile_id": "account_01",
        "path": "/home/user/profiles/account_01",
        "full_path": "/home/user/profiles/account_01",
        "exists": true,
        "size": 12345678,
        "created_at": "2026-01-31T09:00:00.000Z",
        "has_session": true
      },
      {
        "profile_id": "user123",
        "path": "/home/user/profiles/user123",
        "full_path": "/home/user/profiles/user123",
        "exists": true,
        "size": 8765432,
        "created_at": "2026-01-30T15:30:00.000Z",
        "has_session": false
      }
    ],
    "total": 2,
    "base_directory": "/home/user/profiles"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- `base_directory` có thể được truyền qua query parameter, request body, hoặc header `X-Base-Directory`
- Profiles được sắp xếp theo thời gian tạo (mới nhất trước)
- `has_session` cho biết profile có file session đã lưu hay chưa

---

### GET /api/profiles/:profileId

Get thông tin chi tiết về một profile cụ thể.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `profileId` | string | Profile ID (tên thư mục) |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_directory` | string (required) | Base directory path trên máy client |

**Example Request:**
```bash
curl "http://localhost:3000/api/profiles/account_01?base_directory=/home/user/profiles"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "profile_id": "account_01",
    "path": "/home/user/profiles/account_01",
    "full_path": "/home/user/profiles/account_01",
    "exists": true,
    "size": 12345678,
    "created_at": "2026-01-31T09:00:00.000Z",
    "has_session": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

## Post Interaction Endpoints

⚠️ **CẢNH BÁO:** Các endpoints này vi phạm nguyên tắc read-only và yêu cầu `CONFIG.interactions.enabled = true`.

### POST /api/login

Đăng nhập vào Threads (cần thiết để sử dụng like/comment).

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Query Parameters (alternative):**
- `username` (string, required) - Username hoặc email
- `password` (string, required) - Password

**Example Request:**
```bash
# Dùng request body
curl -X POST "http://localhost:3000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# Dùng query parameters
curl -X POST "http://localhost:3000/api/login?username=your_username&password=your_password"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Login successful",
    "alreadyLoggedIn": false
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Username and password are required"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.",
  "warning": "⚠️ This feature violates the read-only principle of this tool. Use at your own risk."
}
```

**Notes:**
- Session sẽ được lưu tự động vào `output/threads_session.json` (hoặc `profile_threads/{accountId}/threads_session.json` nếu có account ID)
- Lần request sau sẽ tự động sử dụng session đã lưu
- Nếu session hết hạn, cần login lại
- Account ID có thể được truyền qua query param, body, hoặc header để sử dụng session riêng cho từng account
- Profile path có thể được truyền qua query param `profile_path`, header `X-Profile-Path`, hoặc request body để chỉ định browser profile path (client-side)

---

### POST /api/login/bulk

Đăng nhập hàng loạt tài khoản. Mỗi tài khoản sẽ tự động tạo profile riêng trong base directory mà client chỉ định (client-side storage).

**Request Body:**
```json
{
  "base_directory": "/home/user/profiles",
  "accounts": [
    {
      "username": "user1",
      "password": "pass1",
      "account_id": "account_01"
    },
    {
      "username": "user2",
      "password": "pass2",
      "account_id": "account_02"
    }
  ],
  "options": {
    "continue_on_error": true,
    "delay_between_logins": 5000
  }
}
```

**Query Parameters (alternative):**
- `base_directory` (string) - Có thể truyền qua query param thay vì body

**Request Body Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `base_directory` | string (required) | Base directory path trên máy client để lưu profiles |
| `accounts` | array (required) | Danh sách tài khoản cần đăng nhập |
| `accounts[].username` | string (required) | Username hoặc email |
| `accounts[].password` | string (required) | Password |
| `accounts[].account_id` | string (optional) | Account ID (nếu không có sẽ tự động tạo từ username) |
| `options.continue_on_error` | boolean | Tiếp tục với account tiếp theo nếu một account fail (default: true) |
| `options.delay_between_logins` | number | Delay giữa các lần đăng nhập (ms, default: 5000) |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/login/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "base_directory": "/home/user/profiles",
    "accounts": [
      {"username": "user1", "password": "pass1", "account_id": "account_01"},
      {"username": "user2", "password": "pass2", "account_id": "account_02"}
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_logins": 5000
    }
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "base_directory": "/home/user/profiles",
    "results": [
      {
        "account_id": "account_01",
        "username": "user1",
        "success": true,
        "message": "Login successful",
        "already_logged_in": false,
        "profile_path": "/home/user/profiles/account_01"
      },
      {
        "account_id": "account_02",
        "username": "user2",
        "success": true,
        "message": "Login successful",
        "already_logged_in": false,
        "profile_path": "/home/user/profiles/account_02"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "base_directory is required. Provide it via query parameter, request body, or X-Base-Directory header."
}
```

**Notes:**
- Mỗi account sẽ được đăng nhập tuần tự (không parallel để tránh rate limiting)
- Profile được tạo tại `{base_directory}/{account_id}` trên máy client
- Session được lưu tự động vào profile của mỗi account
- Nếu `continue_on_error = false`, sẽ dừng ngay khi một account fail
- `delay_between_logins` giúp tránh rate limiting từ Threads
- Account ID sẽ được tự động tạo từ username nếu không được cung cấp

---

### POST /api/post/:postId/like

Like một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | (Optional) Username để tạo post URL |
| `shortcode` | string | (Optional) Shortcode để tạo post URL |
| `postUrl` | string | (Optional) URL trực tiếp của post (ưu tiên cao nhất) |
| `account_id` | string | (Optional) Account ID cho multi-account support |
| `profile_path` | string | (Optional) Browser profile path (client-side) |
| `profile_dir` | string | (Optional) Alias cho `profile_path` |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/like?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
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

**Notes:**
- Cần đăng nhập trước (`POST /api/login`)
- Nếu post đã được like, `alreadyLiked` sẽ là `true`

---

### DELETE /api/post/:postId/like

Unlike một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:** (giống như `POST /api/post/:postId/like`)

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/post/3817952812169631580/like?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Post unliked successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### POST /api/post/:postId/comment

Comment trên một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Request Body:**
```json
{
  "comment": "Great post! 👍",
  "username": "may__lily",
  "shortcode": "DT8F9qykxdc"
}
```

**Query Parameters (alternative):**
- `comment` (string, required) - Comment text
- `username` (string, optional) - Username để tạo post URL
- `shortcode` (string, optional) - Shortcode để tạo post URL
- `postUrl` (string, optional) - URL trực tiếp của post

**Example Request:**
```bash
# Dùng request body
curl -X POST "http://localhost:3000/api/post/3817952812169631580/comment" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Great post! 👍", "username": "may__lily", "shortcode": "DT8F9qykxdc"}'

# Dùng query parameters
curl -X POST "http://localhost:3000/api/post/3817952812169631580/comment?comment=Great%20post!"
```

**Example Response:**
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

**Error Response (400):**
```json
{
  "success": false,
  "error": "Comment text is required"
}
```

---

### POST /api/posts/bulk-like

Like hàng loạt nhiều posts từ danh sách post IDs.

⚠️ **CẢNH BÁO:** Endpoint này vi phạm nguyên tắc read-only và yêu cầu `CONFIG.interactions.enabled = true`.

**Request Body:**
```json
{
  "posts": [
    {
      "postId": "3817952812169631580",
      "username": "may__lily",
      "shortcode": "DT8F9qykxdc",
      "postUrl": "https://www.threads.net/@may__lily/post/DT8F9qykxdc"
    },
    {
      "postId": "3817952812169631581",
      "username": "another_user"
    }
  ],
  "options": {
    "continue_on_error": true,
    "delay_between_likes": 3000
  }
}
```

**Request Body Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `posts` | array (required) | Danh sách posts cần like |
| `posts[].postId` | string (required) | Post ID |
| `posts[].username` | string (optional) | Username để tạo post URL |
| `posts[].shortcode` | string (optional) | Shortcode để tạo post URL |
| `posts[].postUrl` | string (optional) | URL trực tiếp của post (ưu tiên cao nhất) |
| `options.continue_on_error` | boolean | Tiếp tục với post tiếp theo nếu một post fail (default: true) |
| `options.delay_between_likes` | number | Delay giữa các lần like (ms, default: 3000) |

**Query Parameters (Additional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string (optional) | Account ID cho multi-account support |
| `profile_path` | string (optional) | Browser profile path (client-side) |
| `profile_dir` | string (optional) | Alias cho `profile_path` |
| `profile_id` | string (optional) | Profile ID (cần kèm `base_directory`) |
| `base_directory` | string (optional) | Base directory cho profile ID |

**Example Request:**
```bash
# Basic request
curl -X POST "http://localhost:3000/api/posts/bulk-like" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "shortcode": "DT8F9qykxdc"
      },
      {
        "postId": "3817952812169631581",
        "username": "another_user"
      }
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_likes": 3000
    }
  }'

# With account ID and profile path
curl -X POST "http://localhost:3000/api/posts/bulk-like?account_id=user123&profile_path=/home/user/profiles/user123" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {"postId": "3817952812169631580", "username": "may__lily"}
    ],
    "options": {
      "delay_between_likes": 3000
    }
  }'
```

**Example Response (Success):**
```json
{
  "success": true,
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "results": [
      {
        "postId": "3817952812169631580",
        "success": true,
        "alreadyLiked": false,
        "message": "Post liked successfully"
      },
      {
        "postId": "3817952812169631581",
        "success": true,
        "alreadyLiked": true,
        "message": "Post already liked"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Example Response (Partial Success):**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      {
        "postId": "3817952812169631580",
        "success": true,
        "alreadyLiked": false,
        "message": "Post liked successfully"
      },
      {
        "postId": "3817952812169631581",
        "success": false,
        "error": "Post not found"
      },
      {
        "postId": "3817952812169631582",
        "success": true,
        "alreadyLiked": false,
        "message": "Post liked successfully"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "posts array is required and must not be empty"
}
```

Hoặc:
```json
{
  "success": false,
  "error": "Post at index 0 is missing required field: postId"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.",
  "warning": "⚠️ This feature violates the read-only principle of this tool. Use at your own risk."
}
```

**Error Response (504 - Timeout):**
```json
{
  "success": false,
  "error": "Operation \"bulk_like\" timed out after 600000ms",
  "errorCode": "TIMEOUT_ERROR",
  "timeout": 600000,
  "operation": "bulk_like",
  "elapsedTime": 600123,
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Cần đăng nhập trước (`POST /api/login`)
- Sử dụng một browser instance duy nhất cho tất cả operations
- Xử lý tuần tự từng post với delay giữa các requests
- Nếu `continue_on_error = false`, sẽ dừng ngay khi một post fail và trả về error
- Delay mặc định: 3000ms giữa các likes (có thể điều chỉnh)
- Timeout: Sử dụng `OPERATION_TYPES.BULK_OPERATION` (mặc định: 10 phút - 600000ms)
- Hỗ trợ multi-account: có thể truyền `account_id` qua query param, body, hoặc header
- Browser profile: có thể chỉ định `profile_path` để sử dụng profile cụ thể
- Rate limiting: Delay giữa các likes giúp tránh rate limiting từ Threads

---

### POST /api/posts/bulk-comment

Comment hàng loạt trên nhiều posts từ danh sách post IDs.

⚠️ **CẢNH BÁO:** Endpoint này vi phạm nguyên tắc read-only và yêu cầu `CONFIG.interactions.enabled = true`.

**Request Body:**
```json
{
  "posts": [
    {
      "postId": "3817952812169631580",
      "username": "may__lily",
      "shortcode": "DT8F9qykxdc",
      "comment": "Great post! 👍"
    },
    {
      "postId": "3817952812169631581",
      "comment": "Nice content!"
    },
    {
      "postId": "3817952812169631582"
      // Không có comment cụ thể, sẽ dùng commentTemplates
    }
  ],
  "options": {
    "continue_on_error": true,
    "delay_between_comments": 5000,
    "commentTemplates": [
      "Nice post! 👍",
      "Great content!",
      "Thanks for sharing!",
      "Love this! ❤️"
    ]
  }
}
```

**Request Body Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `posts` | array (required) | Danh sách posts cần comment |
| `posts[].postId` | string (required) | Post ID |
| `posts[].comment` | string (optional) | Comment text cho post này (nếu không có sẽ dùng commentTemplates) |
| `posts[].username` | string (optional) | Username để tạo post URL |
| `posts[].shortcode` | string (optional) | Shortcode để tạo post URL |
| `posts[].postUrl` | string (optional) | URL trực tiếp của post |
| `options.continue_on_error` | boolean | Tiếp tục với post tiếp theo nếu một post fail (default: true) |
| `options.delay_between_comments` | number | Delay giữa các lần comment (ms, default: 5000) |
| `options.commentTemplates` | array (optional) | Danh sách comment templates để chọn ngẫu nhiên (nếu post không có comment cụ thể) |

**Query Parameters (Additional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `account_id` | string (optional) | Account ID cho multi-account support |
| `profile_path` | string (optional) | Browser profile path (client-side) |
| `profile_dir` | string (optional) | Alias cho `profile_path` |
| `profile_id` | string (optional) | Profile ID (cần kèm `base_directory`) |
| `base_directory` | string (optional) | Base directory cho profile ID |

**Example Request:**
```bash
# Basic request với comment templates
curl -X POST "http://localhost:3000/api/posts/bulk-comment" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "shortcode": "DT8F9qykxdc",
        "comment": "Great post! 👍"
      },
      {
        "postId": "3817952812169631581"
      }
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_comments": 5000,
      "commentTemplates": ["Nice post!", "Great content!", "Thanks for sharing!"]
    }
  }'

# Với account ID và profile path
curl -X POST "http://localhost:3000/api/posts/bulk-comment?account_id=user123&profile_path=/home/user/profiles/user123" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {"postId": "3817952812169631580", "comment": "Great post!"}
    ],
    "options": {
      "delay_between_comments": 5000
    }
  }'
```

**Example Response (Success):**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "postId": "3817952812169631580",
        "success": true,
        "comment": "Great post! 👍",
        "message": "Comment posted successfully"
      },
      {
        "postId": "3817952812169631581",
        "success": true,
        "comment": "Nice content!",
        "message": "Comment posted successfully"
      },
      {
        "postId": "3817952812169631582",
        "success": true,
        "comment": "Thanks for sharing!",
        "message": "Comment posted successfully"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Example Response (Partial Success):**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      {
        "postId": "3817952812169631580",
        "success": true,
        "comment": "Great post! 👍",
        "message": "Comment posted successfully"
      },
      {
        "postId": "3817952812169631581",
        "success": false,
        "error": "Comment text is required",
        "comment": null
      },
      {
        "postId": "3817952812169631582",
        "success": true,
        "comment": "Nice post!",
        "message": "Comment posted successfully"
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "posts array is required and must not be empty"
}
```

Hoặc:
```json
{
  "success": false,
  "error": "Post at index 0 is missing required field: postId"
}
```

Hoặc:
```json
{
  "success": false,
  "error": "Post at index 1 is missing comment text and no commentTemplates provided"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.",
  "warning": "⚠️ This feature violates the read-only principle of this tool. Use at your own risk."
}
```

**Error Response (504 - Timeout):**
```json
{
  "success": false,
  "error": "Operation \"bulk_comment\" timed out after 600000ms",
  "errorCode": "TIMEOUT_ERROR",
  "timeout": 600000,
  "operation": "bulk_comment",
  "elapsedTime": 600123,
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Cần đăng nhập trước (`POST /api/login`)
- Mỗi post phải có `comment` text hoặc sử dụng `commentTemplates` (random selection)
- Nếu post không có `comment` cụ thể, sẽ chọn ngẫu nhiên từ `commentTemplates`
- Sử dụng một browser instance duy nhất cho tất cả operations
- Xử lý tuần tự từng post với delay giữa các requests
- Nếu `continue_on_error = false`, sẽ dừng ngay khi một post fail và trả về error
- Delay mặc định: 5000ms giữa các comments (có thể điều chỉnh)
- Timeout: Sử dụng `OPERATION_TYPES.BULK_OPERATION` (mặc định: 10 phút - 600000ms)
- Hỗ trợ multi-account: có thể truyền `account_id` qua query param, body, hoặc header
- Browser profile: có thể chỉ định `profile_path` để sử dụng profile cụ thể
- Rate limiting: Delay giữa các comments giúp tránh rate limiting từ Threads
- Comment templates: Hỗ trợ biến trong templates (ví dụ: `@{username}`, `{postText}`)

---

### POST /api/post/:postId/repost

Repost một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | (Optional) Username để tạo post URL |
| `shortcode` | string | (Optional) Shortcode để tạo post URL |
| `postUrl` | string | (Optional) URL trực tiếp của post |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/repost?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Post reposted successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### POST /api/post/:postId/quote

Quote một post với comment.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Request Body:**
```json
{
  "quote": "Quote text here",
  "username": "may__lily",
  "shortcode": "DT8F9qykxdc"
}
```

**Query Parameters (alternative):**
- `quote` (string, required) - Quote text
- `username` (string, optional) - Username để tạo post URL
- `shortcode` (string, optional) - Shortcode để tạo post URL
- `postUrl` (string, optional) - URL trực tiếp của post

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/quote" \
  -H "Content-Type: application/json" \
  -d '{"quote": "Great point!", "username": "may__lily", "shortcode": "DT8F9qykxdc"}'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Post quoted successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Quote text is required"
}
```

---

### DELETE /api/post/:postId/repost

Unrepost một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:** (giống như `POST /api/post/:postId/repost`)

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/post/3817952812169631580/repost?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Post unreposted successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### POST /api/post/:postId/share

Share một post.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `platform` | string | (Optional) Platform để share (default: 'copy') |
| `username` | string | (Optional) Username để tạo post URL |
| `shortcode` | string | (Optional) Shortcode để tạo post URL |
| `postUrl` | string | (Optional) URL trực tiếp của post |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/post/3817952812169631580/share?platform=copy&username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Post shared successfully",
    "platform": "copy"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### GET /api/post/:postId/interactions

Lấy trạng thái interactions cho một post (check nếu đã like, etc.).

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | (Optional) Username để tạo post URL |
| `shortcode` | string | (Optional) Shortcode để tạo post URL |
| `postUrl` | string | (Optional) URL trực tiếp của post |

**Example Request:**
```bash
curl "http://localhost:3000/api/post/3817952812169631580/interactions?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isLiked": true,
    "isReposted": false,
    "canComment": true,
    "canRepost": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Endpoint này không yêu cầu interactions enabled
- Có thể dùng để check status mà không cần đăng nhập

---

### GET /api/post/:postId/repost-status

Lấy trạng thái repost cho một post (check nếu đã repost).

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Post ID |

**Query Parameters:** (giống như `GET /api/post/:postId/interactions`)

**Example Request:**
```bash
curl "http://localhost:3000/api/post/3817952812169631580/repost-status?username=may__lily&shortcode=DT8F9qykxdc"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isReposted": false,
    "canRepost": true
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

## User Interaction Endpoints

⚠️ **CẢNH BÁO:** Các endpoints này vi phạm nguyên tắc read-only và yêu cầu `CONFIG.interactions.enabled = true`.

### POST /api/user/:username/follow

Follow một user.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (có thể có hoặc không có @ prefix) |

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/user/may__lily/follow"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "User followed successfully",
    "alreadyFollowing": false
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Cần đăng nhập trước (`POST /api/login`)
- Nếu đã follow, `alreadyFollowing` sẽ là `true`

---

### DELETE /api/user/:username/follow

Unfollow một user.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (có thể có hoặc không có @ prefix) |

**Example Request:**
```bash
curl -X DELETE "http://localhost:3000/api/user/may__lily/follow"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "User unfollowed successfully"
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### GET /api/user/:username/follow-status

Lấy trạng thái follow cho một user.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (có thể có hoặc không có @ prefix) |

**Example Request:**
```bash
curl "http://localhost:3000/api/user/may__lily/follow-status"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "isFollowing": true,
    "isFollowedBy": false,
    "isPrivate": false
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Endpoint này không yêu cầu interactions enabled
- Có thể dùng để check status mà không cần đăng nhập

---

## Feed Browsing Endpoints

⚠️ **CẢNH BÁO:** Các endpoints này vi phạm nguyên tắc read-only và yêu cầu `CONFIG.interactions.enabled = true`.

### POST /api/feed/browse-and-comment

Browse feed, filter posts, và comment tự động trên các posts đã lọc.

**Request Body:**
```json
{
  "filterCriteria": {
    "min_likes": 10,
    "has_media": true,
    "min_replies": 5
  },
  "maxPostsToComment": 5,
  "randomSelection": true,
  "commentTemplates": [
    "Nice post! 👍",
    "Great content!",
    "Thanks for sharing!"
  ],
  "commentDelayMin": 5000,
  "commentDelayMax": 15000,
  "targetUrl": "https://www.threads.net",
  "maxItems": 50
}
```

**Query Parameters (alternative):**
- `min_likes`, `max_likes`, `has_media`, `min_replies`, etc. - Filter criteria
- `maxPostsToComment` (number) - Maximum posts để comment
- `randomSelection` (boolean) - Chọn posts ngẫu nhiên
- `commentDelayMin` (number) - Delay tối thiểu giữa các comments (ms)
- `commentDelayMax` (number) - Delay tối đa giữa các comments (ms)
- `maxItems` (number) - Maximum items để extract từ feed

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/feed/browse-and-comment" \
  -H "Content-Type: application/json" \
  -d '{
    "filterCriteria": {
      "min_likes": 10,
      "has_media": true
    },
    "maxPostsToComment": 5,
    "randomSelection": true,
    "commentTemplates": ["Nice post!", "Great content!"],
    "maxItems": 50
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
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
      },
      {
        "postId": "3817952812169631581",
        "username": "user2",
        "text": "Another post...",
        "success": false,
        "error": "Rate limit exceeded",
        "comment": null
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Comment templates có thể sử dụng biến: `{username}`, `{@username}`, `{postText}`
- Ví dụ: `"Great post @{username}!"` → `"Great post @may__lily!"`
- Process có thể mất vài phút tùy vào số lượng posts

---

### POST /api/user/:username/comment-posts

Comment trên posts từ một user cụ thể.

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (có thể có hoặc không có @ prefix) |

**Request Body:**
```json
{
  "filterCriteria": {
    "min_likes": 10,
    "has_media": true
  },
  "maxPostsToComment": 3,
  "randomSelection": true,
  "commentTemplates": [
    "Nice post! 👍",
    "Great content!"
  ],
  "commentDelayMin": 5000,
  "commentDelayMax": 15000,
  "maxItems": 20
}
```

**Query Parameters (alternative):** (giống như `POST /api/feed/browse-and-comment`)

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/user/may__lily/comment-posts" \
  -H "Content-Type: application/json" \
  -d '{
    "filterCriteria": {
      "min_likes": 10
    },
    "maxPostsToComment": 3,
    "randomSelection": true,
    "maxItems": 20
  }'
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "username": "may__lily",
    "totalExtracted": 20,
    "totalFiltered": 8,
    "totalCommented": 3,
    "successful": 3,
    "failed": 0,
    "results": [...]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

---

### POST /api/feed/select-user-and-comment

Chọn một user từ feed và comment trên các posts của user đó.

**Request Body:**
```json
{
  "username": "may__lily",
  "filterCriteria": {
    "min_likes": 10
  },
  "maxPostsToComment": 3,
  "randomSelection": true,
  "commentTemplates": ["Nice post!", "Great content!"],
  "commentDelayMin": 5000,
  "commentDelayMax": 15000,
  "targetUrl": "https://www.threads.net",
  "maxItems": 50,
  "userMaxItems": 20
}
```

**Query Parameters (alternative):**
- `username` (string) - Username cụ thể để chọn (optional, null = random)
- `min_likes`, `has_media`, etc. - Filter criteria
- `maxPostsToComment` (number) - Maximum posts để comment
- `randomSelection` (boolean) - Chọn posts ngẫu nhiên
- `commentTemplates` (array) - Array of comment templates (optional)
- `commentDelayMin` (number) - Minimum delay between comments (ms)
- `commentDelayMax` (number) - Maximum delay between comments (ms)
- `targetUrl` (string) - Target URL cho feed extraction
- `maxItems` (number) - Maximum items để extract từ feed
- `userMaxItems` (number) - Maximum items để extract từ user profile (optional)

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/feed/select-user-and-comment" \
  -H "Content-Type: application/json" \
  -d '{
    "username": null,
    "filterCriteria": {
      "min_likes": 10
    },
    "maxPostsToComment": 3,
    "randomSelection": true,
    "commentTemplates": ["Nice post!", "Great content!"],
    "commentDelayMin": 5000,
    "commentDelayMax": 15000,
    "maxItems": 50,
    "userMaxItems": 20
  }'
```

Hoặc với query parameters:
```bash
curl -X POST "http://localhost:3000/api/feed/select-user-and-comment?min_likes=10&maxPostsToComment=3&randomSelection=true&maxItems=50&userMaxItems=20"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "selectedUsername": "may__lily",
    "totalExtracted": 20,
    "totalFiltered": 8,
    "totalCommented": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "text": "Post content...",
        "success": true,
        "comment": "Nice post!",
        "error": null
      }
    ]
  },
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": "Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.",
  "warning": "⚠️ This feature violates the read-only principle of this tool. Use at your own risk."
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "No users found in feed"
}
```

**Error Response (504 - Timeout):**
```json
{
  "success": false,
  "error": "Operation \"select_user_and_comment\" timed out after 600000ms",
  "errorCode": "TIMEOUT_ERROR",
  "timeout": 600000,
  "operation": "select_user_and_comment",
  "elapsedTime": 600123,
  "timestamp": "2026-01-31T09:30:00.000Z"
}
```

**Notes:**
- Nếu `username` là `null`, sẽ chọn user ngẫu nhiên từ feed
- Process sẽ extract feed trước, sau đó chọn user và comment
- `maxItems`: Giới hạn số posts extract từ feed để tìm users
- `userMaxItems`: Giới hạn số posts extract từ profile của user được chọn (optional, mặc định sử dụng `maxItems`)
- `commentTemplates`: Nếu không có comment cụ thể cho mỗi post, sẽ chọn ngẫu nhiên từ templates
- Timeout: Sử dụng `OPERATION_TYPES.INTERACTION` (mặc định: 10 phút - 600000ms)
- Hỗ trợ multi-account: có thể truyền `account_id` qua query param, body, hoặc header
- Browser profile: có thể chỉ định `profile_path` để sử dụng profile cụ thể

---

## Tham khảo

### Filter Criteria

Các filter criteria có thể sử dụng trong query parameters hoặc request body:

| Filter | Type | Description |
|--------|------|-------------|
| `min_likes` | number | Minimum like count |
| `max_likes` | number | Maximum like count |
| `min_replies` | number | Minimum reply count |
| `min_reposts` | number | Minimum repost count |
| `min_shares` | number | Minimum share count |
| `max_shares` | number | Maximum share count |
| `has_media` | boolean | Chỉ lấy posts có media (images/videos) |
| `username` | string | Filter theo username (exact match) |
| `text_contains` | string | Filter posts chứa text này |
| `after_timestamp` | number | Posts sau timestamp (Unix seconds) |
| `before_timestamp` | number | Posts trước timestamp (Unix seconds) |

**Example:**
```json
{
  "min_likes": 100,
  "max_likes": 10000,
  "has_media": true,
  "min_replies": 5,
  "text_contains": "threads"
}
```

---

### Post Data Structure

Cấu trúc dữ liệu của một post object:

```typescript
interface Post {
  // Basic info
  post_id: string;
  username: string;
  text: string | null;
  
  // Counts
  like_count: number;
  reply_count: number;
  repost_count: number;
  share_count: number;
  view_count: number;
  
  // Media
  media_urls: string[];
  media_type: number; // 1 = image, 2 = video, 8 = carousel, 19 = text-only
  video_duration: number | null;
  
  // Timestamps
  timestamp: number | null; // Unix timestamp (seconds)
  timestamp_iso: string | null; // ISO 8601 format
  
  // User info
  user_id: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  is_verified: boolean;
  
  // Post metadata
  post_url: string | null;
  shortcode: string | null;
  is_reply: boolean;
  parent_post_id: string | null;
  thread_id: string | null;
  quoted_post: object | null;
  
  // Text entities
  hashtags: string[];
  mentions: string[];
  links: string[];
}
```

**Media Types:**
- `1` - Image
- `2` - Video
- `8` - Carousel (multiple images/videos)
- `19` - Text-only post

---

### Error Codes

Các error codes và ý nghĩa:

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `403` | Forbidden - Interactions disabled |
| `404` | Not Found - Resource not found |
| `500` | Internal Server Error |

**Common Errors:**

1. **Interactions Disabled:**
```json
{
  "success": false,
  "error": "Interactions are disabled. Set CONFIG.interactions.enabled = true to use this feature.",
  "warning": "⚠️ This feature violates the read-only principle of this tool. Use at your own risk."
}
```

2. **Missing Parameters:**
```json
{
  "success": false,
  "error": "Comment text is required"
}
```

3. **Not Found:**
```json
{
  "success": false,
  "error": "Post with ID 3817952812169631580 not found"
}
```

4. **Timeout Error:**
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

**Timeout Configuration:**

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

**Timeout Behavior:**

- Tất cả API endpoints đều có timeout protection
- Timeout được áp dụng ở middleware level và route handler level
- Khi timeout xảy ra, request sẽ fail ngay lập tức (fail-fast strategy)
- Timeout errors bao gồm thông tin chi tiết về operation, timeout value, và elapsed time

---

### Authentication

Để sử dụng interaction endpoints, cần đăng nhập trước:

1. **Login:**
```bash
curl -X POST "http://localhost:3000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

2. **Session Management:**
- Session được lưu tự động vào `output/threads_session.json`
- Các request sau sẽ tự động sử dụng session đã lưu
- Nếu session hết hạn, cần login lại

3. **Session Expiry:**
- Session có thể hết hạn sau một thời gian
- Nếu gặp lỗi "Session expired", cần login lại

---

### Rate Limiting

⚠️ **Lưu ý quan trọng:**

- Threads có thể áp dụng rate limiting cho các hành động tương tác
- Không nên thực hiện quá nhiều actions trong thời gian ngắn
- Sử dụng `commentDelayMin` và `commentDelayMax` để tránh rate limiting
- Nếu gặp rate limit, đợi một thời gian trước khi thử lại

**Recommendations:**
- Delay giữa các comments: 5-15 giây
- Delay giữa các likes: 2-5 giây
- Không comment trên quá nhiều posts cùng lúc

---

## Examples

### Example 1: Lấy feed với filter

```bash
# Lấy posts có >= 100 likes và có media
curl "http://localhost:3000/api/feed?min_likes=100&has_media=true&limit=20"
```

### Example 2: Like một post

```bash
# 1. Login trước
curl -X POST "http://localhost:3000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# 2. Like post
curl -X POST "http://localhost:3000/api/post/3817952812169631580/like?username=may__lily&shortcode=DT8F9qykxdc"
```

### Example 3: Comment với template có biến

```bash
curl -X POST "http://localhost:3000/api/feed/browse-and-comment" \
  -H "Content-Type: application/json" \
  -d '{
    "filterCriteria": {
      "min_likes": 50
    },
    "maxPostsToComment": 3,
    "commentTemplates": [
      "Great post @{username}! 👍",
      "Love this content from @{username}! ❤️"
    ],
    "maxItems": 30
  }'
```

### Example 4: Lấy posts từ user profile

```bash
curl "http://localhost:3000/api/user/may__lily/posts?min_likes=100&limit=10"
```

### Example 5: Check interaction status

```bash
# Không cần đăng nhập
curl "http://localhost:3000/api/post/3817952812169631580/interactions?username=may__lily&shortcode=DT8F9qykxdc"
```

### Example 6: JavaScript/Node.js Integration

```javascript
// Lấy feed với filter
const response = await fetch('http://localhost:3000/api/feed?min_likes=100&has_media=true&limit=20');
const data = await response.json();
console.log(data.data); // Array of posts

// Like một post
await fetch('http://localhost:3000/api/post/3817952812169631580/like?username=may__lily&shortcode=DT8F9qykxdc', {
  method: 'POST'
});

// Comment với template
await fetch('http://localhost:3000/api/feed/browse-and-comment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filterCriteria: { min_likes: 50 },
    maxPostsToComment: 3,
    commentTemplates: ['Great post! 👍'],
    maxItems: 30
  })
});
```

### Example 7: Python Integration

```python
import requests

# Lấy feed với filter
response = requests.get('http://localhost:3000/api/feed', params={
    'min_likes': 100,
    'has_media': True,
    'limit': 20
})
data = response.json()
print(data['data'])  # List of posts

# Like một post
requests.post('http://localhost:3000/api/post/3817952812169631580/like', params={
    'username': 'may__lily',
    'shortcode': 'DT8F9qykxdc'
})
```

### Example 8: Multi-Account Support

```bash
# Sử dụng account ID qua query parameter
curl "http://localhost:3000/api/feed?account_id=user123&min_likes=100"

# Sử dụng account ID qua header
curl -H "X-Account-ID: user123" "http://localhost:3000/api/feed"

# Login với account ID cụ thể
curl -X POST "http://localhost:3000/api/login?account_id=user123" \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "pass1"}'

# Like post với account ID
curl -X POST "http://localhost:3000/api/post/3817952812169631580/like?account_id=user123&username=may__lily&shortcode=DT8F9qykxdc"
```

### Example 9: Profile Management

```bash
# List all profiles in a directory
curl "http://localhost:3000/api/profiles?base_directory=/home/user/profiles"

# Get specific profile info
curl "http://localhost:3000/api/profiles/account_01?base_directory=/home/user/profiles"
```

```python
import requests

# List profiles
response = requests.get('http://localhost:3000/api/profiles', params={
    'base_directory': '/home/user/profiles'
})
profiles = response.json()['data']['profiles']
print(f"Found {len(profiles)} profiles")

# Get specific profile
response = requests.get('http://localhost:3000/api/profiles/account_01', params={
    'base_directory': '/home/user/profiles'
})
profile_info = response.json()['data']
print(f"Profile size: {profile_info['size']} bytes")
```

```javascript
// List profiles
const response = await fetch('http://localhost:3000/api/profiles?base_directory=/home/user/profiles');
const data = await response.json();
console.log(`Found ${data.data.total} profiles`);

// Get specific profile
const profileResponse = await fetch('http://localhost:3000/api/profiles/account_01?base_directory=/home/user/profiles');
const profileData = await profileResponse.json();
console.log('Profile info:', profileData.data);
```

### Example 10: Bulk Login

```bash
# Bulk login multiple accounts
curl -X POST "http://localhost:3000/api/login/bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "base_directory": "/home/user/profiles",
    "accounts": [
      {"username": "user1", "password": "pass1", "account_id": "account_01"},
      {"username": "user2", "password": "pass2", "account_id": "account_02"}
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_logins": 5000
    }
  }'
```

### Example 11: Bulk Like Multiple Posts

```bash
# Like hàng loạt nhiều posts
curl -X POST "http://localhost:3000/api/posts/bulk-like" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "shortcode": "DT8F9qykxdc"
      },
      {
        "postId": "3817952812169631581",
        "username": "another_user"
      },
      {
        "postId": "3817952812169631582",
        "postUrl": "https://www.threads.net/@user3/post/ABC123"
      }
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_likes": 3000
    }
  }'
```

```python
import requests

# Bulk like
response = requests.post('http://localhost:3000/api/posts/bulk-like', json={
    'posts': [
        {'postId': '3817952812169631580', 'username': 'may__lily', 'shortcode': 'DT8F9qykxdc'},
        {'postId': '3817952812169631581', 'username': 'another_user'}
    ],
    'options': {
        'continue_on_error': True,
        'delay_between_likes': 3000
    }
})

result = response.json()
print(f"Successful: {result['data']['successful']}/{result['data']['total']}")
for post_result in result['data']['results']:
    if post_result['success']:
        print(f"✓ Post {post_result['postId']}: {post_result['message']}")
    else:
        print(f"✗ Post {post_result['postId']}: {post_result.get('error', 'Failed')}")
```

```javascript
// Bulk like
const response = await fetch('http://localhost:3000/api/posts/bulk-like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    posts: [
      { postId: '3817952812169631580', username: 'may__lily', shortcode: 'DT8F9qykxdc' },
      { postId: '3817952812169631581', username: 'another_user' }
    ],
    options: {
      continue_on_error: true,
      delay_between_likes: 3000
    }
  })
});

const result = await response.json();
console.log(`Successful: ${result.data.successful}/${result.data.total}`);
result.data.results.forEach(post => {
  if (post.success) {
    console.log(`✓ Post ${post.postId}: ${post.message}`);
  } else {
    console.log(`✗ Post ${post.postId}: ${post.error}`);
  }
});
```

### Example 12: Bulk Comment Multiple Posts

```bash
# Comment hàng loạt trên nhiều posts
curl -X POST "http://localhost:3000/api/posts/bulk-comment" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "postId": "3817952812169631580",
        "username": "may__lily",
        "shortcode": "DT8F9qykxdc",
        "comment": "Great post! 👍"
      },
      {
        "postId": "3817952812169631581",
        "comment": "Nice content!"
      },
      {
        "postId": "3817952812169631582"
      }
    ],
    "options": {
      "continue_on_error": true,
      "delay_between_comments": 5000,
      "commentTemplates": [
        "Nice post! 👍",
        "Great content!",
        "Thanks for sharing!"
      ]
    }
  }'
```

```python
import requests

# Bulk comment với templates
response = requests.post('http://localhost:3000/api/posts/bulk-comment', json={
    'posts': [
        {'postId': '3817952812169631580', 'username': 'may__lily', 'comment': 'Great post! 👍'},
        {'postId': '3817952812169631581'},
        {'postId': '3817952812169631582'}
    ],
    'options': {
        'continue_on_error': True,
        'delay_between_comments': 5000,
        'commentTemplates': ['Nice post! 👍', 'Great content!', 'Thanks for sharing!']
    }
})

result = response.json()
print(f"Successful: {result['data']['successful']}/{result['data']['total']}")
for post_result in result['data']['results']:
    if post_result['success']:
        print(f"✓ Post {post_result['postId']}: {post_result['comment']}")
    else:
        print(f"✗ Post {post_result['postId']}: {post_result.get('error', 'Failed')}")
```

```javascript
// Bulk comment với templates
const response = await fetch('http://localhost:3000/api/posts/bulk-comment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    posts: [
      { postId: '3817952812169631580', username: 'may__lily', comment: 'Great post! 👍' },
      { postId: '3817952812169631581' },
      { postId: '3817952812169631582' }
    ],
    options: {
      continue_on_error: true,
      delay_between_comments: 5000,
      commentTemplates: ['Nice post! 👍', 'Great content!', 'Thanks for sharing!']
    }
  })
});

const result = await response.json();
console.log(`Successful: ${result.data.successful}/${result.data.total}`);
result.data.results.forEach(post => {
  if (post.success) {
    console.log(`✓ Post ${post.postId}: "${post.comment}"`);
  } else {
    console.log(`✗ Post ${post.postId}: ${post.error}`);
  }
});
```

```python
import requests

# Bulk login
response = requests.post('http://localhost:3000/api/login/bulk', json={
    'base_directory': '/home/user/profiles',
    'accounts': [
        {'username': 'user1', 'password': 'pass1', 'account_id': 'account_01'},
        {'username': 'user2', 'password': 'pass2', 'account_id': 'account_02'}
    ],
    'options': {
        'continue_on_error': True,
        'delay_between_logins': 5000
    }
})

result = response.json()
print(f"Successful: {result['data']['successful']}/{result['data']['total']}")
for account_result in result['data']['results']:
    if account_result['success']:
        print(f"✓ {account_result['username']}: {account_result['profile_path']}")
    else:
        print(f"✗ {account_result['username']}: {account_result.get('error', 'Failed')}")
```

```javascript
// Bulk login
const response = await fetch('http://localhost:3000/api/login/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base_directory: '/home/user/profiles',
    accounts: [
      { username: 'user1', password: 'pass1', account_id: 'account_01' },
      { username: 'user2', password: 'pass2', account_id: 'account_02' }
    ],
    options: {
      continue_on_error: true,
      delay_between_logins: 5000
    }
  })
});

const result = await response.json();
console.log(`Successful: ${result.data.successful}/${result.data.total}`);
result.data.results.forEach(account => {
  if (account.success) {
    console.log(`✓ ${account.username}: ${account.profile_path}`);
  } else {
    console.log(`✗ ${account.username}: ${account.error}`);
  }
});
```

### Example 13: Using Profile ID with Base Directory

```bash
# Use profile_id instead of full path (requires base_directory)
curl "http://localhost:3000/api/feed?base_directory=/home/user/profiles&profile_id=account_01"

# Or use headers
curl -H "X-Base-Directory: /home/user/profiles" \
     -H "X-Profile-Id: account_01" \
     "http://localhost:3000/api/feed"
```

```python
import requests

# Use profile_id with base_directory
response = requests.get('http://localhost:3000/api/feed', params={
    'base_directory': '/home/user/profiles',
    'profile_id': 'account_01',
    'min_likes': 100
})

# Or use headers
headers = {
    'X-Base-Directory': '/home/user/profiles',
    'X-Profile-Id': 'account_01'
}
response = requests.get('http://localhost:3000/api/feed', headers=headers)
```

### Example 14: Browser Profile Path (Client-Side Profile)

```bash
# Sử dụng profile path qua query parameter
curl "http://localhost:3000/api/feed?profile_path=/home/user/browser_profiles/my_profile"

# Sử dụng profile path qua header
curl -H "X-Profile-Path: /home/user/browser_profiles/my_profile" "http://localhost:3000/api/feed"

# Kết hợp account_id và profile_path
curl "http://localhost:3000/api/feed?account_id=user123&profile_path=/home/user/profiles/user123"

# Login với profile path
curl -X POST "http://localhost:3000/api/login" \
  -H "Content-Type: application/json" \
  -H "X-Profile-Path: /home/user/browser_profiles/my_profile" \
  -d '{"username": "user1", "password": "pass1"}'

# Like post với profile path
curl -X POST "http://localhost:3000/api/post/3817952812169631580/like?profile_path=/home/user/browser_profiles/my_profile&username=may__lily&shortcode=DT8F9qykxdc"
```

```python
import requests

# Sử dụng profile path qua query parameter
response = requests.get('http://localhost:3000/api/feed', params={
    'profile_path': '/home/user/browser_profiles/my_profile',
    'min_likes': 100
})

# Sử dụng profile path qua header
headers = {'X-Profile-Path': '/home/user/browser_profiles/my_profile'}
response = requests.get('http://localhost:3000/api/feed', headers=headers)

# Kết hợp account_id và profile_path
response = requests.get('http://localhost:3000/api/feed', params={
    'account_id': 'user123',
    'profile_path': '/home/user/profiles/user123'
})

# Login với profile path
response = requests.post('http://localhost:3000/api/login',
    headers={'X-Profile-Path': '/home/user/browser_profiles/my_profile'},
    json={'username': 'user1', 'password': 'pass1'}
)
```

```javascript
// Sử dụng profile path qua query parameter
const response = await fetch('http://localhost:3000/api/feed?profile_path=/home/user/browser_profiles/my_profile&min_likes=100');

// Sử dụng profile path qua header
const response = await fetch('http://localhost:3000/api/feed', {
  headers: {
    'X-Profile-Path': '/home/user/browser_profiles/my_profile'
  }
});

// Kết hợp account_id và profile_path
const response = await fetch('http://localhost:3000/api/feed?account_id=user123&profile_path=/home/user/profiles/user123');

// Login với profile path
await fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Profile-Path': '/home/user/browser_profiles/my_profile'
  },
  body: JSON.stringify({
    username: 'user1',
    password: 'pass1'
  })
});
```

```python
import requests

# Sử dụng account ID qua query parameter
response = requests.get('http://localhost:3000/api/feed', params={
    'account_id': 'user123',
    'min_likes': 100
})

# Sử dụng account ID qua header
headers = {'X-Account-ID': 'user123'}
response = requests.get('http://localhost:3000/api/feed', headers=headers)

# Login với account ID
response = requests.post('http://localhost:3000/api/login', 
    params={'account_id': 'user123'},
    json={'username': 'user1', 'password': 'pass1'}
)
```

```javascript
// Sử dụng account ID qua query parameter
const response = await fetch('http://localhost:3000/api/feed?account_id=user123&min_likes=100');

// Sử dụng account ID qua header
const response = await fetch('http://localhost:3000/api/feed', {
  headers: {
    'X-Account-ID': 'user123'
  }
});

// Login với account ID
await fetch('http://localhost:3000/api/login?account_id=user123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user1',
    password: 'pass1'
  })
});
```

---

## Troubleshooting

### Vấn đề thường gặp

1. **Interactions disabled error:**
   - Kiểm tra `CONFIG.interactions.enabled = true` trong `src/config.js`
   - Restart server sau khi thay đổi config

2. **Session expired:**
   - Login lại bằng `POST /api/login`
   - Session sẽ được lưu tự động

3. **Rate limiting:**
   - Tăng delay giữa các actions
   - Giảm số lượng actions trong một request
   - Đợi một thời gian trước khi thử lại

4. **Post not found:**
   - Kiểm tra post ID có đúng không
   - Thử refresh feed data bằng `POST /api/feed/refresh`

5. **Cache issues:**
   - Clear cache bằng `DELETE /api/cache`
   - Force refresh bằng `refresh=true` hoặc `POST /api/feed/refresh`

6. **Timeout errors (504):**
   - Timeout errors xảy ra khi request mất quá nhiều thời gian để hoàn thành
   - Mỗi loại operation có timeout riêng:
     - Feed extraction: 5 phút (300000ms)
     - Interaction operations: 2 phút (120000ms)
     - Quick operations: 30 giây (30000ms)
     - Bulk operations: 10 phút (600000ms)
   - Có thể cấu hình timeout trong `src/config.js`:
     ```javascript
     api: {
       timeout: {
         default: 300000,
         feedExtraction: 300000,
         quickOperation: 30000,
         interaction: 120000,
         bulkOperation: 600000
       }
     }
     ```
   - Nếu gặp timeout thường xuyên:
     - Kiểm tra kết nối mạng
     - Tăng timeout value trong config
     - Giảm số lượng items cần extract (`maxItems`)
     - Kiểm tra logs để xem operation nào đang chậm

---

## Changelog

### Version 1.2.0
- Added bulk operations endpoints:
  - `POST /api/posts/bulk-like` - Like hàng loạt nhiều posts từ danh sách post IDs
  - `POST /api/posts/bulk-comment` - Comment hàng loạt trên nhiều posts từ danh sách post IDs
- Bulk operations hỗ trợ:
  - Xử lý tuần tự với delay giữa các operations
  - Error handling với `continue_on_error` option
  - Comment templates cho bulk comment
  - Detailed results cho từng post
  - Timeout protection với `OPERATION_TYPES.BULK_OPERATION`

### Version 1.1.0
- Added multi-account support (Account ID extraction)
- Account ID can be passed via query params, body, headers, or JWT tokens
- Separate session storage per account (`profile_threads/{accountId}/`)
- JWT token parsing support (optional)
- Custom headers support for account ID extraction
- Updated all endpoints to support account isolation

### Version 1.0.0
- Initial API documentation
- Feed endpoints
- Cache & system endpoints
- Post interaction endpoints
- User interaction endpoints
- Feed browsing endpoints

---

## Support

Nếu gặp vấn đề hoặc có câu hỏi:
- Kiểm tra logs của server
- Xem `README.md` để biết thêm chi tiết
- Kiểm tra `src/config.js` để xem cấu hình

---

**Lưu ý:** API này được thiết kế cho mục đích nghiên cứu và học tập. Sử dụng có trách nhiệm và tuân thủ Terms of Service của Threads.

# KNI Library - Comprehensive Utility Collection

This directory contains a comprehensive collection of utility libraries for the KNI (Knowledge and Intelligence) platform. Each utility is designed to be modular, reusable, and production-ready.

## 📁 Directory Structure

```
src/lib/
├── index.ts                 # Main entry point and utility collection
├── README.md               # This documentation file
├── __tests__/              # Test files
│   └── auth.test.ts
│
├── analytics.ts            # Analytics and tracking utilities
├── api.ts                  # API handling and HTTP utilities
├── auth.ts                 # Authentication and authorization
├── backup.ts               # Database backup and restore
├── cache.ts                # Caching layer and Redis integration
├── config.ts               # Configuration management
├── database.ts             # Database utilities and ORM helpers
├── db.ts                   # Additional database utilities
├── deployment.ts           # Deployment automation
├── email.ts                # Email service integration
├── errors.ts               # Error handling and custom errors
├── external-api.ts         # External API integrations
├── feature-flags.ts        # Feature flag management
├── i18n.ts                 # Internationalization
├── logger.ts               # Logging utilities
├── monitoring.ts           # System monitoring and health checks
├── notification.ts         # Notification system
├── notifications.ts        # Additional notification utilities
├── performance.ts          # Performance monitoring
├── queue.ts                # Job queue management
├── realtime.ts             # Real-time communication
├── reporting.ts            # Report generation
├── search.ts               # Search functionality
├── security.ts             # Security utilities
├── testing.ts              # Testing utilities and helpers
├── upload.ts               # File upload handling
├── validation.ts           # Data validation
├── webhooks.ts             # Webhook management
└── workflow.ts             # Workflow automation
```

## 🚀 Quick Start

### Basic Usage

```typescript
// Import everything
import KNI from '@/lib'

// Or import specific utilities
import { services, utils } from '@/lib'
import { DatabaseService } from '@/lib/database'
import { ApiResponse } from '@/lib/api'
```

### Service Initialization

```typescript
import { initializeServices, shutdownServices } from '@/lib'

// Initialize all services
await initializeServices()

// Graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownServices()
  process.exit(0)
})
```

### Health Check

```typescript
import { healthCheck } from '@/lib'

const health = await healthCheck()
console.log('System status:', health.status)
console.log('Service details:', health.services)
```

## 📚 Core Utilities

### 🔧 Services

Pre-configured service instances ready to use:

```typescript
import { services } from '@/lib'

// Database operations
const users = await services.database.findMany('user', {
  where: { active: true }
})

// Cache operations
await services.cache.set('key', 'value', 3600)
const value = await services.cache.get('key')

// File uploads
const result = await services.upload.uploadFile(file, {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/jpeg', 'image/png']
})

// Send notifications
await services.notifications.send({
  userId: 'user123',
  type: 'email',
  template: 'welcome',
  data: { name: 'John Doe' }
})

// Analytics tracking
services.analytics.track('user_signup', {
  userId: 'user123',
  source: 'web'
})
```

### 🛠️ Utility Functions

Common utility functions for everyday tasks:

```typescript
import { utils } from '@/lib'

// String utilities
const slug = utils.string.slugify('Hello World!') // 'hello-world'
const id = utils.string.generateId(12) // Random 12-char ID
const truncated = utils.string.truncate('Long text...', 10)

// Date utilities
const formatted = utils.date.formatDate(new Date(), 'YYYY-MM-DD HH:mm')
const relative = utils.date.getRelativeTime(new Date(Date.now() - 3600000)) // '1h ago'
const future = utils.date.addDays(new Date(), 7)

// Array utilities
const chunks = utils.array.chunk([1,2,3,4,5,6], 2) // [[1,2], [3,4], [5,6]]
const unique = utils.array.unique([1,1,2,2,3]) // [1,2,3]
const sample = utils.array.sample([1,2,3,4,5], 2) // Random 2 items

// Object utilities
const picked = utils.object.pick(user, ['id', 'name', 'email'])
const merged = utils.object.deepMerge(defaults, userConfig)
const flattened = utils.object.flatten({ a: { b: { c: 1 } } }) // { 'a.b.c': 1 }

// Number utilities
const currency = utils.number.formatCurrency(1234.56) // '$1,234.56'
const percent = utils.number.formatPercent(0.1234) // '12.34%'
const clamped = utils.number.clamp(150, 0, 100) // 100

// Validation utilities
const isValidEmail = utils.validation.isEmail('user@example.com')
const isStrongPwd = utils.validation.isStrongPassword('MyStr0ng!Pass')
const isValidUrl = utils.validation.isUrl('https://example.com')

// File utilities
const extension = utils.file.getExtension('document.pdf') // 'pdf'
const mimeType = utils.file.getMimeType('image.jpg') // 'image/jpeg'
const size = utils.file.formatSize(1024000) // '1.0 MB'

// Async utilities
await utils.async.delay(1000) // Wait 1 second
const result = await utils.async.timeout(promise, 5000) // 5s timeout
const retried = await utils.async.retry(asyncFunction, 3) // Retry 3 times
```

## 📖 Individual Library Documentation

### Authentication (`auth.ts`)

Comprehensive authentication system with NextAuth.js integration:

```typescript
import { UserManager, SessionManager, RoleManager } from '@/lib/auth'

// User management
const user = await UserManager.createUser({
  email: 'user@example.com',
  password: 'securePassword',
  name: 'John Doe'
})

// Password reset
await UserManager.initiatePasswordReset('user@example.com')
await UserManager.resetPassword('reset-token', 'newPassword')

// Session management
const session = await SessionManager.createSession(userId, request)
await SessionManager.invalidateAllUserSessions(userId)

// Role-based access control
const hasAccess = RoleManager.hasPermission(user, 'admin:users:write')
await RoleManager.updateUserRole(userId, 'moderator')
```

### Database (`database.ts`)

Advanced database utilities with connection pooling, caching, and monitoring:

```typescript
import { DatabaseService } from '@/lib/database'

const db = DatabaseService.getInstance()

// Execute queries with caching and retries
const users = await db.findMany('user', {
  where: { active: true },
  include: { profile: true },
  cache: { ttl: 300 } // Cache for 5 minutes
})

// Transactions
await db.executeTransaction(async (tx) => {
  const user = await tx.user.create({ data: userData })
  await tx.profile.create({ data: { ...profileData, userId: user.id } })
  return user
})

// Pagination
const result = await db.paginate('post', {
  page: 1,
  limit: 20,
  where: { published: true },
  orderBy: { createdAt: 'desc' }
})

// Health monitoring
const health = await db.healthCheck()
const metrics = db.getMetrics()
```

### API Utilities (`api.ts`)

Robust API handling with rate limiting, validation, and error management:

```typescript
import { createApiHandler, ApiResponse } from '@/lib/api'

// Create protected API route
export default createApiHandler({
  requireAuth: true,
  requiredRole: 'user',
  rateLimit: { requests: 100, window: 3600 },
  validation: {
    body: z.object({
      title: z.string().min(1),
      content: z.string()
    })
  }
})(async (req, context) => {
  const { title, content } = req.body
  
  const post = await db.post.create({
    data: {
      title,
      content,
      authorId: context.user.id
    }
  })
  
  return ApiResponse.success(post, 'Post created successfully')
})

// Error handling
try {
  // API operation
} catch (error) {
  if (error instanceof ApiError) {
    return ApiResponse.error(error)
  }
  return ApiResponse.error(ApiErrors.InternalServerError)
}
```

### File Upload (`upload.ts`)

Secure file upload with validation, processing, and storage:

```typescript
import { FileUploadService } from '@/lib/upload'

const uploadService = FileUploadService.getInstance()

// Upload single file
const result = await uploadService.uploadFile(file, {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  generateThumbnails: true,
  watermark: {
    enabled: true,
    text: '© KNI Platform'
  }
})

// Upload multiple files
const results = await uploadService.uploadMultiple(files, options)

// Get file info
const fileInfo = await uploadService.getFileInfo(fileId)

// Delete file
await uploadService.deleteFile(fileId)
```

### Caching (`cache.ts`)

Multi-layer caching with Redis and in-memory fallback:

```typescript
import { CacheService } from '@/lib/cache'

const cache = new CacheService()

// Basic operations
await cache.set('user:123', userData, 3600) // 1 hour TTL
const user = await cache.get('user:123')
await cache.delete('user:123')

// Pattern operations
await cache.deletePattern('user:*')
const keys = await cache.getKeys('session:*')

// Advanced operations
const result = await cache.getOrSet('expensive-operation', async () => {
  return await performExpensiveOperation()
}, 1800) // Cache for 30 minutes

// Batch operations
const values = await cache.mget(['key1', 'key2', 'key3'])
await cache.mset({
  'key1': 'value1',
  'key2': 'value2'
}, 3600)
```

### Notifications (`notification.ts`)

Multi-channel notification system:

```typescript
import { NotificationService } from '@/lib/notification'

const notifications = NotificationService.getInstance()

// Send notification
await notifications.send({
  userId: 'user123',
  type: 'email',
  template: 'order-confirmation',
  data: {
    orderNumber: 'ORD-001',
    total: '$99.99'
  },
  priority: 'high'
})

// Bulk notifications
await notifications.sendBulk([
  { userId: 'user1', type: 'push', template: 'reminder' },
  { userId: 'user2', type: 'sms', template: 'alert' }
])

// Manage preferences
await notifications.updatePreferences('user123', {
  email: true,
  push: false,
  sms: true
})
```

### Workflow Automation (`workflow.ts`)

Powerful workflow engine for business process automation:

```typescript
import { WorkflowEngine } from '@/lib/workflow'

const workflows = WorkflowEngine.getInstance()

// Define workflow
const userOnboardingWorkflow = {
  id: 'user-onboarding',
  name: 'User Onboarding Process',
  steps: [
    {
      id: 'send-welcome-email',
      type: 'email',
      template: 'welcome',
      delay: 0
    },
    {
      id: 'setup-reminder',
      type: 'notification',
      template: 'setup-profile',
      delay: 24 * 60 * 60 * 1000 // 24 hours
    }
  ]
}

// Register workflow
await workflows.registerWorkflow(userOnboardingWorkflow)

// Start workflow instance
const instance = await workflows.startWorkflow('user-onboarding', {
  userId: 'user123',
  email: 'user@example.com'
})

// Monitor workflow
const status = await workflows.getWorkflowStatus(instance.id)
```

## 🔒 Security Features

- **Authentication**: JWT tokens, session management, password hashing
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Zod schema validation
- **File Security**: MIME type validation, virus scanning placeholder
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: Automatic security header injection

## 📊 Monitoring & Analytics

- **Health Checks**: Comprehensive system health monitoring
- **Performance Metrics**: Database query times, API response times
- **Error Tracking**: Structured error logging and reporting
- **Analytics**: User behavior tracking and insights
- **Alerts**: Automated alerting for system issues

## 🧪 Testing

Comprehensive testing utilities:

```typescript
import { TestingService } from '@/lib/testing'

const testing = TestingService.getInstance()

// Database testing
const testDb = await testing.createTestDatabase()
await testing.seedTestData(testDb)

// API testing
const response = await testing.makeRequest('/api/users', {
  method: 'POST',
  body: userData,
  headers: { authorization: `Bearer ${token}` }
})

// Cleanup
await testing.cleanup()
```

## 🚀 Deployment

Automated deployment utilities:

```typescript
import { DeploymentService } from '@/lib/deployment'

const deployment = DeploymentService.getInstance()

// Deploy application
await deployment.deploy({
  environment: 'production',
  version: '1.2.0',
  migrations: true,
  healthCheck: true
})

// Rollback
await deployment.rollback('1.1.0')
```

## 📈 Performance Optimization

- **Connection Pooling**: Efficient database connection management
- **Query Caching**: Automatic query result caching
- **Lazy Loading**: On-demand service initialization
- **Batch Operations**: Bulk database operations
- **Compression**: Response compression for APIs
- **CDN Integration**: Static asset optimization

## 🌐 Internationalization

Multi-language support:

```typescript
import { I18nService } from '@/lib/i18n'

const i18n = I18nService.getInstance()

// Translate text
const message = i18n.t('welcome.message', { name: 'John' })

// Format numbers and dates
const price = i18n.formatCurrency(99.99, 'USD')
const date = i18n.formatDate(new Date(), 'long')
```

## 🔧 Configuration

Environment-based configuration management:

```typescript
import { config } from '@/lib/config'

// Access configuration
const dbUrl = config.database.url
const apiKey = config.external.openai.apiKey
const features = config.features

// Feature flags
if (config.features.newDashboard) {
  // Show new dashboard
}
```

## 📝 Logging

Structured logging with multiple levels and outputs:

```typescript
import { logger } from '@/lib/logger'

// Log messages
logger.info('User logged in', { userId: 'user123' })
logger.error('Database connection failed', { error: error.message })
logger.debug('Processing request', { requestId: 'req-456' })

// Performance logging
logger.performance('api.users.create', 150, { userId: 'user123' })
```

## 🤝 Contributing

When adding new utilities:

1. Follow the existing patterns and conventions
2. Add comprehensive TypeScript types
3. Include error handling and logging
4. Write unit tests
5. Update this documentation
6. Export from `index.ts`

## 📄 License

This utility collection is part of the KNI platform and follows the project's licensing terms.

---

**Built with ❤️ for the KNI Platform**
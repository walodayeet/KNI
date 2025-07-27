# KNI Platform Development Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Architecture Overview](#architecture-overview)
5. [API Development](#api-development)
6. [Database Management](#database-management)
7. [Authentication & Authorization](#authentication--authorization)
8. [File Upload & Storage](#file-upload--storage)
9. [Real-time Features](#real-time-features)
10. [Testing Strategy](#testing-strategy)
11. [Performance Optimization](#performance-optimization)
12. [Security Best Practices](#security-best-practices)
13. [Deployment](#deployment)
14. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- PostgreSQL 13+ (or Docker)
- Redis (optional, for caching)
- Git

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd KNI
   ```

2. **Run the setup script**
   ```bash
   node setup.js
   ```
   This interactive script will:
   - Check prerequisites
   - Install dependencies
   - Set up environment variables
   - Configure database
   - Generate security secrets
   - Initialize services

3. **Start development server**
   ```bash
   npm run dev
   ```

### Manual Setup

If you prefer manual setup:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment configuration**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Database setup**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

## Project Structure

```
KNI/
├── src/
│   ├── app/                 # Next.js 13+ App Router
│   │   ├── (auth)/         # Authentication routes
│   │   ├── api/            # API routes
│   │   ├── dashboard/      # Dashboard pages
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components
│   │   ├── forms/         # Form components
│   │   └── layout/        # Layout components
│   ├── lib/               # Utility libraries
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── database.ts    # Database utilities
│   │   ├── api.ts         # API utilities
│   │   └── index.ts       # Centralized exports
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   └── middleware.ts      # Next.js middleware
├── prisma/                # Database schema and migrations
├── public/                # Static assets
├── docs/                  # Documentation
├── tests/                 # Test files
└── scripts/               # Build and deployment scripts
```

## Development Workflow

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Critical bug fixes
- `release/*` - Release preparation branches

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(auth): add OAuth2 integration
fix(api): resolve rate limiting issue
docs(readme): update installation guide
style(ui): improve button component styling
refactor(db): optimize query performance
test(auth): add unit tests for login flow
```

### Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Create and run migrations
npm run db:seed      # Seed database with sample data
npm run db:reset     # Reset database
npm run db:studio    # Open Prisma Studio

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:e2e     # Run end-to-end tests

# Utilities
npm run clean        # Clean build artifacts
npm run analyze      # Analyze bundle size
npm run security     # Security audit
```

## Architecture Overview

### Technology Stack

- **Frontend**: Next.js 13+ with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Backend**: Next.js API routes, Node.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with multiple providers
- **Caching**: Redis (optional)
- **File Storage**: Local filesystem, AWS S3, or Cloudinary
- **Real-time**: Socket.IO
- **Queue**: Bull Queue with Redis
- **Monitoring**: Sentry, custom analytics

### Core Principles

1. **Type Safety**: Full TypeScript coverage
2. **Performance**: Optimized for speed and scalability
3. **Security**: Security-first approach
4. **Modularity**: Reusable, composable components
5. **Testing**: Comprehensive test coverage
6. **Documentation**: Well-documented code and APIs

### Service Architecture

```mermaid
graph TB
    A[Client] --> B[Next.js App]
    B --> C[API Routes]
    C --> D[Service Layer]
    D --> E[Database]
    D --> F[Cache]
    D --> G[External APIs]
    D --> H[File Storage]
    D --> I[Queue System]
```

## API Development

### API Route Structure

```typescript
// src/app/api/users/route.ts
import { createApiHandler } from '@/lib/api'
import { z } from 'zod'

const getUsersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().optional()
})

export const GET = createApiHandler({
  requireAuth: true,
  requiredRole: 'admin',
  rateLimit: { requests: 100, window: '15m' },
  validation: {
    query: getUsersSchema
  }
})(async (req, { user, query }) => {
  const users = await getUserService().getUsers(query)
  return Response.success(users)
})
```

### Error Handling

```typescript
import { ApiError, ApiErrors } from '@/lib/api'

// Throw specific errors
throw new ApiError('User not found', 404, 'USER_NOT_FOUND')

// Use predefined errors
throw ApiErrors.Unauthorized()
throw ApiErrors.ValidationFailed('Invalid email format')
```

### Response Format

```typescript
// Success response
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}

// Error response
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": { ... }
  }
}

// Paginated response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Database Management

### Schema Design

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  posts     Post[]
  profile   Profile?
  
  @@map("users")
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@map("posts")
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### Database Operations

```typescript
import { DatabaseService } from '@/lib/database'

const db = DatabaseService.getInstance()

// Create
const user = await db.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe'
  }
})

// Read with relations
const userWithPosts = await db.user.findUnique({
  where: { id: userId },
  include: { posts: true }
})

// Update
const updatedUser = await db.user.update({
  where: { id: userId },
  data: { name: 'Jane Doe' }
})

// Delete
await db.user.delete({
  where: { id: userId }
})

// Complex queries
const users = await db.user.findMany({
  where: {
    posts: {
      some: {
        published: true
      }
    }
  },
  orderBy: {
    createdAt: 'desc'
  },
  take: 10,
  skip: 0
})
```

### Migrations

```bash
# Create migration
npx prisma migrate dev --name add_user_profile

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

## Authentication & Authorization

### NextAuth.js Configuration

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Implement your authentication logic
        return user
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role
      return session
    }
  }
}
```

### Role-Based Access Control

```typescript
// Check permissions in API routes
export const GET = createApiHandler({
  requireAuth: true,
  requiredRole: 'admin'
})(async (req, { user }) => {
  // Only admins can access this endpoint
})

// Check permissions in components
import { useSession } from 'next-auth/react'
import { hasPermission } from '@/lib/auth'

function AdminPanel() {
  const { data: session } = useSession()
  
  if (!hasPermission(session?.user, 'admin')) {
    return <div>Access denied</div>
  }
  
  return <div>Admin content</div>
}
```

## File Upload & Storage

### File Upload Service

```typescript
import { FileUploadService } from '@/lib/upload'

const uploadService = FileUploadService.getInstance()

// Upload single file
const result = await uploadService.uploadFile(file, {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png'],
  generateThumbnail: true,
  folder: 'avatars'
})

// Upload multiple files
const results = await uploadService.uploadFiles(files, {
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024
})
```

### Storage Providers

```typescript
// Local storage
UPLOAD_PROVIDER=local
UPLOAD_LOCAL_PATH=./uploads

// AWS S3
UPLOAD_PROVIDER=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

// Cloudinary
UPLOAD_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Real-time Features

### Socket.IO Setup

```typescript
// src/lib/realtime.ts
import { Server } from 'socket.io'
import { RealtimeService } from '@/lib/realtime'

const realtimeService = RealtimeService.getInstance()

// Emit to specific user
realtimeService.emitToUser(userId, 'notification', {
  message: 'New message received',
  type: 'info'
})

// Emit to room
realtimeService.emitToRoom('chat:123', 'message', {
  id: messageId,
  content: 'Hello world',
  author: user
})

// Broadcast to all users
realtimeService.broadcast('system', {
  message: 'System maintenance in 5 minutes'
})
```

### Client-side Usage

```typescript
// hooks/useSocket.ts
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_APP_URL!)
    setSocket(socketInstance)
    
    return () => {
      socketInstance.disconnect()
    }
  }, [])
  
  return socket
}

// Component usage
function ChatComponent() {
  const socket = useSocket()
  const [messages, setMessages] = useState([])
  
  useEffect(() => {
    if (!socket) return
    
    socket.on('message', (message) => {
      setMessages(prev => [...prev, message])
    })
    
    return () => {
      socket.off('message')
    }
  }, [socket])
  
  const sendMessage = (content: string) => {
    socket?.emit('sendMessage', { content })
  }
  
  return (
    <div>
      {/* Chat UI */}
    </div>
  )
}
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/lib/auth.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals'
import { AuthService } from '@/lib/auth'

describe('AuthService', () => {
  let authService: AuthService
  
  beforeEach(() => {
    authService = new AuthService()
  })
  
  it('should hash password correctly', async () => {
    const password = 'testpassword'
    const hashed = await authService.hashPassword(password)
    
    expect(hashed).not.toBe(password)
    expect(await authService.verifyPassword(password, hashed)).toBe(true)
  })
  
  it('should generate valid JWT token', () => {
    const payload = { userId: '123', role: 'user' }
    const token = authService.generateToken(payload)
    const decoded = authService.verifyToken(token)
    
    expect(decoded.userId).toBe(payload.userId)
    expect(decoded.role).toBe(payload.role)
  })
})
```

### Integration Tests

```typescript
// __tests__/api/users.test.ts
import { describe, it, expect } from '@jest/globals'
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/users/route'

describe('/api/users', () => {
  it('should return users list for authenticated admin', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-admin-token'
      }
    })
    
    await handler(req, res)
    
    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })
})
```

### E2E Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('[data-testid="login-button"]')
    
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'wrongpassword')
    await page.click('[data-testid="login-button"]')
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })
})
```

## Performance Optimization

### Database Optimization

```typescript
// Use database indexes
model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
  
  @@index([email])
  @@index([createdAt])
}

// Optimize queries
const users = await db.user.findMany({
  select: {
    id: true,
    name: true,
    email: true
    // Don't select unnecessary fields
  },
  where: {
    // Use indexed fields in where clauses
    email: {
      contains: searchTerm
    }
  },
  take: 20 // Limit results
})
```

### Caching Strategy

```typescript
import { CacheService } from '@/lib/cache'

const cache = CacheService.getInstance()

// Cache expensive operations
async function getExpensiveData(id: string) {
  const cacheKey = `expensive-data:${id}`
  
  let data = await cache.get(cacheKey)
  if (!data) {
    data = await performExpensiveOperation(id)
    await cache.set(cacheKey, data, 3600) // Cache for 1 hour
  }
  
  return data
}

// Cache invalidation
async function updateData(id: string, newData: any) {
  await db.data.update({ where: { id }, data: newData })
  await cache.delete(`expensive-data:${id}`)
}
```

### Frontend Optimization

```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Expensive rendering */}</div>
})

// Use useMemo for expensive calculations
function DataVisualization({ data }) {
  const processedData = useMemo(() => {
    return expensiveDataProcessing(data)
  }, [data])
  
  return <Chart data={processedData} />
}

// Use useCallback for event handlers
function UserList({ users, onUserSelect }) {
  const handleUserClick = useCallback((user) => {
    onUserSelect(user)
  }, [onUserSelect])
  
  return (
    <div>
      {users.map(user => (
        <UserItem
          key={user.id}
          user={user}
          onClick={handleUserClick}
        />
      ))}
    </div>
  )
}
```

## Security Best Practices

### Input Validation

```typescript
import { z } from 'zod'

// Always validate input
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100)
})

export const POST = createApiHandler({
  validation: {
    body: userSchema
  }
})(async (req, { body }) => {
  // body is now validated and typed
})
```

### SQL Injection Prevention

```typescript
// Use Prisma's type-safe queries (prevents SQL injection)
const user = await db.user.findUnique({
  where: { email: userEmail } // Safe
})

// If using raw queries, use parameterized queries
const users = await db.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`
```

### XSS Prevention

```typescript
// Sanitize HTML content
import DOMPurify from 'dompurify'

function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html)
}

// Use CSP headers
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff'
}
```

### Rate Limiting

```typescript
// API route with rate limiting
export const POST = createApiHandler({
  rateLimit: {
    requests: 5,
    window: '15m',
    skipSuccessfulRequests: false
  }
})(async (req) => {
  // This endpoint is rate limited
})
```

## Deployment

### Environment Setup

```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://yourdomain.com
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### Vercel Deployment

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret"
  }
}
```

## Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check database connection
npx prisma db execute --command "SELECT 1"

# Reset database
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

#### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules
rm -rf node_modules package-lock.json
npm install

# Type check
npm run type-check
```

#### Performance Issues

```bash
# Analyze bundle size
npm run analyze

# Check for memory leaks
node --inspect npm run dev
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=true npm run dev

# Database query logging
DATABASE_LOGGING=true npm run dev
```

### Monitoring

```typescript
// Health check endpoint
export async function GET() {
  const health = await HealthService.check()
  return Response.json(health)
}

// Custom metrics
import { MetricsService } from '@/lib/monitoring'

const metrics = MetricsService.getInstance()
metrics.increment('api.requests', { endpoint: '/users' })
metrics.timing('db.query', queryTime)
```

---

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
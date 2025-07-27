# Contributing to KNI Platform

We love your input! We want to make contributing to KNI Platform as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Pull Request Process](#pull-request-process)
5. [Coding Standards](#coding-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Documentation](#documentation)
8. [Issue Reporting](#issue-reporting)
9. [Feature Requests](#feature-requests)
10. [Security Vulnerabilities](#security-vulnerabilities)
11. [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git
- PostgreSQL 13+ (or Docker)
- Basic knowledge of TypeScript, React, and Next.js

### Setting Up Development Environment

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/KNI.git
   cd KNI
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/KNI.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Set up database**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Run tests**
   ```bash
   npm test
   ```

## Development Process

### Branch Strategy

We use a modified Git Flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/feature-name` - Feature development
- `bugfix/bug-description` - Bug fixes
- `hotfix/critical-fix` - Critical production fixes
- `release/version-number` - Release preparation

### Workflow

1. **Create a feature branch**
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): add new feature"
   ```

4. **Keep your branch updated**
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to GitHub and create a PR from your branch to `develop`
   - Fill out the PR template completely
   - Link any related issues

## Pull Request Process

### Before Submitting

- [ ] Code follows our style guidelines
- [ ] Self-review of code completed
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Documentation updated
- [ ] No merge conflicts with target branch

### PR Requirements

1. **Title Format**
   ```
   type(scope): brief description
   
   Examples:
   feat(auth): add OAuth2 integration
   fix(api): resolve rate limiting issue
   docs(readme): update installation guide
   ```

2. **Description Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix (non-breaking change which fixes an issue)
   - [ ] New feature (non-breaking change which adds functionality)
   - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Screenshots (if applicable)
   
   ## Checklist
   - [ ] My code follows the style guidelines
   - [ ] I have performed a self-review
   - [ ] I have commented my code, particularly in hard-to-understand areas
   - [ ] I have made corresponding changes to the documentation
   - [ ] My changes generate no new warnings
   - [ ] I have added tests that prove my fix is effective or that my feature works
   - [ ] New and existing unit tests pass locally
   ```

3. **Review Process**
   - At least one maintainer review required
   - All CI checks must pass
   - No unresolved conversations
   - Up-to-date with target branch

### After Approval

- Maintainer will merge using "Squash and merge"
- Feature branch will be deleted
- Update your local repository:
  ```bash
  git checkout develop
  git pull upstream develop
  git branch -d feature/your-feature-name
  ```

## Coding Standards

### TypeScript Guidelines

```typescript
// Use explicit types
interface User {
  id: string
  email: string
  name: string | null
  createdAt: Date
}

// Prefer interfaces over types for object shapes
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

// Use enums for constants
enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

// Use generic types appropriately
function createApiResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  }
}
```

### React Guidelines

```typescript
// Use functional components with TypeScript
interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
  disabled?: boolean
}

export function Button({ 
  children, 
  variant = 'primary', 
  onClick, 
  disabled = false 
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Use custom hooks for logic
function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [userId])
  
  return { user, loading, error }
}
```

### API Guidelines

```typescript
// Use consistent error handling
export const GET = createApiHandler({
  requireAuth: true,
  validation: {
    query: z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(10)
    })
  }
})(async (req, { user, query }) => {
  try {
    const users = await getUserService().getUsers(query)
    return Response.success(users)
  } catch (error) {
    if (error instanceof ValidationError) {
      throw ApiErrors.ValidationFailed(error.message)
    }
    throw ApiErrors.InternalServerError()
  }
})

// Use proper HTTP status codes
// 200 - OK
// 201 - Created
// 400 - Bad Request
// 401 - Unauthorized
// 403 - Forbidden
// 404 - Not Found
// 422 - Unprocessable Entity
// 500 - Internal Server Error
```

### Database Guidelines

```typescript
// Use transactions for related operations
async function createUserWithProfile(userData: CreateUserData) {
  return await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: userData.email,
        name: userData.name
      }
    })
    
    const profile = await tx.profile.create({
      data: {
        userId: user.id,
        bio: userData.bio
      }
    })
    
    return { user, profile }
  })
}

// Use proper error handling
async function getUser(id: string) {
  try {
    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true }
    })
    
    if (!user) {
      throw new NotFoundError('User not found')
    }
    
    return user
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      // Handle specific Prisma errors
      throw new DatabaseError('Database operation failed')
    }
    throw error
  }
}
```

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`, `api-handler.ts`)
- **Directories**: kebab-case (`user-management`, `api-routes`)
- **Components**: PascalCase (`UserProfile`, `ApiHandler`)
- **Functions**: camelCase (`getUserById`, `createApiHandler`)
- **Variables**: camelCase (`userId`, `apiResponse`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`, `MAX_FILE_SIZE`)
- **Types/Interfaces**: PascalCase (`User`, `ApiResponse`)

### Code Organization

```
src/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Route groups
│   ├── api/               # API routes
│   └── dashboard/         # Dashboard pages
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── forms/            # Form components
│   └── layout/           # Layout components
├── lib/                  # Utility libraries
│   ├── services/         # Business logic services
│   ├── utils/            # Helper utilities
│   └── types/            # Type definitions
├── hooks/                # Custom React hooks
└── styles/               # Global styles
```

## Testing Guidelines

### Unit Tests

```typescript
// Test file naming: *.test.ts or *.spec.ts
// __tests__/lib/user-service.test.ts

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { UserService } from '@/lib/services/user-service'
import { prismaMock } from '@/lib/test-utils'

describe('UserService', () => {
  let userService: UserService
  
  beforeEach(() => {
    userService = new UserService()
    jest.clearAllMocks()
  })
  
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User'
      }
      
      const expectedUser = {
        id: '1',
        ...userData,
        createdAt: new Date()
      }
      
      prismaMock.user.create.mockResolvedValue(expectedUser)
      
      const result = await userService.createUser(userData)
      
      expect(result).toEqual(expectedUser)
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: userData
      })
    })
    
    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'Test User'
      }
      
      prismaMock.user.create.mockRejectedValue(
        new Error('Unique constraint violation')
      )
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('User with this email already exists')
    })
  })
})
```

### Integration Tests

```typescript
// __tests__/api/users.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { createTestServer } from '@/lib/test-utils'
import { testDb } from '@/lib/test-db'

describe('/api/users', () => {
  let server: any
  
  beforeAll(async () => {
    server = await createTestServer()
    await testDb.seed()
  })
  
  afterAll(async () => {
    await testDb.cleanup()
    await server.close()
  })
  
  it('GET /api/users should return paginated users', async () => {
    const response = await server
      .get('/api/users')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
    
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.pagination).toBeDefined()
  })
})
```

### E2E Tests

```typescript
// tests/e2e/user-management.spec.ts

import { test, expect } from '@playwright/test'

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'admin@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/dashboard')
  })
  
  test('should create new user', async ({ page }) => {
    await page.goto('/dashboard/users')
    await page.click('[data-testid="create-user-button"]')
    
    await page.fill('[data-testid="user-name"]', 'New User')
    await page.fill('[data-testid="user-email"]', 'newuser@example.com')
    await page.click('[data-testid="save-user-button"]')
    
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('User created successfully')
  })
})
```

### Test Coverage

- Aim for 80%+ code coverage
- Focus on critical business logic
- Test edge cases and error conditions
- Use meaningful test descriptions

```bash
# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

## Documentation

### Code Documentation

```typescript
/**
 * Creates a new user with the provided data
 * 
 * @param userData - The user data to create
 * @param options - Additional options for user creation
 * @returns Promise resolving to the created user
 * @throws {ValidationError} When user data is invalid
 * @throws {ConflictError} When email already exists
 * 
 * @example
 * ```typescript
 * const user = await createUser({
 *   email: 'user@example.com',
 *   name: 'John Doe'
 * })
 * ```
 */
async function createUser(
  userData: CreateUserData,
  options: CreateUserOptions = {}
): Promise<User> {
  // Implementation
}
```

### API Documentation

```typescript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get paginated list of users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
```

### README Updates

- Keep README.md up to date
- Include setup instructions
- Document new features
- Update API examples

## Issue Reporting

### Bug Reports

When reporting bugs, please include:

1. **Bug Description**
   - Clear, concise description
   - Expected vs actual behavior

2. **Reproduction Steps**
   ```
   1. Go to '...'
   2. Click on '....'
   3. Scroll down to '....'
   4. See error
   ```

3. **Environment**
   - OS: [e.g. macOS 12.0]
   - Browser: [e.g. Chrome 95.0]
   - Node.js version: [e.g. 18.0.0]
   - Package version: [e.g. 1.2.3]

4. **Additional Context**
   - Screenshots
   - Error logs
   - Related issues

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. iOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Additional context**
Add any other context about the problem here.
```

## Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.

**Implementation suggestions**
If you have ideas about how this could be implemented, please share them.
```

### Feature Development Process

1. **Discussion**
   - Create feature request issue
   - Community discussion
   - Maintainer approval

2. **Design**
   - Technical design document
   - API design (if applicable)
   - UI/UX mockups (if applicable)

3. **Implementation**
   - Create feature branch
   - Implement feature
   - Add tests
   - Update documentation

4. **Review**
   - Code review
   - Testing
   - Documentation review

## Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: security@kni-platform.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to resolve the issue.

## Community

### Communication Channels

- **GitHub Discussions**: General questions and discussions
- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time chat and community support
- **Email**: security@kni-platform.com (security issues only)

### Getting Help

1. **Check existing documentation**
   - README.md
   - DEVELOPMENT.md
   - API documentation

2. **Search existing issues**
   - GitHub issues
   - GitHub discussions

3. **Ask for help**
   - Create GitHub discussion
   - Join Discord community

### Recognition

We recognize contributors in several ways:

- **Contributors list** in README.md
- **Release notes** mention significant contributions
- **Special badges** for regular contributors
- **Maintainer status** for exceptional contributors

## License

By contributing to KNI Platform, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to KNI Platform! 🚀
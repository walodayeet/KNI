# KNI Project Web Application

[![CI/CD Pipeline](https://github.com/your-org/kni-project/workflows/CI/badge.svg)](https://github.com/your-org/kni-project/actions)
[![Code Quality](https://img.shields.io/badge/code%20quality-9.5%2F10-brightgreen)](./ENHANCEMENT_SUMMARY.md)
[![Test Coverage](https://img.shields.io/badge/coverage-70%25+-green)](./coverage)
[![TypeScript](https://img.shields.io/badge/TypeScript-95%25+-blue)](./src)

A modern, high-performance web application built with Next.js 14, TypeScript, and enterprise-grade quality standards.

## 🚀 Features

### Core Features
- **Next.js 14**: Latest React framework with App Router
- **TypeScript**: Full type safety with strict configuration
- **PostgreSQL**: Robust database with Prisma ORM
- **Tailwind CSS**: Utility-first CSS framework
- **Prisma**: Type-safe database ORM

### Quality & Performance
- **Performance Monitoring**: Real-time Core Web Vitals tracking
- **Error Handling**: Comprehensive error boundaries and reporting
- **Analytics**: User behavior and performance analytics
- **Health Checks**: Advanced system health monitoring
- **Security**: Rate limiting, CSRF protection, security headers

### Developer Experience
- **Code Quality**: ESLint, Prettier, and strict TypeScript
- **Testing**: Jest, React Testing Library, E2E with Playwright
- **CI/CD**: Automated testing, building, and deployment
- **Documentation**: Comprehensive code documentation
- **Hot Reloading**: Fast development with instant feedback

## 📋 Prerequisites

- **Node.js**: 18.17.0 or later
- **npm**: 9.0.0 or later
- **PostgreSQL**: 14.0 or later (for local development)
- **Docker**: Optional, for containerized development

## 🛠 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/kni-project.git
cd kni-project
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

### 4. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:deploy

# Seed database (optional)
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🐳 Docker Development

### Quick Start with Docker Compose
```bash
# Start all services
npm run docker:dev

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Manual Docker Setup
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

## 📝 Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run type-check   # Run TypeScript type checking
npm run type-check:watch # Watch mode type checking
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:strict  # Run ESLint with strict rules
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run format:staged # Format staged files
npm run quality      # Run all quality checks
npm run quality:fix  # Fix all quality issues
```

### Testing
```bash
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:ci      # Run tests for CI
npm run test:e2e     # Run E2E tests
npm run test:debug   # Debug tests
npm run test:update  # Update snapshots
```

### Database
```bash
npm run db:generate  # Generate Prisma client
npm run db:deploy    # Deploy migrations
npm run db:reset     # Reset database
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm run db:backup    # Backup database
```

### Analysis & Monitoring
```bash
npm run analyze      # Analyze bundle size
npm run lighthouse   # Run Lighthouse audit
npm run health       # Check application health
npm run perf         # Performance analysis
```

### Security
```bash
npm run audit        # Security audit
npm run audit:fix    # Fix security issues
```

### Maintenance
```bash
npm run clean        # Clean build artifacts
npm run clean:deps   # Clean dependencies
npm run clean:all    # Clean everything
```

## 🏗 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── analytics/     # Analytics endpoints
│   │   ├── errors/        # Error reporting
│   │   └── health/        # Health checks
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI components
│   ├── ErrorBoundary.tsx # Error handling
│   ├── LoadingStates.tsx # Loading components
│   └── PerformanceMonitor.tsx # Performance tracking
├── lib/                   # Utility libraries
│   ├── analytics.ts       # Analytics system
│   ├── auth.ts           # Authentication
│   ├── database.ts       # Database utilities
│   ├── logger.ts         # Logging system
│   ├── rate-limit.ts     # Rate limiting
│   ├── test-utils.tsx    # Testing utilities
│   └── utils.ts          # General utilities
├── types/                 # TypeScript definitions
└── middleware.ts          # Next.js middleware
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Analytics
NEXT_PUBLIC_ANALYTICS_ID="..."
ANALYTICS_SECRET="..."

# Error Reporting
SENTRY_DSN="..."
NEXT_PUBLIC_SENTRY_DSN="..."

# Security
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Rate Limiting
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

### TypeScript Configuration

The project uses strict TypeScript configuration:
- Strict mode enabled
- No implicit any
- Unused locals/parameters detection
- Exact optional property types

### ESLint Configuration

Comprehensive linting rules:
- TypeScript best practices
- React/JSX conventions
- Accessibility (a11y) rules
- Import organization
- Security rules

## 🧪 Testing

### Unit Testing
- **Framework**: Jest + React Testing Library
- **Coverage**: 70%+ threshold
- **Mocking**: Comprehensive mock utilities
- **Snapshots**: Component snapshot testing

### E2E Testing
- **Framework**: Playwright
- **Browsers**: Chromium, Firefox, Safari
- **CI Integration**: Automated E2E testing

### Testing Best Practices
1. Write tests for all business logic
2. Test user interactions, not implementation
3. Use data-testid for reliable selectors
4. Mock external dependencies
5. Maintain high test coverage

## 📊 Performance

### Core Web Vitals Targets
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1
- **FCP (First Contentful Paint)**: < 1.8s
- **TTFB (Time to First Byte)**: < 600ms

### Performance Features
- Real-time performance monitoring
- Bundle size optimization
- Image optimization
- Code splitting
- Caching strategies

## 🔒 Security

### Security Features
- **Rate Limiting**: API endpoint protection
- **CSRF Protection**: Cross-site request forgery prevention
- **Security Headers**: Comprehensive security headers
- **Input Validation**: Zod schema validation
- **SQL Injection Prevention**: Prisma ORM protection
- **XSS Prevention**: Output sanitization

### Security Best Practices
1. Never commit secrets to version control
2. Use environment variables for sensitive data
3. Validate all user inputs
4. Implement proper authentication
5. Regular security audits

## 📈 Monitoring

### Application Monitoring
- **Health Checks**: `/api/health/advanced`
- **Performance Metrics**: Real-time Core Web Vitals
- **Error Tracking**: Automatic error capture
- **User Analytics**: Behavior tracking

### Logging
- **Structured Logging**: JSON format
- **Log Levels**: Error, Warn, Info, Debug
- **Request Tracing**: Unique request IDs
- **Performance Logging**: Response times

## 🚀 Deployment

### Production Build
```bash
# Build application
npm run build

# Start production server
npm start
```

### Docker Deployment
```bash
# Build production image
npm run docker:build

# Run production container
docker run -p 3000:3000 kni-project
```

### CI/CD Pipeline
The project includes a comprehensive GitHub Actions workflow:
1. **Quality Checks**: Linting, formatting, type checking
2. **Testing**: Unit, integration, and E2E tests
3. **Security**: Vulnerability scanning
4. **Building**: Production build and optimization
5. **Deployment**: Automated deployment to production

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `npm run quality`
5. Run tests: `npm test`
6. Commit with conventional commits
7. Push and create a pull request

### Code Standards
- Follow TypeScript best practices
- Write comprehensive tests
- Use conventional commit messages
- Update documentation as needed
- Ensure all quality checks pass

### Commit Convention
```
type(scope): description

feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: adding tests
chore: maintenance tasks
```

## 📚 Documentation

- **[Enhancement Summary](./ENHANCEMENT_SUMMARY.md)**: Detailed enhancement overview
- **[API Documentation](./docs/api.md)**: API endpoint documentation
- **[Component Library](./docs/components.md)**: Component usage guide
- **[Deployment Guide](./docs/deployment.md)**: Production deployment guide

## 🆘 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

#### Database Issues
```bash
# Reset database
npm run db:reset

# Regenerate Prisma client
npm run db:generate
```

#### Type Errors
```bash
# Check TypeScript errors
npm run type-check

# Restart TypeScript server in VS Code
Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

### Getting Help
- Check the [documentation](./docs/)
- Search [existing issues](https://github.com/your-org/kni-project/issues)
- Create a [new issue](https://github.com/your-org/kni-project/issues/new)
- Contact the development team

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Development Team**: [Your Team](mailto:dev@yourcompany.com)
- **Project Manager**: [PM Name](mailto:pm@yourcompany.com)
- **DevOps**: [DevOps Team](mailto:devops@yourcompany.com)

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Vercel for hosting and deployment
- Open source community for the tools and libraries
- All contributors to this project

---

**Built with ❤️ by the KNI Project Team**

For more information, visit our [documentation](./docs/) or contact the development team.


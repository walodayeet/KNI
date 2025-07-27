import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { server } from './src/__mocks__/server'

// Polyfill for Node.js environment
Object.assign(global, { TextDecoder, TextEncoder })

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/test-path',
  useParams: () => ({ locale: 'en' }),
}))

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key) => key,
  useLocale: () => 'en',
  useMessages: () => ({}),
}))

// Mock next-intl/navigation
jest.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
    redirect: jest.fn(),
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }),
    usePathname: () => '/test-path',
  }),
  redirect: jest.fn(),
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}))

// Mock Prisma
jest.mock('./src/lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  test: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  consultation: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

// Setup MSW
beforeAll(() => {
  // Enable API mocking before tests
  if (typeof server !== 'undefined') {
    server.listen()
  }
})

afterEach(() => {
  // Reset any runtime request handlers we may add during the tests
  if (typeof server !== 'undefined') {
    server.resetHandlers()
  }
})

afterAll(() => {
  // Clean up after the tests are finished
  if (typeof server !== 'undefined') {
    server.close()
  }
})

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
  createMockTest: (overrides = {}) => ({
    id: 'test-id',
    title: 'Test Title',
    description: 'Test Description',
    questions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
}

// Suppress console warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/context/AuthContext'

// Mock implementations for testing
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  avatar: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockAuthContext = {
  user: mockUser,
  loading: false,
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
  resetPassword: jest.fn(),
  refreshSession: jest.fn(),
}

const mockToastContext = {
  toast: jest.fn(),
  dismiss: jest.fn(),
  toasts: [],
}

const mockI18nContext = {
  locale: 'en',
  setLocale: jest.fn(),
  t: jest.fn((key: string) => key),
  dir: 'ltr' as const,
}

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add custom options here
  withAuth?: boolean
  withQueryClient?: boolean
  withTheme?: boolean
  queryClientOptions?: ConstructorParameters<typeof QueryClient>[0]
}

function createWrapper(options: CustomRenderOptions = {}) {
  const {
    withAuth = true,
    withQueryClient = true,
    withTheme = true,
    queryClientOptions = {},
  } = options

  return function Wrapper({ children }: { children: React.ReactNode }) {
    let component = children

    // Wrap with QueryClient
    if (withQueryClient) {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
          },
          mutations: {
            retry: false,
          },
        },
        ...queryClientOptions,
      })

      component = (
        <QueryClientProvider client={queryClient}>
          {component}
        </QueryClientProvider>
      )
    }

    // Wrap with Theme Provider
    if (withTheme) {
      component = (
        <ThemeProvider attribute="class" defaultTheme="light">
          {component}
        </ThemeProvider>
      )
    }

    // Note: I18n and Toast providers are mocked for testing
    // but not actually wrapped since the context files don't exist

    // Wrap with Auth Provider (using actual provider for testing)
    if (withAuth) {
      component = (
        <AuthProvider>
          {component}
        </AuthProvider>
      )
    }

    return <>{component}</>
  }
}

function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const Wrapper = createWrapper(options)
  return render(ui, { wrapper: Wrapper, ...options })
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }

// Test utilities
export const testUtils = {
  // Mock data generators
  createMockUser: (overrides: Partial<typeof mockUser> = {}) => ({
    ...mockUser,
    ...overrides,
  }),

  createMockAuthState: (overrides: Partial<typeof mockAuthContext> = {}) => ({
    ...mockAuthContext,
    ...overrides,
  }),

  // Common test helpers
  waitForLoadingToFinish: async () => {
    const { waitForElementToBeRemoved } = await import('@testing-library/dom')
    await waitForElementToBeRemoved(
      () => document.querySelector('[data-testid="loading"]'),
      { timeout: 3000 }
    )
  },

  // Mock API responses
  mockApiResponse: (data: any, status = 200) => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      })
    ) as jest.Mock
  },

  mockApiError: (message = 'API Error', _status = 500) => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error(message))
    ) as jest.Mock
  },

  // Local storage mock
  mockLocalStorage: () => {
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    })
    return localStorageMock
  },

  // Session storage mock
  mockSessionStorage: () => {
    const sessionStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
    })
    return sessionStorageMock
  },

  // Router mock
  mockRouter: (overrides: any = {}) => {
    const mockRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
      route: '/',
      ...overrides,
    }

    jest.doMock('next/router', () => ({
      useRouter: () => mockRouter,
    }))

    return mockRouter
  },

  // Intersection Observer mock
  mockIntersectionObserver: () => {
    const mockIntersectionObserver = jest.fn()
    mockIntersectionObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })
    window.IntersectionObserver = mockIntersectionObserver
    return mockIntersectionObserver
  },

  // Resize Observer mock
  mockResizeObserver: () => {
    const mockResizeObserver = jest.fn()
    mockResizeObserver.mockReturnValue({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })
    window.ResizeObserver = mockResizeObserver
    return mockResizeObserver
  },

  // Media query mock
  mockMatchMedia: (matches = false) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })
  },

  // Console mock
  mockConsole: () => {
    const originalConsole = { ...console }
    const mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    }
    
    Object.assign(console, mockConsole)
    
    return {
      mockConsole,
      restore: () => Object.assign(console, originalConsole),
    }
  },

  // Date mock
  mockDate: (date: string | Date) => {
    const mockDate = new Date(date)
    const originalDate = Date
    
    global.Date = jest.fn(() => mockDate) as any
    global.Date.now = jest.fn(() => mockDate.getTime())
    global.Date.UTC = originalDate.UTC
    global.Date.parse = originalDate.parse
    
    return {
      restore: () => {
        global.Date = originalDate
      },
    }
  },

  // Performance mock
  mockPerformance: () => {
    const mockPerformance = {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      getEntriesByName: jest.fn(() => []),
    }
    
    Object.defineProperty(window, 'performance', {
      value: mockPerformance,
    })
    
    return mockPerformance
  },
}

// Custom matchers
export const customMatchers = {
  toBeInTheDocument: expect.extend({
    toBeInTheDocument(received) {
      const pass = received && document.body.contains(received)
      return {
        message: () =>
          pass
            ? `Expected element not to be in the document`
            : `Expected element to be in the document`,
        pass,
      }
    },
  }),
}

// Test data factories
export const factories = {
  user: (overrides: Partial<typeof mockUser> = {}) => ({
    ...mockUser,
    ...overrides,
  }),

  post: (overrides: any = {}) => ({
    id: 'test-post-id',
    title: 'Test Post',
    content: 'Test content',
    authorId: mockUser.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  comment: (overrides: any = {}) => ({
    id: 'test-comment-id',
    content: 'Test comment',
    authorId: mockUser.id,
    postId: 'test-post-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),
}

// Export mock contexts for direct use
export {
  mockUser,
  mockAuthContext,
  mockToastContext,
  mockI18nContext,
}
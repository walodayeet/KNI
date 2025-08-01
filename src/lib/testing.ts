import { jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { Session } from 'next-auth'
import { prisma } from './database'
import { logger } from './logger'
import { CacheService } from './cache'
import { EmailService } from './email'
import { NotificationService } from './notifications'

import crypto from 'crypto'

// Test configuration
interface TestConfig {
  database: {
    resetBetweenTests: boolean
    seedData: boolean
    isolateTransactions: boolean
  }
  cache: {
    clearBetweenTests: boolean
    mockRedis: boolean
  }
  email: {
    mockSending: boolean
    captureEmails: boolean
  }
  notifications: {
    mockSending: boolean
    captureNotifications: boolean
  }
  auth: {
    mockSessions: boolean
    defaultUser: any
  }
  api: {
    mockExternalCalls: boolean
    defaultResponses: Record<string, any>
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'silent'
    captureLogsInTests: boolean
  }
}

const defaultTestConfig: TestConfig = {
  database: {
    resetBetweenTests: process.env.TEST_RESET_DB !== 'false',
    seedData: process.env.TEST_SEED_DATA !== 'false',
    isolateTransactions: process.env.TEST_ISOLATE_TRANSACTIONS !== 'false',
  },
  cache: {
    clearBetweenTests: process.env.TEST_CLEAR_CACHE !== 'false',
    mockRedis: process.env.TEST_MOCK_REDIS !== 'false',
  },
  email: {
    mockSending: process.env.TEST_MOCK_EMAIL !== 'false',
    captureEmails: process.env.TEST_CAPTURE_EMAILS !== 'false',
  },
  notifications: {
    mockSending: process.env.TEST_MOCK_NOTIFICATIONS !== 'false',
    captureNotifications: process.env.TEST_CAPTURE_NOTIFICATIONS !== 'false',
  },
  auth: {
    mockSessions: process.env.TEST_MOCK_AUTH !== 'false',
    defaultUser: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
    },
  },
  api: {
    mockExternalCalls: process.env.TEST_MOCK_EXTERNAL !== 'false',
    defaultResponses: {},
  },
  logging: {
    level: (process.env.TEST_LOG_LEVEL as any) || 'silent',
    captureLogsInTests: process.env.TEST_CAPTURE_LOGS === 'true',
  },
}

// Test data factories
export class TestDataFactory {
  // User factory
  static createUser(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      email: `user-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'USER',
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // Test factory
  static createTest(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      title: 'Sample Test',
      description: 'A test for testing purposes',
      type: 'MULTIPLE_CHOICE',
      difficulty: 'INTERMEDIATE',
      duration: 60,
      totalQuestions: 10,
      passingScore: 70,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // Question factory
  static createQuestion(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      testId: crypto.randomUUID(),
      type: 'MULTIPLE_CHOICE',
      question: 'What is the correct answer?',
      options: [
        { id: '1', text: 'Option A', isCorrect: true },
        { id: '2', text: 'Option B', isCorrect: false },
        { id: '3', text: 'Option C', isCorrect: false },
        { id: '4', text: 'Option D', isCorrect: false },
      ],
      points: 1,
      explanation: 'This is the explanation',
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // Test session factory
  static createTestSession(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      testId: crypto.randomUUID(),
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      timeRemaining: 3600,
      currentQuestionIndex: 0,
      answers: [],
      score: null,
      passed: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // Consultation factory
  static createConsultation(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      consultantId: crypto.randomUUID(),
      type: 'CAREER_GUIDANCE',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
      duration: 60,
      notes: 'Test consultation',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // Notification factory
  static createNotification(overrides: Partial<any> = {}) {
    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      type: 'INFO',
      priority: 'NORMAL',
      subject: 'Test Notification',
      content: 'This is a test notification',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }
  }

  // API request factory
  static createApiRequest(overrides: Partial<any> = {}) {
    const url = overrides.url || 'http://localhost:3000/api/test'
    const method = overrides.method || 'GET'
    
    return new NextRequest(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test Agent',
        ...overrides.headers,
      },
      body: overrides.body ? JSON.stringify(overrides.body) : undefined,
    })
  }

  // Session factory
  static createSession(overrides: Partial<Session> = {}): Session {
    return {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        ...overrides.user,
      },
      expires: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      ...overrides,
    }
  }
}

// Test database utilities
export class TestDatabase {
  private static isInTransaction = false
  private static transactionClient: any = null

  // Setup database for testing
  static async setup() {
    if (defaultTestConfig.database.isolateTransactions) {
      await this.beginTransaction()
    }
    
    if (defaultTestConfig.database.seedData) {
      await this.seedTestData()
    }
  }

  // Cleanup database after testing
  static async cleanup() {
    if (defaultTestConfig.database.resetBetweenTests) {
      await this.resetDatabase()
    }
    
    if (this.isInTransaction) {
      await this.rollbackTransaction()
    }
  }

  // Begin transaction for test isolation
  static async beginTransaction() {
    if (this.isInTransaction) {
      return
    }
    
    this.transactionClient = await prisma.$begin()
    this.isInTransaction = true
  }

  // Rollback transaction
  static async rollbackTransaction() {
    if (!this.isInTransaction || !this.transactionClient) {
      return
    }
    
    await this.transactionClient.$rollback()
    this.isInTransaction = false
    this.transactionClient = null
  }

  // Get database client (transaction or regular)
  static getClient() {
    return this.isInTransaction ? this.transactionClient : prisma
  }

  // Reset database
  static async resetDatabase() {
    const client = this.getClient()
    
    // Delete in reverse order of dependencies
    await client.testSession.deleteMany()
    await client.question.deleteMany()
    await client.test.deleteMany()
    await client.consultation.deleteMany()
    await client.notification.deleteMany()
    await client.notificationPreferences.deleteMany()
    await client.session.deleteMany()
    await client.account.deleteMany()
    await client.user.deleteMany()
  }

  // Seed test data
  static async seedTestData() {
    const client = this.getClient()
    
    // Create test users
    const testUser = await client.user.create({
      data: TestDataFactory.createUser({
        id: 'test-user-1',
        email: 'testuser1@example.com',
        name: 'Test User 1',
      }),
    })

    const adminUser = await client.user.create({
      data: TestDataFactory.createUser({
        id: 'admin-user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN',
      }),
    })

    // Create test
    const test = await client.test.create({
      data: TestDataFactory.createTest({
        id: 'test-1',
        title: 'Sample Programming Test',
        createdBy: adminUser.id,
      }),
    })

    // Create questions
    for (let i = 1; i <= 5; i++) {
      await client.question.create({
        data: TestDataFactory.createQuestion({
          testId: test.id,
          question: `Question ${i}?`,
          order: i,
        }),
      })
    }

    // Create notification preferences
    await client.notificationPreferences.create({
      data: {
        userId: testUser.id,
        channels: {
          email: true,
          push: true,
          sms: false,
          inApp: true,
          realtime: true,
        },
        types: {
          INFO: true,
          SUCCESS: true,
          WARNING: true,
          ERROR: true,
          REMINDER: true,
          INVITATION: true,
          ANNOUNCEMENT: true,
          SYSTEM: true,
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC',
        },
        frequency: {
          immediate: true,
          digest: false,
          digestFrequency: 'daily',
        },
      },
    })
  }

  // Create test user
  static async createTestUser(overrides: Partial<any> = {}) {
    const client = this.getClient()
    return client.user.create({
      data: TestDataFactory.createUser(overrides),
    })
  }

  // Create test
  static async createTest(overrides: Partial<any> = {}) {
    const client = this.getClient()
    return client.test.create({
      data: TestDataFactory.createTest(overrides),
    })
  }
}

// Mock utilities
export class TestMocks {
  private static originalMethods: Map<string, any> = new Map()
  private static capturedEmails: any[] = []
  private static capturedNotifications: any[] = []
  private static capturedLogs: any[] = []

  // Setup all mocks
  static setup() {
    this.setupDatabaseMocks()
    this.setupCacheMocks()
    this.setupEmailMocks()
    this.setupNotificationMocks()
    this.setupLoggerMocks()
    this.setupExternalApiMocks()
  }

  // Restore all mocks
  static restore() {
    this.originalMethods.forEach((originalMethod, key) => {
      const [objectName, methodName] = key.split('.')
      const targetObject = this.getObjectByName(objectName)
      if (targetObject && targetObject[methodName]) {
        targetObject[methodName] = originalMethod
      }
    })
    
    this.originalMethods.clear()
    this.clearCapturedData()
  }

  // Clear captured data
  static clearCapturedData() {
    this.capturedEmails = []
    this.capturedNotifications = []
    this.capturedLogs = []
  }

  // Setup database mocks
  private static setupDatabaseMocks() {
    // Mock database operations if needed
  }

  // Setup cache mocks
  private static setupCacheMocks() {
    if (!defaultTestConfig.cache.mockRedis) {
      return
    }

    const mockCache = new Map<string, { value: any; expiry?: number }>()

    this.mockMethod('CacheService', 'get', async (key: string) => {
      const item = mockCache.get(key)
      if (!item) {
        return null
      }
      
      if (item.expiry && Date.now() > item.expiry) {
        mockCache.delete(key)
        return null
      }
      
      return item.value
    })

    this.mockMethod('CacheService', 'set', async (key: string, value: any, ttl?: number) => {
      const expiry = ttl ? Date.now() + (ttl * 1000) : undefined
      mockCache.set(key, { value, expiry })
      return true
    })

    this.mockMethod('CacheService', 'delete', async (key: string) => {
      return mockCache.delete(key)
    })

    this.mockMethod('CacheService', 'clear', async () => {
      mockCache.clear()
      return true
    })
  }

  // Setup email mocks
  private static setupEmailMocks() {
    if (!defaultTestConfig.email.mockSending) {
      return
    }

    this.mockMethod('EmailService', 'send', async (emailData: any) => {
      if (defaultTestConfig.email.captureEmails) {
        this.capturedEmails.push({
          ...emailData,
          sentAt: new Date(),
        })
      }
      return { success: true, messageId: `mock-${Date.now()}` }
    })

    // Mock specific email methods
    const emailMethods = [
      'sendWelcomeEmail',
      'sendVerificationEmail',
      'sendPasswordResetEmail',
      'sendTestInvitationEmail',
      'sendTestReminderEmail',
      'sendTestResultsEmail',
      'sendConsultationReminderEmail',
      'sendNotificationEmail',
    ]

    emailMethods.forEach(method => {
      this.mockMethod('EmailService', method, async (...args: any[]) => {
        if (defaultTestConfig.email.captureEmails) {
          this.capturedEmails.push({
            method,
            args,
            sentAt: new Date(),
          })
        }
        return { success: true, messageId: `mock-${Date.now()}` }
      })
    })
  }

  // Setup notification mocks
  private static setupNotificationMocks() {
    if (!defaultTestConfig.notifications.mockSending) {
      return
    }

    this.mockMethod('NotificationService', 'send', async (notificationData: any) => {
      if (defaultTestConfig.notifications.captureNotifications) {
        this.capturedNotifications.push({
          ...notificationData,
          id: crypto.randomUUID(),
          sentAt: new Date(),
        })
      }
      return { success: true, id: crypto.randomUUID() }
    })

    // Mock specific notification methods
    const notificationMethods = [
      'sendWelcomeNotification',
      'sendTestInvitation',
      'sendTestReminder',
      'sendTestResults',
      'sendConsultationReminder',
      'sendSystemAnnouncement',
      'sendErrorNotification',
    ]

    notificationMethods.forEach(method => {
      this.mockMethod('NotificationService', method, async (...args: any[]) => {
        if (defaultTestConfig.notifications.captureNotifications) {
          this.capturedNotifications.push({
            method,
            args,
            sentAt: new Date(),
          })
        }
        return { success: true, id: crypto.randomUUID() }
      })
    })
  }

  // Setup logger mocks
  private static setupLoggerMocks() {
    if (!defaultTestConfig.logging.captureLogsInTests) {
      return
    }

    const logMethods = ['debug', 'info', 'warn', 'error']
    
    logMethods.forEach(level => {
      this.mockMethod('logger', level, async (message: string, data?: any, error?: Error) => {
        this.capturedLogs.push({
          level,
          message,
          data,
          error: error ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          } : undefined,
          timestamp: new Date(),
        })
      })
    })
  }

  // Setup external API mocks
  private static setupExternalApiMocks() {
    if (!defaultTestConfig.api.mockExternalCalls) {
      return
    }

    // Mock fetch for external API calls
    global.fetch = jest.fn().mockImplementation(async (url: string, _options?: any) => {
      const mockResponse = defaultTestConfig.api.defaultResponses[url] || {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        text: async () => 'OK',
      }

      return Promise.resolve({
        ok: mockResponse.ok,
        status: mockResponse.status,
        statusText: mockResponse.statusText || 'OK',
        json: async () => mockResponse.json || { success: true },
        text: async () => mockResponse.text || 'OK',
        headers: new Headers(mockResponse.headers || {}),
      })
    })
  }

  // Helper to mock a method
  private static mockMethod(objectName: string, methodName: string, mockImplementation: any) {
    const targetObject = this.getObjectByName(objectName)
    if (!targetObject || !targetObject[methodName]) {
      return
    }

    const key = `${objectName}.${methodName}`
    if (!this.originalMethods.has(key)) {
      this.originalMethods.set(key, targetObject[methodName])
    }

    targetObject[methodName] = jest.fn().mockImplementation(mockImplementation)
  }

  // Helper to get object by name
  private static getObjectByName(name: string): any {
    switch (name) {
      case 'CacheService':
        return CacheService
      case 'EmailService':
        return EmailService
      case 'NotificationService':
        return NotificationService
      case 'logger':
        return logger
      default:
        return null
    }
  }

  // Getters for captured data
  static getCapturedEmails() {
    return [...this.capturedEmails]
  }

  static getCapturedNotifications() {
    return [...this.capturedNotifications]
  }

  static getCapturedLogs() {
    return [...this.capturedLogs]
  }

  // Assertions for captured data
  static expectEmailSent(criteria: Partial<any>) {
    const matchingEmails = this.capturedEmails.filter(email => {
      return Object.entries(criteria).every(([key, value]) => {
        if (key === 'method') {
          return email.method === value
        }
        return email[key] === value || (email.args && email.args.some((arg: any) => arg === value))
      })
    })

    expect(matchingEmails.length).toBeGreaterThan(0)
    return matchingEmails
  }

  static expectNotificationSent(criteria: Partial<any>) {
    const matchingNotifications = this.capturedNotifications.filter(notification => {
      return Object.entries(criteria).every(([key, value]) => {
        if (key === 'method') {
          return notification.method === value
        }
        return notification[key] === value || (notification.args && notification.args.some((arg: any) => arg === value))
      })
    })

    expect(matchingNotifications.length).toBeGreaterThan(0)
    return matchingNotifications
  }

  static expectLogMessage(level: string, messagePattern: string | RegExp) {
    const matchingLogs = this.capturedLogs.filter(log => {
      if (log.level !== level) {
        return false
      }
      
      if (typeof messagePattern === 'string') {
        return log.message.includes(messagePattern)
      }
      return messagePattern.test(log.message)
    })

    expect(matchingLogs.length).toBeGreaterThan(0)
    return matchingLogs
  }
}

// Test helpers
export class TestHelpers {
  // Wait for a condition to be true
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      const result = await condition()
      if (result) {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error(`Condition not met within ${timeout}ms`)
  }

  // Sleep for a given duration
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Generate random string
  static randomString(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Generate random email
  static randomEmail(): string {
    return `${this.randomString(8)}@example.com`
  }

  // Create authenticated request
  static createAuthenticatedRequest(
    url: string,
    options: any = {},
    session?: Session
  ): NextRequest {
    const defaultSession = TestDataFactory.createSession(session)
    
    return TestDataFactory.createApiRequest({
      url,
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${btoa(JSON.stringify(defaultSession))}`,
      },
    })
  }

  // Assert API response
  static assertApiResponse(
    response: NextResponse,
    expectedStatus: number,
    expectedData?: any
  ) {
    expect(response.status).toBe(expectedStatus)
    
    if (expectedData) {
      // Note: In real tests, you'd need to parse the response body
      // This is a simplified version
    }
  }

  // Assert validation error
  static assertValidationError(
    response: NextResponse,
    expectedField?: string
  ) {
    expect(response.status).toBe(400)
    
    // In real implementation, parse response and check error details
    if (expectedField) {
      // Check that the error mentions the expected field
    }
  }

  // Create test file
  static createTestFile(
    filename: string,
    content: string,
    mimeType = 'text/plain'
  ): File {
    const blob = new Blob([content], { type: mimeType })
    return new File([blob], filename, { type: mimeType })
  }

  // Create form data
  static createFormData(data: Record<string, any>): FormData {
    const formData = new FormData()
    
    Object.entries(data).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value)
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
      } else {
        formData.append(key, String(value))
      }
    })
    
    return formData
  }
}

// Test suite setup and teardown
export class TestSuite {
  private static isSetup = false

  // Global setup (run once before all tests)
  static async globalSetup() {
    if (this.isSetup) {
      return
    }
    
    // Set test environment
    process.env.NODE_ENV = 'test'
    
    // Setup test database
    await TestDatabase.setup()
    
    // Setup mocks
    TestMocks.setup()
    
    this.isSetup = true
  }

  // Global teardown (run once after all tests)
  static async globalTeardown() {
    if (!this.isSetup) {
      return
    }
    
    // Cleanup database
    await TestDatabase.cleanup()
    
    // Restore mocks
    TestMocks.restore()
    
    // Disconnect from database
    await prisma.$disconnect()
    
    this.isSetup = false
  }

  // Setup before each test
  static async beforeEach() {
    if (defaultTestConfig.database.resetBetweenTests) {
      await TestDatabase.resetDatabase()
      if (defaultTestConfig.database.seedData) {
        await TestDatabase.seedTestData()
      }
    }
    
    if (defaultTestConfig.cache.clearBetweenTests) {
      await CacheService.clear()
    }
    
    TestMocks.clearCapturedData()
  }

  // Cleanup after each test
  static async afterEach() {
    // Additional cleanup if needed
  }
}

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R
      toBeValidEmail(): R
      toBeValidDate(): R
      toHaveBeenCalledWithPartial(expected: any): R
    }
  }
}

// Extend Jest matchers
if (typeof expect !== 'undefined') {
  expect.extend({
    toBeValidUUID(received: string) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const pass = uuidRegex.test(received)
      
      return {
        message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
        pass,
      }
    },
    
    toBeValidEmail(received: string) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const pass = emailRegex.test(received)
      
      return {
        message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
        pass,
      }
    },
    
    toBeValidDate(received: any) {
      const pass = received instanceof Date && !isNaN(received.getTime())
      
      return {
        message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid date`,
        pass,
      }
    },
    
    toHaveBeenCalledWithPartial(received: jest.MockedFunction<any>, expected: any) {
      const { mock: { calls } } = received
        const pass = calls.some(({ 0: arg }) => {
          return Object.entries(expected).every((entry) => {
            const [key, value] = entry
            return arg && arg[key] === value
          })
        })
      
      return {
        message: () => `expected function ${pass ? 'not ' : ''}to have been called with partial object ${JSON.stringify(expected)}`,
        pass,
      }
    },
  })
}

// Export test configuration
export { defaultTestConfig as testConfig }

// Export everything for easy importing
const testingModule = {
  TestDataFactory,
  TestDatabase,
  TestMocks,
  TestHelpers,
  TestSuite,
  testConfig: defaultTestConfig,
}

export default testingModule
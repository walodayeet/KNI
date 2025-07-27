import { logger } from './logger'
import { CacheService } from './cache'
import { z } from 'zod'
import { prisma } from './database'
import React from 'react'

// Analytics configuration
interface AnalyticsConfig {
  enabled: boolean
  batchSize: number
  flushInterval: number
  retentionDays: number
  anonymizeIp: boolean
  trackingId?: string
  apiEndpoint?: string
  enableRealtime: boolean
  enableCaching: boolean
  cacheTtl: number
}

const defaultConfig: AnalyticsConfig = {
  enabled: process.env.ANALYTICS_ENABLED === 'true',
  batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100'),
  flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || '30000'), // 30 seconds
  retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90'),
  anonymizeIp: process.env.ANALYTICS_ANONYMIZE_IP === 'true',
  trackingId: process.env.ANALYTICS_TRACKING_ID,
  apiEndpoint: process.env.ANALYTICS_API_ENDPOINT,
  enableRealtime: process.env.ANALYTICS_REALTIME_ENABLED === 'true',
  enableCaching: process.env.ANALYTICS_CACHING_ENABLED !== 'false',
  cacheTtl: parseInt(process.env.ANALYTICS_CACHE_TTL || '3600'), // 1 hour
}

// Event types
export enum EventType {
  PAGE_VIEW = 'page_view',
  USER_SIGNUP = 'user_signup',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  TEST_CREATED = 'test_created',
  TEST_STARTED = 'test_started',
  TEST_COMPLETED = 'test_completed',
  TEST_SHARED = 'test_shared',
  QUESTION_ANSWERED = 'question_answered',
  CONSULTATION_REQUESTED = 'consultation_requested',
  CONSULTATION_STARTED = 'consultation_started',
  CONSULTATION_COMPLETED = 'consultation_completed',
  FILE_UPLOADED = 'file_uploaded',
  EMAIL_SENT = 'email_sent',
  ERROR_OCCURRED = 'error_occurred',
  FEATURE_USED = 'feature_used',
  SEARCH_PERFORMED = 'search_performed',
  EXPORT_GENERATED = 'export_generated',
  PAYMENT_PROCESSED = 'payment_processed',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
}

// Event properties
export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined
}

// Analytics event
export interface AnalyticsEvent {
  id?: string
  type: EventType
  userId?: string
  sessionId?: string
  timestamp: Date
  properties: EventProperties
  metadata: {
    userAgent?: string
    ip?: string
    referer?: string
    url?: string
    country?: string
    city?: string
    device?: string
    browser?: string
    os?: string
  }
}

// Metrics types
export interface Metrics {
  totalUsers: number
  activeUsers: number
  newUsers: number
  totalTests: number
  completedTests: number
  averageTestScore: number
  totalConsultations: number
  completedConsultations: number
  pageViews: number
  uniquePageViews: number
  bounceRate: number
  averageSessionDuration: number
  conversionRate: number
  revenue: number
  errorRate: number
}

// Time periods
export enum TimePeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

// Validation schemas
const analyticsSchemas = {
  event: z.object({
    type: z.nativeEnum(EventType),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
    properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    metadata: z.object({
      userAgent: z.string().optional(),
      ip: z.string().optional(),
      referer: z.string().optional(),
      url: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      device: z.string().optional(),
      browser: z.string().optional(),
      os: z.string().optional(),
    }).default({}),
  }),
  
  query: z.object({
    startDate: z.date(),
    endDate: z.date(),
    userId: z.string().optional(),
    eventType: z.nativeEnum(EventType).optional(),
    properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
}

// Analytics manager
export class AnalyticsManager {
  private static instance: AnalyticsManager
  private config: AnalyticsConfig
  private eventQueue: AnalyticsEvent[] = []
  private flushTimer?: NodeJS.Timeout
  private isProcessing = false

  private constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.startFlushTimer()
  }

  public static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager(config)
    }
    return AnalyticsManager.instance
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }

  private anonymizeIp(ip: string): string {
    if (!this.config.anonymizeIp) return ip
    
    // IPv4: Remove last octet
    if (ip.includes('.')) {
      const parts = ip.split('.')
      parts[3] = '0'
      return parts.join('.')
    }
    
    // IPv6: Remove last 80 bits
    if (ip.includes(':')) {
      const parts = ip.split(':')
      return parts.slice(0, 3).join(':') + '::'
    }
    
    return ip
  }

  private parseUserAgent(userAgent: string): {
    device: string
    browser: string
    os: string
  } {
    // Simple user agent parsing (in production, use a proper library like ua-parser-js)
    const device = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop'
    
    let browser = 'unknown'
    if (userAgent.includes('Chrome')) browser = 'chrome'
    else if (userAgent.includes('Firefox')) browser = 'firefox'
    else if (userAgent.includes('Safari')) browser = 'safari'
    else if (userAgent.includes('Edge')) browser = 'edge'
    
    let os = 'unknown'
    if (userAgent.includes('Windows')) os = 'windows'
    else if (userAgent.includes('Mac')) os = 'macos'
    else if (userAgent.includes('Linux')) os = 'linux'
    else if (userAgent.includes('Android')) os = 'android'
    else if (userAgent.includes('iOS')) os = 'ios'
    
    return { device, browser, os }
  }

  // Track event
  async track(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>): Promise<boolean> {
    if (!this.config.enabled) return false

    try {
      // Validate event
      const validation = analyticsSchemas.event.safeParse({
        ...event,
        timestamp: new Date(),
      })

      if (!validation.success) {
        await logger.error('Invalid analytics event', {
          event,
          errors: validation.error.errors,
        })
        return false
      }

      const validatedEvent = validation.data

      // Enhance metadata
      if (validatedEvent.metadata.userAgent) {
        const parsed = this.parseUserAgent(validatedEvent.metadata.userAgent)
        validatedEvent.metadata = {
          ...validatedEvent.metadata,
          ...parsed,
        }
      }

      if (validatedEvent.metadata.ip) {
        validatedEvent.metadata.ip = this.anonymizeIp(validatedEvent.metadata.ip)
      }

      // Add to queue
      this.eventQueue.push({
        id: crypto.randomUUID(),
        ...validatedEvent,
      })

      // Flush if batch size reached
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flush()
      }

      return true
    } catch (error) {
      await logger.error('Failed to track analytics event', { event }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Flush events to storage
  private async flush(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return

    this.isProcessing = true
    const eventsToProcess = [...this.eventQueue]
    this.eventQueue = []

    try {
      // Store events in database
      await prisma.analyticsEvent.createMany({
        data: eventsToProcess.map(event => ({
          id: event.id!,
          type: event.type,
          userId: event.userId,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          properties: event.properties as any,
          metadata: event.metadata as any,
        })),
        skipDuplicates: true,
      })

      // Send to external analytics service if configured
      if (this.config.apiEndpoint) {
        try {
          await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.trackingId && {
                'Authorization': `Bearer ${this.config.trackingId}`,
              }),
            },
            body: JSON.stringify({ events: eventsToProcess }),
          })
        } catch (error) {
          await logger.warn('Failed to send events to external analytics service', {}, error instanceof Error ? error : new Error(String(error)))
        }
      }

      await logger.debug('Analytics events flushed', {
        count: eventsToProcess.length,
      })
    } catch (error) {
      // Re-add events to queue on failure
      this.eventQueue.unshift(...eventsToProcess)
      await logger.error('Failed to flush analytics events', {
        count: eventsToProcess.length,
      }, error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.isProcessing = false
    }
  }

  // Get metrics for a time period
  async getMetrics(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string
      eventType?: EventType
    }
  ): Promise<Metrics> {
    try {
      const cacheKey = `metrics:${period}:${startDate.getTime()}:${endDate.getTime()}:${JSON.stringify(filters || {})}`
      
      // Try cache first
      if (this.config.enableCaching) {
        const cached = await CacheService.get<Metrics>(cacheKey)
        if (cached) return cached
      }

      // Build where clause
      const where: any = {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      }

      if (filters?.userId) {
        where.userId = filters.userId
      }

      if (filters?.eventType) {
        where.type = filters.eventType
      }

      // Get metrics from database
      const [events, users, tests, consultations] = await Promise.all([
        prisma.analyticsEvent.findMany({ where }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.test.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            results: true,
          },
        }),
        prisma.consultation.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ])

      // Calculate metrics
      const pageViews = events.filter(e => e.type === EventType.PAGE_VIEW).length
      const uniquePageViews = new Set(
        events
          .filter(e => e.type === EventType.PAGE_VIEW)
          .map(e => `${e.userId || e.sessionId}:${(e.metadata as any)?.url}`)
      ).size

      const completedTests = tests.filter(t => t.results.length > 0)
      const averageTestScore = completedTests.length > 0
        ? completedTests.reduce((sum, test) => {
            const avgScore = test.results.reduce((s, r) => s + (r.score || 0), 0) / test.results.length
            return sum + avgScore
          }, 0) / completedTests.length
        : 0

      const completedConsultations = consultations.filter(c => c.status === 'COMPLETED')
      
      const errorEvents = events.filter(e => e.type === EventType.ERROR_OCCURRED)
      const errorRate = events.length > 0 ? (errorEvents.length / events.length) * 100 : 0

      const metrics: Metrics = {
        totalUsers: users,
        activeUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
        newUsers: users,
        totalTests: tests.length,
        completedTests: completedTests.length,
        averageTestScore,
        totalConsultations: consultations.length,
        completedConsultations: completedConsultations.length,
        pageViews,
        uniquePageViews,
        bounceRate: 0, // Calculate based on single-page sessions
        averageSessionDuration: 0, // Calculate based on session events
        conversionRate: 0, // Calculate based on conversion events
        revenue: 0, // Calculate based on payment events
        errorRate,
      }

      // Cache metrics
      if (this.config.enableCaching) {
        await CacheService.set(cacheKey, metrics, this.config.cacheTtl)
      }

      return metrics
    } catch (error) {
      await logger.error('Failed to get analytics metrics', {
        period,
        startDate,
        endDate,
        filters,
      }, error instanceof Error ? error : new Error(String(error)))
      
      // Return empty metrics on error
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        totalTests: 0,
        completedTests: 0,
        averageTestScore: 0,
        totalConsultations: 0,
        completedConsultations: 0,
        pageViews: 0,
        uniquePageViews: 0,
        bounceRate: 0,
        averageSessionDuration: 0,
        conversionRate: 0,
        revenue: 0,
        errorRate: 0,
      }
    }
  }

  // Get events
  async getEvents(
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string
      eventType?: EventType
      limit?: number
      offset?: number
    }
  ): Promise<{ events: AnalyticsEvent[]; total: number }> {
    try {
      const where: any = {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      }

      if (filters?.userId) {
        where.userId = filters.userId
      }

      if (filters?.eventType) {
        where.type = filters.eventType
      }

      const [events, total] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: filters?.limit || 100,
          skip: filters?.offset || 0,
        }),
        prisma.analyticsEvent.count({ where }),
      ])

      return {
        events: events.map(event => ({
          id: event.id,
          type: event.type as EventType,
          userId: event.userId,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          properties: event.properties as EventProperties,
          metadata: event.metadata as any,
        })),
        total,
      }
    } catch (error) {
      await logger.error('Failed to get analytics events', {
        startDate,
        endDate,
        filters,
      }, error instanceof Error ? error : new Error(String(error)))
      
      return { events: [], total: 0 }
    }
  }

  // Clean up old events
  async cleanup(): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      const result = await prisma.analyticsEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      })

      await logger.info('Analytics cleanup completed', {
        deletedCount: result.count,
        cutoffDate,
      })

      return result.count
    } catch (error) {
      await logger.error('Analytics cleanup failed', {}, error instanceof Error ? error : new Error(String(error)))
      return 0
    }
  }

  // Get queue status
  getQueueStatus(): {
    queueSize: number
    isProcessing: boolean
    config: AnalyticsConfig
  } {
    return {
      queueSize: this.eventQueue.length,
      isProcessing: this.isProcessing,
      config: this.config,
    }
  }

  // Force flush
  async forceFlush(): Promise<void> {
    await this.flush()
  }
}

// Analytics service with predefined tracking methods
export class AnalyticsService {
  private static analyticsManager = AnalyticsManager.getInstance()

  // Page view tracking
  static async trackPageView(
    url: string,
    userId?: string,
    sessionId?: string,
    metadata?: AnalyticsEvent['metadata']
  ) {
    return this.analyticsManager.track({
      type: EventType.PAGE_VIEW,
      userId,
      sessionId,
      properties: { url },
      metadata: { url, ...metadata },
    })
  }

  // User events
  static async trackUserSignup(userId: string, properties?: EventProperties, metadata?: AnalyticsEvent['metadata']) {
    return this.analyticsManager.track({
      type: EventType.USER_SIGNUP,
      userId,
      properties: properties || {},
      metadata: metadata || {},
    })
  }

  static async trackUserLogin(userId: string, properties?: EventProperties, metadata?: AnalyticsEvent['metadata']) {
    return this.analyticsManager.track({
      type: EventType.USER_LOGIN,
      userId,
      properties: properties || {},
      metadata: metadata || {},
    })
  }

  static async trackUserLogout(userId: string, sessionId?: string, metadata?: AnalyticsEvent['metadata']) {
    return this.analyticsManager.track({
      type: EventType.USER_LOGOUT,
      userId,
      sessionId,
      properties: {},
      metadata: metadata || {},
    })
  }

  // Test events
  static async trackTestCreated(testId: string, userId: string, properties?: EventProperties) {
    return this.analyticsManager.track({
      type: EventType.TEST_CREATED,
      userId,
      properties: { testId, ...properties },
      metadata: {},
    })
  }

  static async trackTestStarted(testId: string, userId: string, sessionId?: string) {
    return this.analyticsManager.track({
      type: EventType.TEST_STARTED,
      userId,
      sessionId,
      properties: { testId },
      metadata: {},
    })
  }

  static async trackTestCompleted(
    testId: string,
    userId: string,
    score: number,
    duration: number,
    sessionId?: string
  ) {
    return this.analyticsManager.track({
      type: EventType.TEST_COMPLETED,
      userId,
      sessionId,
      properties: { testId, score, duration },
      metadata: {},
    })
  }

  // Consultation events
  static async trackConsultationRequested(consultationId: string, userId: string, properties?: EventProperties) {
    return this.analyticsManager.track({
      type: EventType.CONSULTATION_REQUESTED,
      userId,
      properties: { consultationId, ...properties },
      metadata: {},
    })
  }

  static async trackConsultationStarted(consultationId: string, userId: string, sessionId?: string) {
    return this.analyticsManager.track({
      type: EventType.CONSULTATION_STARTED,
      userId,
      sessionId,
      properties: { consultationId },
      metadata: {},
    })
  }

  static async trackConsultationCompleted(
    consultationId: string,
    userId: string,
    duration: number,
    rating?: number
  ) {
    return this.analyticsManager.track({
      type: EventType.CONSULTATION_COMPLETED,
      userId,
      properties: { consultationId, duration, rating },
      metadata: {},
    })
  }

  // Feature usage
  static async trackFeatureUsed(
    feature: string,
    userId?: string,
    sessionId?: string,
    properties?: EventProperties
  ) {
    return this.analyticsManager.track({
      type: EventType.FEATURE_USED,
      userId,
      sessionId,
      properties: { feature, ...properties },
      metadata: {},
    })
  }

  // Error tracking
  static async trackError(
    error: string,
    userId?: string,
    sessionId?: string,
    properties?: EventProperties,
    metadata?: AnalyticsEvent['metadata']
  ) {
    return this.analyticsManager.track({
      type: EventType.ERROR_OCCURRED,
      userId,
      sessionId,
      properties: { error, ...properties },
      metadata: metadata || {},
    })
  }

  // Search tracking
  static async trackSearch(
    query: string,
    results: number,
    userId?: string,
    sessionId?: string
  ) {
    return this.analyticsManager.track({
      type: EventType.SEARCH_PERFORMED,
      userId,
      sessionId,
      properties: { query, results },
      metadata: {},
    })
  }

  // Generic event tracking
  static async track(event: Omit<AnalyticsEvent, 'id' | 'timestamp'>) {
    return this.analyticsManager.track(event)
  }

  // Get metrics
  static async getMetrics(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    filters?: { userId?: string; eventType?: EventType }
  ) {
    return this.analyticsManager.getMetrics(period, startDate, endDate, filters)
  }

  // Get events
  static async getEvents(
    startDate: Date,
    endDate: Date,
    filters?: {
      userId?: string
      eventType?: EventType
      limit?: number
      offset?: number
    }
  ) {
    return this.analyticsManager.getEvents(startDate, endDate, filters)
  }

  // Cleanup
  static async cleanup() {
    return this.analyticsManager.cleanup()
  }

  // Get status
  static getStatus() {
    return this.analyticsManager.getQueueStatus()
  }

  // Force flush
  static async flush() {
    return this.analyticsManager.forceFlush()
  }
}

// Export singleton instance
export const analyticsManager = AnalyticsManager.getInstance()
export default AnalyticsService
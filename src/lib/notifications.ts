import { logger } from './logger'
import { EmailService } from './email'
import { CacheService } from './cache'
import { z } from 'zod'
import { Server as SocketIOServer } from 'socket.io'

// Notification configuration
interface NotificationConfig {
  enabled: boolean
  channels: {
    email: boolean
    push: boolean
    sms: boolean
    inApp: boolean
    realtime: boolean
  }
  batchSize: number
  retryAttempts: number
  retryDelay: number
  queueProcessInterval: number
  defaultExpiry: number
  rateLimiting: {
    enabled: boolean
    maxPerUser: number
    timeWindow: number
  }
  templates: {
    enabled: boolean
    cacheTtl: number
  }
}

const defaultConfig: NotificationConfig = {
  enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
  channels: {
    email: process.env.NOTIFICATIONS_EMAIL_ENABLED !== 'false',
    push: process.env.NOTIFICATIONS_PUSH_ENABLED === 'true',
    sms: process.env.NOTIFICATIONS_SMS_ENABLED === 'true',
    inApp: process.env.NOTIFICATIONS_IN_APP_ENABLED !== 'false',
    realtime: process.env.NOTIFICATIONS_REALTIME_ENABLED !== 'false',
  },
  batchSize: parseInt(process.env.NOTIFICATIONS_BATCH_SIZE || '50'),
  retryAttempts: parseInt(process.env.NOTIFICATIONS_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.NOTIFICATIONS_RETRY_DELAY || '5000'),
  queueProcessInterval: parseInt(process.env.NOTIFICATIONS_QUEUE_INTERVAL || '10000'),
  defaultExpiry: parseInt(process.env.NOTIFICATIONS_DEFAULT_EXPIRY || '604800'), // 7 days
  rateLimiting: {
    enabled: process.env.NOTIFICATIONS_RATE_LIMITING_ENABLED !== 'false',
    maxPerUser: parseInt(process.env.NOTIFICATIONS_MAX_PER_USER || '100'),
    timeWindow: parseInt(process.env.NOTIFICATIONS_RATE_WINDOW || '3600'), // 1 hour
  },
  templates: {
    enabled: process.env.NOTIFICATIONS_TEMPLATES_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.NOTIFICATIONS_TEMPLATE_CACHE_TTL || '3600'),
  },
}

// Notification types
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  REMINDER = 'reminder',
  INVITATION = 'invitation',
  ANNOUNCEMENT = 'announcement',
  SYSTEM = 'system',
}

// Notification channels
export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app',
  REALTIME = 'realtime',
}

// Notification priority
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Notification status
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

// Notification interfaces
export interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  channels: NotificationChannel[]
  subject: string
  content: string
  variables: string[]
  metadata?: Record<string, any>
}

export interface NotificationData {
  id?: string
  userId: string
  type: NotificationType
  priority: NotificationPriority
  channels: NotificationChannel[]
  subject: string
  content: string
  data?: Record<string, any>
  templateId?: string
  templateVariables?: Record<string, any>
  scheduledAt?: Date
  expiresAt?: Date
  metadata?: Record<string, any>
}

export interface NotificationPreferences {
  userId: string
  channels: {
    email: boolean
    push: boolean
    sms: boolean
    inApp: boolean
    realtime: boolean
  }
  types: {
    [key in NotificationType]: boolean
  }
  quietHours: {
    enabled: boolean
    start: string // HH:mm format
    end: string // HH:mm format
    timezone: string
  }
  frequency: {
    immediate: boolean
    digest: boolean
    digestFrequency: 'daily' | 'weekly'
  }
}

export interface QueuedNotification extends Omit<NotificationData, 'data'> {
  id: string
  data: Record<string, any>
  status: NotificationStatus
  attempts: number
  lastAttempt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

// Validation schemas
const notificationSchemas = {
  notification: z.object({
    userId: z.string().uuid('Invalid user ID'),
    type: z.nativeEnum(NotificationType),
    priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
    channels: z.array(z.nativeEnum(NotificationChannel)).min(1, 'At least one channel required'),
    subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
    content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
    data: z.record(z.any()).optional(),
    templateId: z.string().optional(),
    templateVariables: z.record(z.any()).optional(),
    scheduledAt: z.date().optional(),
    expiresAt: z.date().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  
  preferences: z.object({
    userId: z.string().uuid(),
    channels: z.object({
      email: z.boolean().default(true),
      push: z.boolean().default(true),
      sms: z.boolean().default(false),
      inApp: z.boolean().default(true),
      realtime: z.boolean().default(true),
    }),
    types: z.record(z.nativeEnum(NotificationType), z.boolean()),
    quietHours: z.object({
      enabled: z.boolean().default(false),
      start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
      end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
      timezone: z.string().default('UTC'),
    }),
    frequency: z.object({
      immediate: z.boolean().default(true),
      digest: z.boolean().default(false),
      digestFrequency: z.enum(['daily', 'weekly']).default('daily'),
    }),
  }),
}

// Notification manager
export class NotificationManager {
  private static instance: NotificationManager
  private config: NotificationConfig
  private queue: QueuedNotification[] = []
  private templates: Map<string, NotificationTemplate> = new Map()
  private socketServer?: SocketIOServer
  private isProcessing = false
  private processTimer?: NodeJS.Timeout

  private constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.loadTemplates()
    this.startQueueProcessor()
  }

  public static getInstance(config?: Partial<NotificationConfig>): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager(config)
    }
    return NotificationManager.instance
  }

  // Set Socket.IO server for realtime notifications
  setSocketServer(server: SocketIOServer): void {
    this.socketServer = server
  }

  private async loadTemplates(): Promise<void> {
    if (!this.config.templates.enabled) return

    try {
      // Load default templates instead of from database
      // since notificationTemplate model doesn't exist in Prisma schema
      const defaultTemplates = [
        {
          id: 'welcome_email',
          name: 'Welcome Email',
          type: 'email' as const,
          subject: 'Welcome to {{appName}}!',
          body: 'Hi {{userName}}, welcome to {{appName}}! We\'re excited to have you on board.',
          variables: ['appName', 'userName'],
          active: true,
        },
        {
          id: 'test_results',
          name: 'Test Results',
          type: 'email' as const,
          subject: 'Your test results for {{testName}}',
          body: 'Hi {{userName}}, your test results for {{testName}} are now available. You scored {{score}}%.',
          variables: ['userName', 'testName', 'score'],
          active: true,
        },
      ]

      for (const template of defaultTemplates) {
        this.templates.set(template.id, {
          id: template.id,
          name: template.name,
          type: NotificationType.INFO,
          channels: [NotificationChannel.EMAIL],
          subject: template.subject,
          content: template.body,
          variables: template.variables,
        })
      }

      await logger.info('Notification templates loaded', {
        count: this.templates.size,
      })
    } catch (error) {
      await logger.error('Failed to load notification templates', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const cacheKey = `user:${userId}:notification-preferences`
      
      // Try cache first
      const cached = await CacheService.get<NotificationPreferences>(cacheKey)
      if (cached) return cached

      // Return default preferences since we don't have a database model
      const defaultPreferences: NotificationPreferences = {
        userId,
        channels: {
          email: true,
          push: true,
          sms: false,
          inApp: true,
          realtime: true,
        },
        types: {
          [NotificationType.INFO]: true,
          [NotificationType.SUCCESS]: true,
          [NotificationType.WARNING]: true,
          [NotificationType.ERROR]: true,
          [NotificationType.REMINDER]: true,
          [NotificationType.INVITATION]: true,
          [NotificationType.ANNOUNCEMENT]: true,
          [NotificationType.SYSTEM]: true,
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
      }

      // Cache preferences
      await CacheService.set(cacheKey, defaultPreferences, 3600) // 1 hour
      
      return defaultPreferences
    } catch (error) {
      await logger.error('Failed to get user notification preferences', { userId }, error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  private async checkRateLimit(userId: string): Promise<boolean> {
    if (!this.config.rateLimiting.enabled) return true

    try {
      const key = `notification-rate-limit:${userId}`
      const current = await CacheService.get<number>(key) || 0
      
      if (current >= this.config.rateLimiting.maxPerUser) {
        return false
      }

      // Manually increment since CacheService doesn't have a generic increment method
      await CacheService.set(key, current + 1, this.config.rateLimiting.timeWindow)
      return true
    } catch (error) {
      await logger.error('Rate limit check failed', { userId }, error instanceof Error ? error : new Error(String(error)))
      return true // Allow on error
    }
  }

  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) return false

    try {
      const now = new Date()
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: preferences.quietHours.timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).format(now)

      const timeParts = userTime.split(':').map(Number)
      const [currentHour, currentMinute] = timeParts
      
      if (currentHour === undefined || currentMinute === undefined) {
        throw new Error('Invalid time format')
      }
      
      const currentMinutes = currentHour * 60 + currentMinute

      const startParts = preferences.quietHours.start.split(':').map(Number)
      const [startHour, startMinute] = startParts
      
      if (startHour === undefined || startMinute === undefined) {
        throw new Error('Invalid start time format')
      }
      
      const startMinutes = startHour * 60 + startMinute

      const endParts = preferences.quietHours.end.split(':').map(Number)
      const [endHour, endMinute] = endParts
      
      if (endHour === undefined || endMinute === undefined) {
        throw new Error('Invalid end time format')
      }
      
      const endMinutes = endHour * 60 + endMinute

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes
      } else {
        // Quiet hours span midnight
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes
      }
    } catch (error) {
      logger.error('Failed to check quiet hours', { preferences }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  private async compileTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; content: string }> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error(`Notification template '${templateId}' not found`)
    }

    // Simple template compilation (in production, use a proper template engine)
    let subject = template.subject
    let content = template.content

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value))
      content = content.replace(new RegExp(placeholder, 'g'), String(value))
    }

    return { subject, content }
  }

  private async sendToChannel(
    notification: QueuedNotification,
    channel: NotificationChannel,
    preferences: NotificationPreferences
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Map channel enum to preferences property
      const channelKey = channel === NotificationChannel.IN_APP ? 'inApp' : channel as keyof typeof preferences.channels
      
      // Check if channel is enabled for user
      if (!preferences.channels[channelKey]) {
        return { success: false, error: 'Channel disabled by user' }
      }

      switch (channel) {
        case NotificationChannel.EMAIL:
          if (!this.config.channels.email) {
            return { success: false, error: 'Email channel disabled' }
          }
          
          const emailResult = await EmailService.sendNotificationEmail(
            notification.userId, // This should be email address in real implementation
            notification.subject,
            notification.content,
            notification.priority === NotificationPriority.URGENT ? 'high' : 'normal'
          )
          
          return emailResult

        case NotificationChannel.PUSH:
          if (!this.config.channels.push) {
            return { success: false, error: 'Push channel disabled' }
          }
          
          // Implement push notification logic here
          await logger.info('Push notification sent', {
            userId: notification.userId,
            subject: notification.subject,
          })
          
          return { success: true }

        case NotificationChannel.SMS:
          if (!this.config.channels.sms) {
            return { success: false, error: 'SMS channel disabled' }
          }
          
          // Implement SMS logic here
          await logger.info('SMS notification sent', {
            userId: notification.userId,
            content: notification.content,
          })
          
          return { success: true }

        case NotificationChannel.IN_APP:
          if (!this.config.channels.inApp) {
            return { success: false, error: 'In-app channel disabled' }
          }
          
          // Store in memory for in-app display
          const inAppNotification = {
            id: notification.id,
            userId: notification.userId,
            type: notification.type,
            priority: notification.priority,
            subject: notification.subject,
            content: notification.content,
            data: notification.data,
            status: NotificationStatus.DELIVERED,
            expiresAt: notification.expiresAt,
            metadata: notification.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          
          // Store in cache for retrieval
          await CacheService.set(
            `notification:${notification.id}`,
            JSON.stringify(inAppNotification),
            3600 // 1 hour cache
          )
          
          return { success: true }

        case NotificationChannel.REALTIME:
          if (!this.config.channels.realtime || !this.socketServer) {
            return { success: false, error: 'Realtime channel disabled or not configured' }
          }
          
          // Send via Socket.IO
          this.socketServer.to(`user:${notification.userId}`).emit('notification', {
            id: notification.id,
            type: notification.type,
            priority: notification.priority,
            subject: notification.subject,
            content: notification.content,
            data: notification.data,
            timestamp: new Date(),
          })
          
          return { success: true }

        default:
          return { success: false, error: 'Unknown channel' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Send notification
  async send(notificationData: NotificationData): Promise<{ success: boolean; id: string; errors?: string[] }> {
    try {
      if (!this.config.enabled) {
        return { success: false, id: '', errors: ['Notifications disabled'] }
      }

      // Validate notification data
      const validation = notificationSchemas.notification.safeParse(notificationData)
      if (!validation.success) {
        return {
          success: false,
          id: '',
          errors: validation.error.errors.map(e => e.message),
        }
      }

      const validatedData = validation.data
      const { id: notificationId = crypto.randomUUID() } = notificationData

      // Check rate limit
      const rateLimitOk = await this.checkRateLimit(validatedData.userId)
      if (!rateLimitOk) {
        return {
          success: false,
          id: notificationId,
          errors: ['Rate limit exceeded'],
        }
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(validatedData.userId)
      if (!preferences) {
        return {
          success: false,
          id: notificationId,
          errors: ['User preferences not found'],
        }
      }

      // Check if notification type is enabled
      if (!preferences.types[validatedData.type]) {
        return {
          success: false,
          id: notificationId,
          errors: ['Notification type disabled by user'],
        }
      }

      // Check quiet hours for non-urgent notifications
      if (
        validatedData.priority !== NotificationPriority.URGENT &&
        this.isInQuietHours(preferences)
      ) {
        // Schedule for later
        const scheduledAt = new Date()
        const endTimeParts = preferences.quietHours.end.split(':')
        const [endHour, endMinute] = endTimeParts
        
        if (!endHour || !endMinute) {
          throw new Error('Invalid quiet hours end time format')
        }
        
        scheduledAt.setHours(parseInt(endHour))
        scheduledAt.setMinutes(parseInt(endMinute))
        
        if (scheduledAt <= new Date()) {
          scheduledAt.setDate(scheduledAt.getDate() + 1)
        }
        
        validatedData.scheduledAt = scheduledAt
      }

      // Compile template if provided
      let { subject, content } = validatedData
      
      if (validatedData.templateId && validatedData.templateVariables) {
        const compiled: { subject: string; content: string } = await this.compileTemplate(
          validatedData.templateId,
          validatedData.templateVariables
        )
        ({ subject, content } = compiled)
      }

      // Create queued notification
      const queuedNotification: QueuedNotification = {
        id: notificationId,
        userId: validatedData.userId,
        type: validatedData.type,
        priority: validatedData.priority,
        channels: validatedData.channels,
        subject,
        content,
        data: validatedData.data || {},
        ...(validatedData.templateId && { templateId: validatedData.templateId }),
        ...(validatedData.templateVariables && { templateVariables: validatedData.templateVariables }),
        ...(validatedData.scheduledAt && { scheduledAt: validatedData.scheduledAt }),
        expiresAt: validatedData.expiresAt || new Date(Date.now() + this.config.defaultExpiry * 1000),
        ...(validatedData.metadata && { metadata: validatedData.metadata }),
        status: NotificationStatus.PENDING,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Add to queue
      this.queue.push(queuedNotification)

      await logger.info('Notification queued', {
        id: notificationId,
        userId: validatedData.userId,
        type: validatedData.type,
        channels: validatedData.channels,
      })

      return { success: true, id: notificationId }
    } catch (error) {
      await logger.error('Failed to send notification', { notificationData }, error instanceof Error ? error : new Error(String(error)))
      return {
        success: false,
        id: '',
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  // Process notification queue
  private async startQueueProcessor(): Promise<void> {
    if (this.processTimer) {
      clearInterval(this.processTimer)
    }

    this.processTimer = setInterval(() => {
      this.processQueue()
    }, this.config.queueProcessInterval)
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true

    try {
      const now = new Date()
      const notificationsToProcess = this.queue.filter(
        notification =>
          notification.status === NotificationStatus.PENDING &&
          (!notification.scheduledAt || notification.scheduledAt <= now) &&
          (!notification.expiresAt || notification.expiresAt > now) &&
          notification.attempts < this.config.retryAttempts
      )

      const batch = notificationsToProcess.slice(0, this.config.batchSize)

      for (const notification of batch) {
        try {
          const preferences = await this.getUserPreferences(notification.userId)
          if (!preferences) {
            notification.status = NotificationStatus.FAILED
            notification.error = 'User preferences not found'
            continue
          }

          const results: { channel: NotificationChannel; success: boolean; error?: string }[] = []
          
          // Filter channels based on user preferences
          const enabledChannels = notification.channels.filter(
            channel => preferences.channels[channel]
          )

          // Send to each enabled channel
          for (const channel of enabledChannels) {
            const result = await this.sendToChannel(notification, channel, preferences)
            results.push({ channel, ...result })
          }

          // Update notification status
          const successfulChannels = results.filter(r => r.success)
          const failedChannels = results.filter(r => !r.success)

          if (successfulChannels.length > 0) {
            notification.status = NotificationStatus.SENT
            notification.updatedAt = new Date()
            
            // Remove from queue if sent successfully
            this.queue = this.queue.filter(n => n.id !== notification.id)
            
            await logger.info('Notification sent successfully', {
              id: notification.id,
              successfulChannels: successfulChannels.map(c => c.channel),
              failedChannels: failedChannels.map(c => c.channel),
            })
          } else {
            notification.attempts++
            notification.lastAttempt = new Date()
            notification.error = failedChannels.map(c => `${c.channel}: ${c.error}`).join(', ')
            
            if (notification.attempts >= this.config.retryAttempts) {
              notification.status = NotificationStatus.FAILED
              
              // Remove from queue
              this.queue = this.queue.filter(n => n.id !== notification.id)
              
              await logger.error('Notification failed permanently', {
                id: notification.id,
                attempts: notification.attempts,
                errors: notification.error,
              })
            } else {
              // Schedule retry
              notification.scheduledAt = new Date(
                Date.now() + this.config.retryDelay * notification.attempts
              )
              
              await logger.warn('Notification failed, retrying', {
                id: notification.id,
                attempts: notification.attempts,
                nextAttempt: notification.scheduledAt,
                errors: notification.error,
              })
            }
          }
        } catch (error) {
          notification.attempts++
          notification.lastAttempt = new Date()
          notification.error = error instanceof Error ? error.message : String(error)
          
          await logger.error('Error processing notification', {
            id: notification.id,
            error: notification.error,
          }, error instanceof Error ? error : new Error(String(error)))
        }
      }

      // Clean up expired notifications
      const expiredCount = this.queue.length
      this.queue = this.queue.filter(notification => notification.expiresAt > now)
      const removedExpired = expiredCount - this.queue.length
      
      if (removedExpired > 0) {
        await logger.info('Removed expired notifications', { count: removedExpired })
      }
    } catch (error) {
      await logger.error('Queue processing error', {}, error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.isProcessing = false
    }
  }

  // Get user notifications
  async getUserNotifications(
    userId: string,
    options: {
      limit?: number
      offset?: number
      unreadOnly?: boolean
      type?: NotificationType
    } = {}
  ): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
    try {
      const where: any = { userId }
      
      if (options.unreadOnly) {
        where.status = { not: NotificationStatus.READ }
      }
      
      if (options.type) {
        where.type = options.type
      }

      // Get notifications from cache
      const cacheKey = `user:${userId}:notifications`
      const cachedData = await CacheService.get(cacheKey)
      let userNotifications: any[] = []
      
      if (cachedData) {
        userNotifications = JSON.parse(cachedData)
      }
      
      // Filter notifications
      let filteredNotifications = userNotifications.filter(n => {
        if (options.unreadOnly && n.status === NotificationStatus.READ) return false
        if (options.type && n.type !== options.type) return false
        return true
      })
      
      // Sort by creation time (newest first)
      filteredNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      const total = filteredNotifications.length
      const unreadCount = userNotifications.filter(n => n.status !== NotificationStatus.READ).length
      
      // Apply pagination
      const offset = options.offset || 0
      const limit = options.limit || 50
      const notifications = filteredNotifications.slice(offset, offset + limit)

      return { notifications, total, unreadCount }
    } catch (error) {
      await logger.error('Failed to get user notifications', { userId, options }, error instanceof Error ? error : new Error(String(error)))
      return { notifications: [], total: 0, unreadCount: 0 }
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      // Get user notifications from cache
      const cacheKey = `user:${userId}:notifications`
      const cachedData = await CacheService.get(cacheKey)
      let userNotifications: any[] = []
      
      if (cachedData) {
        userNotifications = JSON.parse(cachedData)
      }
      
      // Find and update the notification
      const notificationIndex = userNotifications.findIndex(n => n.id === notificationId)
      if (notificationIndex !== -1) {
        userNotifications[notificationIndex].status = NotificationStatus.READ
        userNotifications[notificationIndex].readAt = new Date()
        userNotifications[notificationIndex].updatedAt = new Date()
        
        // Update cache
        await CacheService.set(cacheKey, JSON.stringify(userNotifications), 3600)
        
        // Also update individual notification cache
        await CacheService.set(
          `notification:${notificationId}`,
          JSON.stringify(userNotifications[notificationIndex]),
          3600
        )
      }
      
      return true
    } catch (error) {
      await logger.error('Failed to mark notification as read', { notificationId, userId }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<number> {
    try {
      // Get user notifications from cache
      const cacheKey = `user_notifications:${userId}`
      const cachedNotifications = await CacheService.get(cacheKey)
      
      if (!cachedNotifications) {
        return 0
      }
      
      const notifications = JSON.parse(cachedNotifications)
      let updatedCount = 0
      const now = new Date()
      
      // Update unread notifications to read status
      const updatedNotifications = notifications.map((notification: any) => {
        if (notification.status !== NotificationStatus.READ) {
          updatedCount++
          return {
            ...notification,
            status: NotificationStatus.READ,
            readAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        }
        return notification
      })
      
      // Update cache with modified notifications
      await CacheService.set(cacheKey, JSON.stringify(updatedNotifications), 3600) // 1 hour
      
      // Update individual notification caches
      for (const notification of updatedNotifications) {
        if (notification.status === NotificationStatus.READ) {
          const notificationCacheKey = `notification:${notification.id}`
          await CacheService.set(notificationCacheKey, JSON.stringify(notification), 3600)
        }
      }
      
      return updatedCount
    } catch (error) {
      await logger.error('Failed to mark all notifications as read', { userId }, error instanceof Error ? error : new Error(String(error)))
      return 0
    }
  }

  // Update user preferences
  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      const validation = notificationSchemas.preferences.safeParse({
        userId,
        ...preferences,
      })
      
      if (!validation.success) {
        await logger.error('Invalid notification preferences', {
          userId,
          preferences,
          errors: validation.error.errors,
        })
        return false
      }

      // Store preferences in cache
      const cacheKey = `user:${userId}:notification-preferences`
      const preferencesData = {
        userId,
        channels: validation.data.channels,
        types: validation.data.types,
        quietHours: validation.data.quietHours,
        frequency: validation.data.frequency,
        updatedAt: new Date().toISOString()
      }
      
      await CacheService.set(cacheKey, JSON.stringify(preferencesData), 3600) // 1 hour
      
      return true
    } catch (error) {
      await logger.error('Failed to update notification preferences', { userId, preferences }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Get queue status
  getQueueStatus(): {
    total: number
    pending: number
    processing: boolean
    failed: number
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter(n => n.status === NotificationStatus.PENDING).length,
      processing: this.isProcessing,
      failed: this.queue.filter(n => n.status === NotificationStatus.FAILED).length,
    }
  }

  // Force process queue
  async forceProcessQueue(): Promise<void> {
    await this.processQueue()
  }
}

// Notification service with predefined methods
export class NotificationService {
  private static notificationManager = NotificationManager.getInstance()

  // Set Socket.IO server
  static setSocketServer(server: SocketIOServer): void {
    this.notificationManager.setSocketServer(server)
  }

  // Welcome notification
  static async sendWelcomeNotification(userId: string) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.INFO,
      priority: NotificationPriority.NORMAL,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      subject: 'Welcome to KNI Platform!',
      content: 'Welcome to our platform! We\'re excited to have you on board.',
    })
  }

  // Test invitation
  static async sendTestInvitation(
    userId: string,
    testTitle: string,
    testUrl: string,
    dueDate: string
  ) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.INVITATION,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.REALTIME],
      subject: `Test Invitation: ${testTitle}`,
      content: `You have been invited to take the test "${testTitle}". Due date: ${dueDate}`,
      data: { testUrl, dueDate },
    })
  }

  // Test reminder
  static async sendTestReminder(
    userId: string,
    testTitle: string,
    testUrl: string,
    timeRemaining: string
  ) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.REMINDER,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.PUSH],
      subject: `Test Reminder: ${testTitle}`,
      content: `Don't forget to complete your test "${testTitle}". Time remaining: ${timeRemaining}`,
      data: { testUrl, timeRemaining },
    })
  }

  // Test results
  static async sendTestResults(
    userId: string,
    testTitle: string,
    score: number,
    resultsUrl: string
  ) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.SUCCESS,
      priority: NotificationPriority.NORMAL,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      subject: `Test Results: ${testTitle}`,
      content: `Your test results for "${testTitle}" are ready. Score: ${score}%`,
      data: { score, resultsUrl },
    })
  }

  // Consultation reminder
  static async sendConsultationReminder(
    userId: string,
    consultationTime: string,
    consultantName: string
  ) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.REMINDER,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP, NotificationChannel.PUSH],
      subject: 'Consultation Reminder',
      content: `Your consultation with ${consultantName} is scheduled for ${consultationTime}`,
      data: { consultationTime, consultantName },
    })
  }

  // System announcement
  static async sendSystemAnnouncement(
    userIds: string[],
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.NORMAL
  ) {
    const promises = userIds.map(userId =>
      this.notificationManager.send({
        userId,
        type: NotificationType.ANNOUNCEMENT,
        priority,
        channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME],
        subject: title,
        content: message,
      })
    )
    
    return Promise.all(promises)
  }

  // Error notification
  static async sendErrorNotification(
    userId: string,
    error: string,
    context?: Record<string, any>
  ) {
    return this.notificationManager.send({
      userId,
      type: NotificationType.ERROR,
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME],
      subject: 'Error Occurred',
      content: `An error occurred: ${error}`,
      data: context,
    })
  }

  // Generic methods
  static async send(notification: NotificationData) {
    return this.notificationManager.send(notification)
  }

  static async getUserNotifications(userId: string, options?: any) {
    return this.notificationManager.getUserNotifications(userId, options)
  }

  static async markAsRead(notificationId: string, userId: string) {
    return this.notificationManager.markAsRead(notificationId, userId)
  }

  static async markAllAsRead(userId: string) {
    return this.notificationManager.markAllAsRead(userId)
  }

  static async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>) {
    return this.notificationManager.updatePreferences(userId, preferences)
  }

  static getQueueStatus() {
    return this.notificationManager.getQueueStatus()
  }

  static async forceProcessQueue() {
    return this.notificationManager.forceProcessQueue()
  }
}

// Export singleton instance
export const notificationManager = NotificationManager.getInstance()
export default NotificationService
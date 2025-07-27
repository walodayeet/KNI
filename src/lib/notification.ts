import { z } from 'zod'
import { logger } from './logger'
import { CacheService } from './cache'
import { QueueManager } from './queue'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { ExternalAPIClient } from './external-api'

// Notification configuration
interface NotificationConfig {
  enablePushNotifications: boolean
  enableEmailNotifications: boolean
  enableSMSNotifications: boolean
  enableInAppNotifications: boolean
  enableWebhookNotifications: boolean
  defaultRetryAttempts: number
  defaultRetryDelay: number
  batchSize: number
  batchDelay: number
  enablePersistence: boolean
  enableMetrics: boolean
  enableRateLimiting: boolean
  rateLimitWindow: number
  rateLimitMax: number
}

const defaultNotificationConfig: NotificationConfig = {
  enablePushNotifications: process.env.ENABLE_PUSH_NOTIFICATIONS === 'true',
  enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  enableSMSNotifications: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
  enableInAppNotifications: true,
  enableWebhookNotifications: process.env.ENABLE_WEBHOOK_NOTIFICATIONS === 'true',
  defaultRetryAttempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS || '3'),
  defaultRetryDelay: parseInt(process.env.NOTIFICATION_RETRY_DELAY || '5000'),
  batchSize: parseInt(process.env.NOTIFICATION_BATCH_SIZE || '100'),
  batchDelay: parseInt(process.env.NOTIFICATION_BATCH_DELAY || '1000'),
  enablePersistence: process.env.NOTIFICATION_ENABLE_PERSISTENCE === 'true',
  enableMetrics: true,
  enableRateLimiting: process.env.NOTIFICATION_ENABLE_RATE_LIMITING === 'true',
  rateLimitWindow: parseInt(process.env.NOTIFICATION_RATE_LIMIT_WINDOW || '3600000'), // 1 hour
  rateLimitMax: parseInt(process.env.NOTIFICATION_RATE_LIMIT_MAX || '100'),
}

// Notification interfaces
interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  subject?: string
  title?: string
  body: string
  htmlBody?: string
  variables: string[]
  metadata?: Record<string, any>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface NotificationChannel {
  id: string
  name: string
  type: NotificationType
  config: ChannelConfig
  isActive: boolean
  priority: number
  rateLimits?: RateLimitConfig
  retryConfig?: RetryConfig
  createdAt: Date
  updatedAt: Date
}

interface ChannelConfig {
  // Email channel
  email?: {
    provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun' | 'postmark'
    apiKey?: string
    fromEmail: string
    fromName?: string
    replyTo?: string
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpPassword?: string
    smtpSecure?: boolean
  }
  
  // Push notification channel
  push?: {
    provider: 'fcm' | 'apns' | 'web-push' | 'onesignal' | 'pusher'
    apiKey?: string
    serverKey?: string
    appId?: string
    vapidKeys?: {
      publicKey: string
      privateKey: string
    }
    apnsCertificate?: string
    apnsKey?: string
    apnsKeyId?: string
    apnsTeamId?: string
  }
  
  // SMS channel
  sms?: {
    provider: 'twilio' | 'aws-sns' | 'nexmo' | 'messagebird'
    apiKey?: string
    apiSecret?: string
    fromNumber?: string
    accountSid?: string
    authToken?: string
  }
  
  // Webhook channel
  webhook?: {
    url: string
    method: 'POST' | 'PUT' | 'PATCH'
    headers?: Record<string, string>
    authentication?: {
      type: 'none' | 'basic' | 'bearer' | 'api-key'
      credentials?: Record<string, string>
    }
    timeout?: number
    retries?: number
  }
  
  // Slack channel
  slack?: {
    webhookUrl?: string
    botToken?: string
    channel?: string
    username?: string
    iconEmoji?: string
  }
  
  // Discord channel
  discord?: {
    webhookUrl: string
    username?: string
    avatarUrl?: string
  }
  
  // Microsoft Teams channel
  teams?: {
    webhookUrl: string
  }
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RetryConfig {
  attempts: number
  delay: number
  backoffFactor?: number
  maxDelay?: number
}

type NotificationType = 'email' | 'push' | 'sms' | 'webhook' | 'in-app' | 'slack' | 'discord' | 'teams'
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'
type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled'

interface Notification {
  id: string
  type: NotificationType
  priority: NotificationPriority
  status: NotificationStatus
  templateId?: string
  channelId?: string
  recipient: NotificationRecipient
  subject?: string
  title?: string
  body: string
  htmlBody?: string
  data?: Record<string, any>
  metadata?: Record<string, any>
  scheduledAt?: Date
  sentAt?: Date
  deliveredAt?: Date
  failedAt?: Date
  error?: string
  retryCount: number
  maxRetries: number
  createdAt: Date
  updatedAt: Date
}

interface NotificationRecipient {
  id?: string
  email?: string
  phone?: string
  deviceToken?: string
  userId?: string
  webhookUrl?: string
  slackChannel?: string
  discordChannel?: string
  teamsChannel?: string
  preferences?: NotificationPreferences
}

interface NotificationPreferences {
  email?: boolean
  push?: boolean
  sms?: boolean
  inApp?: boolean
  webhook?: boolean
  quietHours?: {
    enabled: boolean
    start: string // HH:mm format
    end: string // HH:mm format
    timezone?: string
  }
  frequency?: {
    email?: 'immediate' | 'hourly' | 'daily' | 'weekly'
    push?: 'immediate' | 'hourly' | 'daily' | 'weekly'
    sms?: 'immediate' | 'hourly' | 'daily' | 'weekly'
  }
}

interface NotificationBatch {
  id: string
  notifications: Notification[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
  results?: BatchResult[]
}

interface BatchResult {
  notificationId: string
  status: NotificationStatus
  error?: string
  sentAt?: Date
  deliveredAt?: Date
}

interface NotificationMetrics {
  totalSent: number
  totalDelivered: number
  totalFailed: number
  deliveryRate: number
  averageDeliveryTime: number
  channelMetrics: Map<string, ChannelMetrics>
  typeMetrics: Map<NotificationType, TypeMetrics>
}

interface ChannelMetrics {
  channelId: string
  channelName: string
  totalSent: number
  totalDelivered: number
  totalFailed: number
  deliveryRate: number
  averageDeliveryTime: number
  lastUsed?: Date
}

interface TypeMetrics {
  type: NotificationType
  totalSent: number
  totalDelivered: number
  totalFailed: number
  deliveryRate: number
  averageDeliveryTime: number
}

// Zod schemas
const notificationRecipientSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  deviceToken: z.string().optional(),
  userId: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  slackChannel: z.string().optional(),
  discordChannel: z.string().optional(),
  teamsChannel: z.string().optional(),
})

const notificationSchema = z.object({
  type: z.enum(['email', 'push', 'sms', 'webhook', 'in-app', 'slack', 'discord', 'teams']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  templateId: z.string().optional(),
  channelId: z.string().optional(),
  recipient: notificationRecipientSchema,
  subject: z.string().optional(),
  title: z.string().optional(),
  body: z.string(),
  htmlBody: z.string().optional(),
  data: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  scheduledAt: z.date().optional(),
  maxRetries: z.number().min(0).default(3),
})

const notificationTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['email', 'push', 'sms', 'webhook', 'in-app', 'slack', 'discord', 'teams']),
  subject: z.string().optional(),
  title: z.string().optional(),
  body: z.string(),
  htmlBody: z.string().optional(),
  variables: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
})

// Notification providers
abstract class NotificationProvider {
  abstract send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }>
  abstract validateConfig(config: any): boolean
}

class EmailProvider extends NotificationProvider {
  private config: ChannelConfig['email']
  private apiClient: ExternalAPIClient

  constructor(config: ChannelConfig['email']) {
    super()
    this.config = config!
    this.apiClient = new ExternalAPIClient({
      baseURL: this.getBaseURL(),
      timeout: 30000,
      retries: 3,
    })
  }

  private getBaseURL(): string {
    switch (this.config.provider) {
      case 'sendgrid':
        return 'https://api.sendgrid.com/v3'
      case 'mailgun':
        return 'https://api.mailgun.net/v3'
      case 'postmark':
        return 'https://api.postmarkapp.com'
      default:
        return ''
    }
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      switch (this.config.provider) {
        case 'sendgrid':
          return this.sendWithSendGrid(notification)
        case 'mailgun':
          return this.sendWithMailgun(notification)
        case 'postmark':
          return this.sendWithPostmark(notification)
        case 'smtp':
          return this.sendWithSMTP(notification)
        default:
          throw new Error(`Unsupported email provider: ${this.config.provider}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async sendWithSendGrid(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const response = await this.apiClient.request({
      method: 'POST',
      url: '/mail/send',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        personalizations: [{
          to: [{ email: notification.recipient.email }],
          subject: notification.subject,
        }],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        content: [
          {
            type: 'text/plain',
            value: notification.body,
          },
          ...(notification.htmlBody ? [{
            type: 'text/html',
            value: notification.htmlBody,
          }] : []),
        ],
        reply_to: this.config.replyTo ? {
          email: this.config.replyTo,
        } : undefined,
      },
    })

    return {
      success: response.status >= 200 && response.status < 300,
      messageId: response.headers?.['x-message-id'],
    }
  }

  private async sendWithMailgun(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement Mailgun sending logic
    throw new Error('Mailgun provider not implemented')
  }

  private async sendWithPostmark(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement Postmark sending logic
    throw new Error('Postmark provider not implemented')
  }

  private async sendWithSMTP(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement SMTP sending logic
    throw new Error('SMTP provider not implemented')
  }

  validateConfig(config: any): boolean {
    return !!(config.fromEmail && (config.apiKey || (config.smtpHost && config.smtpUser)))
  }
}

class PushProvider extends NotificationProvider {
  private config: ChannelConfig['push']
  private apiClient: ExternalAPIClient

  constructor(config: ChannelConfig['push']) {
    super()
    this.config = config!
    this.apiClient = new ExternalAPIClient({
      baseURL: this.getBaseURL(),
      timeout: 30000,
      retries: 3,
    })
  }

  private getBaseURL(): string {
    switch (this.config.provider) {
      case 'fcm':
        return 'https://fcm.googleapis.com/fcm'
      case 'onesignal':
        return 'https://onesignal.com/api/v1'
      case 'pusher':
        return 'https://api.pusherapp.com'
      default:
        return ''
    }
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      switch (this.config.provider) {
        case 'fcm':
          return this.sendWithFCM(notification)
        case 'onesignal':
          return this.sendWithOneSignal(notification)
        case 'web-push':
          return this.sendWithWebPush(notification)
        default:
          throw new Error(`Unsupported push provider: ${this.config.provider}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async sendWithFCM(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const response = await this.apiClient.request({
      method: 'POST',
      url: '/send',
      headers: {
        'Authorization': `key=${this.config.serverKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        to: notification.recipient.deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      },
    })

    return {
      success: response.data.success === 1,
      messageId: response.data.results?.[0]?.message_id,
      error: response.data.results?.[0]?.error,
    }
  }

  private async sendWithOneSignal(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement OneSignal sending logic
    throw new Error('OneSignal provider not implemented')
  }

  private async sendWithWebPush(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement Web Push sending logic
    throw new Error('Web Push provider not implemented')
  }

  validateConfig(config: any): boolean {
    return !!(config.apiKey || config.serverKey)
  }
}

class SMSProvider extends NotificationProvider {
  private config: ChannelConfig['sms']
  private apiClient: ExternalAPIClient

  constructor(config: ChannelConfig['sms']) {
    super()
    this.config = config!
    this.apiClient = new ExternalAPIClient({
      baseURL: this.getBaseURL(),
      timeout: 30000,
      retries: 3,
    })
  }

  private getBaseURL(): string {
    switch (this.config.provider) {
      case 'twilio':
        return `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}`
      case 'aws-sns':
        return 'https://sns.amazonaws.com'
      case 'nexmo':
        return 'https://rest.nexmo.com'
      default:
        return ''
    }
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      switch (this.config.provider) {
        case 'twilio':
          return this.sendWithTwilio(notification)
        case 'aws-sns':
          return this.sendWithAWSSNS(notification)
        case 'nexmo':
          return this.sendWithNexmo(notification)
        default:
          throw new Error(`Unsupported SMS provider: ${this.config.provider}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async sendWithTwilio(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')
    
    const response = await this.apiClient.request({
      method: 'POST',
      url: '/Messages.json',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams({
        From: this.config.fromNumber!,
        To: notification.recipient.phone!,
        Body: notification.body,
      }),
    })

    return {
      success: response.status >= 200 && response.status < 300,
      messageId: response.data.sid,
    }
  }

  private async sendWithAWSSNS(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement AWS SNS sending logic
    throw new Error('AWS SNS provider not implemented')
  }

  private async sendWithNexmo(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Implement Nexmo sending logic
    throw new Error('Nexmo provider not implemented')
  }

  validateConfig(config: any): boolean {
    return !!(config.apiKey && config.fromNumber)
  }
}

class WebhookProvider extends NotificationProvider {
  private config: ChannelConfig['webhook']
  private apiClient: ExternalAPIClient

  constructor(config: ChannelConfig['webhook']) {
    super()
    this.config = config!
    this.apiClient = new ExternalAPIClient({
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
    })
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      }

      // Add authentication headers
      if (this.config.authentication) {
        switch (this.config.authentication.type) {
          case 'basic':
            const basicAuth = Buffer.from(
              `${this.config.authentication.credentials?.username}:${this.config.authentication.credentials?.password}`
            ).toString('base64')
            headers['Authorization'] = `Basic ${basicAuth}`
            break
          case 'bearer':
            headers['Authorization'] = `Bearer ${this.config.authentication.credentials?.token}`
            break
          case 'api-key':
            headers[this.config.authentication.credentials?.headerName || 'X-API-Key'] = 
              this.config.authentication.credentials?.apiKey!
            break
        }
      }

      const response = await this.apiClient.request({
        method: this.config.method,
        url: this.config.url,
        headers,
        data: {
          notification: {
            id: notification.id,
            type: notification.type,
            priority: notification.priority,
            subject: notification.subject,
            title: notification.title,
            body: notification.body,
            recipient: notification.recipient,
            data: notification.data,
            metadata: notification.metadata,
            createdAt: notification.createdAt,
          },
        },
      })

      return {
        success: response.status >= 200 && response.status < 300,
        messageId: response.data?.messageId || response.data?.id,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  validateConfig(config: any): boolean {
    return !!(config.url)
  }
}

class SlackProvider extends NotificationProvider {
  private config: ChannelConfig['slack']
  private apiClient: ExternalAPIClient

  constructor(config: ChannelConfig['slack']) {
    super()
    this.config = config!
    this.apiClient = new ExternalAPIClient({
      timeout: 30000,
      retries: 3,
    })
  }

  async send(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (this.config.webhookUrl) {
        return this.sendWithWebhook(notification)
      } else if (this.config.botToken) {
        return this.sendWithBot(notification)
      } else {
        throw new Error('No Slack webhook URL or bot token configured')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async sendWithWebhook(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const response = await this.apiClient.request({
      method: 'POST',
      url: this.config.webhookUrl!,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        text: notification.body,
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        channel: notification.recipient.slackChannel || this.config.channel,
        attachments: notification.title ? [{
          title: notification.title,
          text: notification.body,
          color: this.getPriorityColor(notification.priority),
        }] : undefined,
      },
    })

    return {
      success: response.status >= 200 && response.status < 300,
    }
  }

  private async sendWithBot(notification: Notification): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const response = await this.apiClient.request({
      method: 'POST',
      url: 'https://slack.com/api/chat.postMessage',
      headers: {
        'Authorization': `Bearer ${this.config.botToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        channel: notification.recipient.slackChannel || this.config.channel,
        text: notification.body,
        username: this.config.username,
        icon_emoji: this.config.iconEmoji,
        attachments: notification.title ? [{
          title: notification.title,
          text: notification.body,
          color: this.getPriorityColor(notification.priority),
        }] : undefined,
      },
    })

    return {
      success: response.data.ok,
      messageId: response.data.ts,
      error: response.data.error,
    }
  }

  private getPriorityColor(priority: NotificationPriority): string {
    switch (priority) {
      case 'urgent':
        return 'danger'
      case 'high':
        return 'warning'
      case 'normal':
        return 'good'
      case 'low':
        return '#cccccc'
      default:
        return 'good'
    }
  }

  validateConfig(config: any): boolean {
    return !!(config.webhookUrl || config.botToken)
  }
}

// Notification service
export class NotificationService extends EventEmitter {
  private static instance: NotificationService
  private config: NotificationConfig
  private cache: CacheService
  private queueManager: QueueManager
  private templates: Map<string, NotificationTemplate> = new Map()
  private channels: Map<string, NotificationChannel> = new Map()
  private providers: Map<string, NotificationProvider> = new Map()
  private notifications: Map<string, Notification> = new Map()
  private batches: Map<string, NotificationBatch> = new Map()
  private metrics: NotificationMetrics
  private rateLimiters: Map<string, Map<string, number>> = new Map()

  private constructor(config: Partial<NotificationConfig> = {}) {
    super()
    this.config = { ...defaultNotificationConfig, ...config }
    this.cache = new CacheService()
    this.queueManager = QueueManager.getInstance()
    this.metrics = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      deliveryRate: 0,
      averageDeliveryTime: 0,
      channelMetrics: new Map(),
      typeMetrics: new Map(),
    }

    this.setupQueues()
    this.loadDefaultTemplates()
  }

  static getInstance(config?: Partial<NotificationConfig>): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(config)
    }
    return NotificationService.instance
  }

  private setupQueues(): void {
    // Setup notification processing queue
    this.queueManager.createQueue('notifications', {
      concurrency: this.config.batchSize,
      delay: this.config.batchDelay,
    })

    // Process notifications
    this.queueManager.process('notifications', async (job) => {
      const notification = job.data as Notification
      return this.processNotification(notification)
    })
  }

  private loadDefaultTemplates(): void {
    // Welcome email template
    this.registerTemplate({
      id: 'welcome_email',
      name: 'Welcome Email',
      type: 'email',
      subject: 'Welcome to {{appName}}!',
      title: 'Welcome to {{appName}}!',
      body: 'Hi {{userName}}, welcome to {{appName}}! We\'re excited to have you on board.',
      htmlBody: '<h1>Welcome to {{appName}}!</h1><p>Hi {{userName}}, welcome to {{appName}}! We\'re excited to have you on board.</p>',
      variables: ['appName', 'userName'],
      isActive: true,
    })

    // Test results notification template
    this.registerTemplate({
      id: 'test_results',
      name: 'Test Results',
      type: 'email',
      subject: 'Your test results for {{testName}}',
      title: 'Test Results Available',
      body: 'Hi {{userName}}, your test results for {{testName}} are now available. You scored {{score}}%.',
      htmlBody: '<h2>Test Results Available</h2><p>Hi {{userName}}, your test results for <strong>{{testName}}</strong> are now available.</p><p>Your score: <strong>{{score}}%</strong></p>',
      variables: ['userName', 'testName', 'score'],
      isActive: true,
    })

    // Push notification template
    this.registerTemplate({
      id: 'push_notification',
      name: 'Push Notification',
      type: 'push',
      title: '{{title}}',
      body: '{{message}}',
      variables: ['title', 'message'],
      isActive: true,
    })
  }

  // Template management
  async registerTemplate(template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>): Promise<void> {
    const validatedTemplate = notificationTemplateSchema.parse(template)
    
    const fullTemplate: NotificationTemplate = {
      ...validatedTemplate,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.templates.set(fullTemplate.id, fullTemplate)

    if (this.config.enablePersistence) {
      await this.cache.set(`notification_template:${fullTemplate.id}`, fullTemplate)
    }

    await logger.info('Notification template registered', {
      templateId: fullTemplate.id,
      name: fullTemplate.name,
      type: fullTemplate.type,
    })

    this.emit('template:registered', fullTemplate)
  }

  getTemplate(id: string): NotificationTemplate | null {
    return this.templates.get(id) || null
  }

  listTemplates(type?: NotificationType): NotificationTemplate[] {
    const templates = Array.from(this.templates.values())
    return type ? templates.filter(t => t.type === type) : templates
  }

  // Channel management
  async registerChannel(channel: Omit<NotificationChannel, 'createdAt' | 'updatedAt'>): Promise<void> {
    const fullChannel: NotificationChannel = {
      ...channel,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Create and validate provider
    const provider = this.createProvider(fullChannel.type, fullChannel.config)
    if (!provider.validateConfig(fullChannel.config)) {
      throw new Error(`Invalid configuration for ${fullChannel.type} channel`)
    }

    this.channels.set(fullChannel.id, fullChannel)
    this.providers.set(fullChannel.id, provider)

    if (this.config.enablePersistence) {
      await this.cache.set(`notification_channel:${fullChannel.id}`, fullChannel)
    }

    await logger.info('Notification channel registered', {
      channelId: fullChannel.id,
      name: fullChannel.name,
      type: fullChannel.type,
    })

    this.emit('channel:registered', fullChannel)
  }

  private createProvider(type: NotificationType, config: ChannelConfig): NotificationProvider {
    switch (type) {
      case 'email':
        return new EmailProvider(config.email)
      case 'push':
        return new PushProvider(config.push)
      case 'sms':
        return new SMSProvider(config.sms)
      case 'webhook':
        return new WebhookProvider(config.webhook)
      case 'slack':
        return new SlackProvider(config.slack)
      default:
        throw new Error(`Unsupported notification type: ${type}`)
    }
  }

  getChannel(id: string): NotificationChannel | null {
    return this.channels.get(id) || null
  }

  listChannels(type?: NotificationType): NotificationChannel[] {
    const channels = Array.from(this.channels.values())
    return type ? channels.filter(c => c.type === type) : channels
  }

  // Notification sending
  async send(notificationData: Omit<Notification, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const validatedData = notificationSchema.parse(notificationData)
    
    const notification: Notification = {
      ...validatedData,
      id: uuidv4(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Apply template if specified
    if (notification.templateId) {
      await this.applyTemplate(notification)
    }

    // Check rate limits
    if (this.config.enableRateLimiting && !this.checkRateLimit(notification)) {
      throw new Error('Rate limit exceeded for recipient')
    }

    // Check recipient preferences
    if (!this.checkRecipientPreferences(notification)) {
      notification.status = 'cancelled'
      await logger.info('Notification cancelled due to recipient preferences', {
        notificationId: notification.id,
        type: notification.type,
        recipient: notification.recipient.id || notification.recipient.email,
      })
      return notification.id
    }

    this.notifications.set(notification.id, notification)

    // Schedule or send immediately
    if (notification.scheduledAt && notification.scheduledAt > new Date()) {
      await this.scheduleNotification(notification)
    } else {
      await this.queueNotification(notification)
    }

    await logger.info('Notification queued', {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      recipient: notification.recipient.id || notification.recipient.email,
    })

    this.emit('notification:queued', notification)
    return notification.id
  }

  async sendBatch(notifications: Array<Omit<Notification, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>>): Promise<string> {
    const batchId = uuidv4()
    const batch: NotificationBatch = {
      id: batchId,
      notifications: [],
      status: 'pending',
      createdAt: new Date(),
    }

    // Create notifications
    for (const notificationData of notifications) {
      const validatedData = notificationSchema.parse(notificationData)
      
      const notification: Notification = {
        ...validatedData,
        id: uuidv4(),
        status: 'pending',
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Apply template if specified
      if (notification.templateId) {
        await this.applyTemplate(notification)
      }

      batch.notifications.push(notification)
      this.notifications.set(notification.id, notification)
    }

    this.batches.set(batchId, batch)

    // Process batch
    await this.processBatch(batchId)

    await logger.info('Notification batch queued', {
      batchId,
      notificationCount: batch.notifications.length,
    })

    this.emit('batch:queued', batch)
    return batchId
  }

  private async applyTemplate(notification: Notification): Promise<void> {
    const template = this.templates.get(notification.templateId!)
    if (!template || !template.isActive) {
      throw new Error(`Template not found or inactive: ${notification.templateId}`)
    }

    // Replace variables in template
    const data = { ...notification.data }
    
    if (template.subject) {
      notification.subject = this.replaceVariables(template.subject, data)
    }
    
    if (template.title) {
      notification.title = this.replaceVariables(template.title, data)
    }
    
    notification.body = this.replaceVariables(template.body, data)
    
    if (template.htmlBody) {
      notification.htmlBody = this.replaceVariables(template.htmlBody, data)
    }
  }

  private replaceVariables(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = data[key.trim()]
      return value !== undefined ? String(value) : match
    })
  }

  private checkRateLimit(notification: Notification): boolean {
    if (!this.config.enableRateLimiting) return true

    const recipientKey = notification.recipient.id || notification.recipient.email || notification.recipient.phone
    if (!recipientKey) return true

    const now = Date.now()
    const windowStart = now - this.config.rateLimitWindow

    if (!this.rateLimiters.has(recipientKey)) {
      this.rateLimiters.set(recipientKey, new Map())
    }

    const recipientLimits = this.rateLimiters.get(recipientKey)!
    
    // Clean old entries
    for (const [timestamp] of recipientLimits.entries()) {
      if (timestamp < windowStart) {
        recipientLimits.delete(timestamp)
      }
    }

    // Check limit
    if (recipientLimits.size >= this.config.rateLimitMax) {
      return false
    }

    // Add current request
    recipientLimits.set(now, 1)
    return true
  }

  private checkRecipientPreferences(notification: Notification): boolean {
    const preferences = notification.recipient.preferences
    if (!preferences) return true

    // Check type preference
    switch (notification.type) {
      case 'email':
        if (preferences.email === false) return false
        break
      case 'push':
        if (preferences.push === false) return false
        break
      case 'sms':
        if (preferences.sms === false) return false
        break
      case 'in-app':
        if (preferences.inApp === false) return false
        break
      case 'webhook':
        if (preferences.webhook === false) return false
        break
    }

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5) // HH:mm format
      
      if (currentTime >= preferences.quietHours.start && currentTime <= preferences.quietHours.end) {
        return false
      }
    }

    return true
  }

  private async scheduleNotification(notification: Notification): Promise<void> {
    const delay = notification.scheduledAt!.getTime() - Date.now()
    
    setTimeout(async () => {
      await this.queueNotification(notification)
    }, delay)
  }

  private async queueNotification(notification: Notification): Promise<void> {
    await this.queueManager.addJob('notifications', notification, {
      priority: this.getPriorityValue(notification.priority),
      attempts: notification.maxRetries + 1,
      backoff: {
        type: 'exponential',
        delay: this.config.defaultRetryDelay,
      },
    })
  }

  private getPriorityValue(priority: NotificationPriority): number {
    switch (priority) {
      case 'urgent':
        return 1
      case 'high':
        return 2
      case 'normal':
        return 3
      case 'low':
        return 4
      default:
        return 3
    }
  }

  private async processNotification(notification: Notification): Promise<void> {
    const startTime = Date.now()
    
    try {
      notification.status = 'sent'
      notification.sentAt = new Date()
      notification.updatedAt = new Date()

      // Find appropriate channel
      const channel = this.findChannel(notification)
      if (!channel) {
        throw new Error(`No active channel found for notification type: ${notification.type}`)
      }

      // Get provider
      const provider = this.providers.get(channel.id)
      if (!provider) {
        throw new Error(`No provider found for channel: ${channel.id}`)
      }

      // Send notification
      const result = await provider.send(notification)
      
      if (result.success) {
        notification.status = 'delivered'
        notification.deliveredAt = new Date()
        
        if (result.messageId) {
          notification.metadata = {
            ...notification.metadata,
            messageId: result.messageId,
          }
        }
      } else {
        throw new Error(result.error || 'Unknown error')
      }

    } catch (error) {
      notification.status = 'failed'
      notification.failedAt = new Date()
      notification.error = error instanceof Error ? error.message : String(error)
      notification.retryCount++

      await logger.error('Notification failed', {
        notificationId: notification.id,
        type: notification.type,
        error: notification.error,
        retryCount: notification.retryCount,
      }, error instanceof Error ? error : new Error(String(error)))

      // Retry if attempts remaining
      if (notification.retryCount < notification.maxRetries) {
        await this.queueNotification(notification)
        return
      }
    } finally {
      const endTime = Date.now()
      const deliveryTime = endTime - startTime
      
      // Update metrics
      this.updateMetrics(notification, deliveryTime)
      
      notification.updatedAt = new Date()
      
      if (this.config.enablePersistence) {
        await this.cache.set(`notification:${notification.id}`, notification)
      }

      this.emit('notification:processed', notification)
    }
  }

  private findChannel(notification: Notification): NotificationChannel | null {
    // Use specified channel if provided
    if (notification.channelId) {
      const channel = this.channels.get(notification.channelId)
      return channel?.isActive ? channel : null
    }

    // Find best channel for notification type
    const channels = Array.from(this.channels.values())
      .filter(c => c.type === notification.type && c.isActive)
      .sort((a, b) => a.priority - b.priority)

    return channels[0] || null
  }

  private async processBatch(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId)
    if (!batch) return

    batch.status = 'processing'
    batch.processedAt = new Date()
    batch.results = []

    try {
      // Process notifications in parallel with concurrency limit
      const promises = batch.notifications.map(async (notification) => {
        try {
          await this.processNotification(notification)
          return {
            notificationId: notification.id,
            status: notification.status,
            sentAt: notification.sentAt,
            deliveredAt: notification.deliveredAt,
          } as BatchResult
        } catch (error) {
          return {
            notificationId: notification.id,
            status: 'failed' as NotificationStatus,
            error: error instanceof Error ? error.message : String(error),
          } as BatchResult
        }
      })

      batch.results = await Promise.all(promises)
      batch.status = 'completed'
      
    } catch (error) {
      batch.status = 'failed'
      await logger.error('Batch processing failed', {
        batchId,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : new Error(String(error)))
    } finally {
      batch.completedAt = new Date()
      this.emit('batch:completed', batch)
    }
  }

  private updateMetrics(notification: Notification, deliveryTime: number): void {
    // Update global metrics
    this.metrics.totalSent++
    
    if (notification.status === 'delivered') {
      this.metrics.totalDelivered++
    } else if (notification.status === 'failed') {
      this.metrics.totalFailed++
    }

    // Update delivery rate
    const totalProcessed = this.metrics.totalDelivered + this.metrics.totalFailed
    if (totalProcessed > 0) {
      this.metrics.deliveryRate = this.metrics.totalDelivered / totalProcessed
    }

    // Update average delivery time
    if (notification.status === 'delivered') {
      this.metrics.averageDeliveryTime = 
        (this.metrics.averageDeliveryTime * (this.metrics.totalDelivered - 1) + deliveryTime) / this.metrics.totalDelivered
    }

    // Update channel metrics
    if (notification.channelId) {
      this.updateChannelMetrics(notification.channelId, notification, deliveryTime)
    }

    // Update type metrics
    this.updateTypeMetrics(notification.type, notification, deliveryTime)
  }

  private updateChannelMetrics(channelId: string, notification: Notification, deliveryTime: number): void {
    let channelMetrics = this.metrics.channelMetrics.get(channelId)
    
    if (!channelMetrics) {
      const channel = this.channels.get(channelId)
      channelMetrics = {
        channelId,
        channelName: channel?.name || 'Unknown',
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        averageDeliveryTime: 0,
      }
      this.metrics.channelMetrics.set(channelId, channelMetrics)
    }

    channelMetrics.totalSent++
    channelMetrics.lastUsed = new Date()

    if (notification.status === 'delivered') {
      channelMetrics.totalDelivered++
      channelMetrics.averageDeliveryTime = 
        (channelMetrics.averageDeliveryTime * (channelMetrics.totalDelivered - 1) + deliveryTime) / channelMetrics.totalDelivered
    } else if (notification.status === 'failed') {
      channelMetrics.totalFailed++
    }

    const totalProcessed = channelMetrics.totalDelivered + channelMetrics.totalFailed
    if (totalProcessed > 0) {
      channelMetrics.deliveryRate = channelMetrics.totalDelivered / totalProcessed
    }
  }

  private updateTypeMetrics(type: NotificationType, notification: Notification, deliveryTime: number): void {
    let typeMetrics = this.metrics.typeMetrics.get(type)
    
    if (!typeMetrics) {
      typeMetrics = {
        type,
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        averageDeliveryTime: 0,
      }
      this.metrics.typeMetrics.set(type, typeMetrics)
    }

    typeMetrics.totalSent++

    if (notification.status === 'delivered') {
      typeMetrics.totalDelivered++
      typeMetrics.averageDeliveryTime = 
        (typeMetrics.averageDeliveryTime * (typeMetrics.totalDelivered - 1) + deliveryTime) / typeMetrics.totalDelivered
    } else if (notification.status === 'failed') {
      typeMetrics.totalFailed++
    }

    const totalProcessed = typeMetrics.totalDelivered + typeMetrics.totalFailed
    if (totalProcessed > 0) {
      typeMetrics.deliveryRate = typeMetrics.totalDelivered / totalProcessed
    }
  }

  // Query methods
  getNotification(id: string): Notification | null {
    return this.notifications.get(id) || null
  }

  getBatch(id: string): NotificationBatch | null {
    return this.batches.get(id) || null
  }

  listNotifications(filters?: {
    type?: NotificationType
    status?: NotificationStatus
    priority?: NotificationPriority
    recipientId?: string
    limit?: number
    offset?: number
  }): Notification[] {
    let notifications = Array.from(this.notifications.values())

    if (filters) {
      if (filters.type) {
        notifications = notifications.filter(n => n.type === filters.type)
      }
      
      if (filters.status) {
        notifications = notifications.filter(n => n.status === filters.status)
      }
      
      if (filters.priority) {
        notifications = notifications.filter(n => n.priority === filters.priority)
      }
      
      if (filters.recipientId) {
        notifications = notifications.filter(n => 
          n.recipient.id === filters.recipientId || 
          n.recipient.userId === filters.recipientId
        )
      }

      // Sort by creation time (newest first)
      notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      if (filters.offset) {
        notifications = notifications.slice(filters.offset)
      }

      if (filters.limit) {
        notifications = notifications.slice(0, filters.limit)
      }
    }

    return notifications
  }

  getMetrics(): NotificationMetrics {
    return {
      ...this.metrics,
      channelMetrics: new Map(this.metrics.channelMetrics),
      typeMetrics: new Map(this.metrics.typeMetrics),
    }
  }

  // Cleanup
  async cleanup(olderThanHours = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    const toDelete: string[] = []

    for (const [notificationId, notification] of this.notifications) {
      if (
        (notification.status === 'delivered' || notification.status === 'failed' || notification.status === 'cancelled') &&
        notification.createdAt < cutoffTime
      ) {
        toDelete.push(notificationId)
      }
    }

    for (const notificationId of toDelete) {
      this.notifications.delete(notificationId)
      if (this.config.enablePersistence) {
        await this.cache.delete(`notification:${notificationId}`)
      }
    }

    await logger.info('Notification cleanup completed', { deletedNotifications: toDelete.length })
  }
}

// Default notification service instance
export const notificationService = NotificationService.getInstance()

export {
  NotificationService,
  notificationSchema,
  notificationTemplateSchema,
}

export default notificationService
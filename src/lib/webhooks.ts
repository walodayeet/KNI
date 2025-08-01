import { NextRequest } from 'next/server'
import { logger } from './logger'
import { CacheService } from './cache'
import { queueManager, JobTypes } from './queue'
import { z } from 'zod'
import crypto from 'crypto'
import { EventEmitter } from 'events'

// Webhook configuration
interface WebhookConfig {
  maxRetries: number
  retryDelay: number
  timeout: number
  enableSignatureVerification: boolean
  enableRateLimiting: boolean
  maxPayloadSize: number
  enableLogging: boolean
  enableMetrics: boolean
}

const defaultWebhookConfig: WebhookConfig = {
  maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000'),
  timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000'),
  enableSignatureVerification: process.env.WEBHOOK_VERIFY_SIGNATURES === 'true',
  enableRateLimiting: true,
  maxPayloadSize: parseInt(process.env.WEBHOOK_MAX_PAYLOAD_SIZE || '1048576'), // 1MB
  enableLogging: true,
  enableMetrics: true,
}

// Webhook interfaces
interface WebhookEndpoint {
  id: string
  url: string
  secret?: string
  events: string[]
  active: boolean
  headers?: Record<string, string>
  retryPolicy?: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  createdAt: Date
  updatedAt: Date
}

interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: Date
  source: string
  version: string
}

interface WebhookDelivery {
  id: string
  endpointId: string
  eventId: string
  url: string
  payload: any
  headers: Record<string, string>
  attempts: number
  maxAttempts: number
  status: 'pending' | 'delivered' | 'failed' | 'cancelled'
  responseStatus?: number
  responseBody?: string
  responseHeaders?: Record<string, string>
  error?: string
  createdAt: Date
  deliveredAt?: Date
  failedAt?: Date
}

interface IncomingWebhook {
  id: string
  name: string
  path: string
  secret?: string
  processor: WebhookProcessor
  active: boolean
  rateLimit?: {
    maxRequests: number
    windowMs: number
  }
}

interface WebhookMetrics {
  totalDeliveries: number
  successfulDeliveries: number
  failedDeliveries: number
  averageDeliveryTime: number
  totalIncoming: number
  successfulIncoming: number
  failedIncoming: number
}

// Webhook processor function type
type WebhookProcessor = (payload: any, headers: Record<string, string>, request: NextRequest) => Promise<any>

// Zod schemas
const webhookEndpointSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()),
  active: z.boolean(),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    maxRetries: z.number().min(0).max(10),
    retryDelay: z.number().min(100),
    backoffMultiplier: z.number().min(1).max(10),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.any(),
  timestamp: z.date(),
  source: z.string(),
  version: z.string(),
})

const incomingWebhookSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  secret: z.string().optional(),
  active: z.boolean(),
  rateLimit: z.object({
    maxRequests: z.number().min(1),
    windowMs: z.number().min(1000),
  }).optional(),
})

// Webhook manager
export class WebhookManager extends EventEmitter {
  private static instance: WebhookManager
  private config: WebhookConfig
  private endpoints: Map<string, WebhookEndpoint> = new Map()
  private incomingWebhooks: Map<string, IncomingWebhook> = new Map()
  private deliveries: Map<string, WebhookDelivery> = new Map()
  private cache: CacheService
  private metrics: WebhookMetrics
  private deliveryTimes: number[] = []
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map()

  private constructor(config: Partial<WebhookConfig> = {}) {
    super()
    this.config = { ...defaultWebhookConfig, ...config }
    this.cache = new CacheService()
    this.metrics = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageDeliveryTime: 0,
      totalIncoming: 0,
      successfulIncoming: 0,
      failedIncoming: 0,
    }

    this.setupCleanup()
  }

  static getInstance(config?: Partial<WebhookConfig>): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager(config)
    }
    return WebhookManager.instance
  }

  // Register outgoing webhook endpoint
  async registerEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const endpointId = crypto.randomUUID()
    const now = new Date()
    
    const webhookEndpoint: WebhookEndpoint = {
      ...endpoint,
      id: endpointId,
      createdAt: now,
      updatedAt: now,
    }

    // Validate endpoint
    webhookEndpointSchema.parse(webhookEndpoint)

    this.endpoints.set(endpointId, webhookEndpoint)
    
    // Persist endpoint
    await this.cache.set(`webhook:endpoint:${endpointId}`, webhookEndpoint, 86400 * 30) // 30 days

    await logger.info('Webhook endpoint registered', {
      endpointId,
      url: endpoint.url,
      events: endpoint.events,
    })

    this.emit('endpoint:registered', webhookEndpoint)
    return endpointId
  }

  // Register incoming webhook
  async registerIncomingWebhook(
    webhook: Omit<IncomingWebhook, 'id'>
  ): Promise<string> {
    const webhookId = crypto.randomUUID()
    
    const incomingWebhook: IncomingWebhook = {
      ...webhook,
      id: webhookId,
    }

    // Validate webhook (excluding processor)
    const { processor: _processor, ...validationData } = incomingWebhook
    incomingWebhookSchema.parse(validationData)

    this.incomingWebhooks.set(webhookId, incomingWebhook)
    
    // Persist webhook (excluding processor function)
    await this.cache.set(`webhook:incoming:${webhookId}`, validationData, 86400 * 30) // 30 days

    await logger.info('Incoming webhook registered', {
      webhookId,
      name: webhook.name,
      path: webhook.path,
    })

    this.emit('incoming:registered', incomingWebhook)
    return webhookId
  }

  // Send webhook event
  async sendEvent(event: Omit<WebhookEvent, 'id' | 'timestamp'>): Promise<string[]> {
    const webhookEvent: WebhookEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }

    // Validate event
    webhookEventSchema.parse(webhookEvent)

    // Find matching endpoints
    const matchingEndpoints = Array.from(this.endpoints.values())
      .filter(endpoint => 
        endpoint.active && 
        endpoint.events.includes(event.type)
      )

    if (matchingEndpoints.length === 0) {
      await logger.debug('No matching endpoints for webhook event', {
        eventType: event.type,
        eventId: webhookEvent.id,
      })
      return []
    }

    const deliveryIds: string[] = []

    // Create deliveries for each matching endpoint
    for (const endpoint of matchingEndpoints) {
      const deliveryId = await this.createDelivery(webhookEvent, endpoint)
      deliveryIds.push(deliveryId)
    }

    await logger.info('Webhook event queued for delivery', {
      eventId: webhookEvent.id,
      eventType: event.type,
      endpointCount: matchingEndpoints.length,
      deliveryIds,
    })

    this.emit('event:queued', webhookEvent, deliveryIds)
    return deliveryIds
  }

  // Create webhook delivery
  private async createDelivery(
    event: WebhookEvent,
    endpoint: WebhookEndpoint
  ): Promise<string> {
    const deliveryId = crypto.randomUUID()
    const payload = this.createPayload(event)
    const headers = this.createHeaders(payload, endpoint)

    const delivery: WebhookDelivery = {
      id: deliveryId,
      endpointId: endpoint.id,
      eventId: event.id,
      url: endpoint.url,
      payload,
      headers,
      attempts: 0,
      maxAttempts: endpoint.retryPolicy?.maxRetries ?? this.config.maxRetries,
      status: 'pending',
      createdAt: new Date(),
    }

    this.deliveries.set(deliveryId, delivery)
    this.metrics.totalDeliveries++

    // Queue delivery for processing
    const webhookQueue = queueManager.getQueue('webhooks')
    await webhookQueue.add(JobTypes.WEBHOOK, {
      deliveryId,
      type: 'outgoing',
    }, {
      priority: 7,
      maxAttempts: delivery.maxAttempts + 1,
    })

    return deliveryId
  }

  // Create webhook payload
  private createPayload(event: WebhookEvent): any {
    return {
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp.toISOString(),
      source: event.source,
      version: event.version,
    }
  }

  // Create webhook headers
  private createHeaders(
    payload: any,
    endpoint: WebhookEndpoint
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'KNI-Webhooks/1.0',
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-ID': crypto.randomUUID(),
      ...endpoint.headers,
    }

    // Add signature if secret is provided
    if (endpoint.secret) {
      const signature = this.generateSignature(JSON.stringify(payload), endpoint.secret)
      headers['X-Webhook-Signature'] = signature
    }

    return headers
  }

  // Generate webhook signature
  private generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    return `sha256=${hmac.digest('hex')}`
  }

  // Verify webhook signature
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  // Process outgoing webhook delivery
  async processDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId)
    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`)
    }

    const endpoint = this.endpoints.get(delivery.endpointId)
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${delivery.endpointId}`)
    }

    delivery.attempts++
    const startTime = performance.now()

    try {
      const response = await fetch(delivery.url, {
        method: 'POST',
        headers: delivery.headers,
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(this.config.timeout),
      })

      const deliveryTime = performance.now() - startTime
      this.updateDeliveryMetrics(deliveryTime, true)

      delivery.responseStatus = response.status
      delivery.responseHeaders = Object.fromEntries(response.headers.entries())
      delivery.responseBody = await response.text()

      if (response.ok) {
        delivery.status = 'delivered'
        delivery.deliveredAt = new Date()
        this.metrics.successfulDeliveries++

        await logger.info('Webhook delivered successfully', {
          deliveryId,
          endpointId: delivery.endpointId,
          url: delivery.url,
          status: response.status,
          attempts: delivery.attempts,
          deliveryTime,
        })

        this.emit('delivery:success', delivery)
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      const deliveryTime = performance.now() - startTime
      this.updateDeliveryMetrics(deliveryTime, false)

      delivery.error = error instanceof Error ? error.message : String(error)

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = 'failed'
        delivery.failedAt = new Date()
        this.metrics.failedDeliveries++

        await logger.error('Webhook delivery failed permanently', {
          deliveryId,
          endpointId: delivery.endpointId,
          url: delivery.url,
          attempts: delivery.attempts,
          error: delivery.error,
        })

        this.emit('delivery:failed', delivery)
      } else {
        await logger.warn('Webhook delivery failed, will retry', {
          deliveryId,
          endpointId: delivery.endpointId,
          url: delivery.url,
          attempts: delivery.attempts,
          maxAttempts: delivery.maxAttempts,
          error: delivery.error,
        })

        this.emit('delivery:retry', delivery)
        throw error // Re-throw to trigger queue retry
      }
    }
  }

  // Process incoming webhook
  async processIncomingWebhook(
    path: string,
    payload: any,
    headers: Record<string, string>,
    request: NextRequest
  ): Promise<any> {
    const webhook = Array.from(this.incomingWebhooks.values())
      .find(w => w.path === path && w.active)

    if (!webhook) {
      throw new Error(`No active webhook found for path: ${path}`)
    }

    this.metrics.totalIncoming++

    // Rate limiting
    if (this.config.enableRateLimiting && webhook.rateLimit) {
      const rateLimitResult = this.checkRateLimit(webhook.id, webhook.rateLimit)
      if (!rateLimitResult.allowed) {
        throw new Error('Rate limit exceeded')
      }
    }

    // Verify signature if secret is provided
    if (webhook.secret && this.config.enableSignatureVerification) {
      const signature = headers['x-webhook-signature'] || headers['x-hub-signature-256']
      if (!signature) {
        throw new Error('Missing webhook signature')
      }

      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
      if (!this.verifySignature(payloadString, signature, webhook.secret)) {
        throw new Error('Invalid webhook signature')
      }
    }

    try {
      const result = await webhook.processor(payload, headers, request)
      this.metrics.successfulIncoming++

      await logger.info('Incoming webhook processed successfully', {
        webhookId: webhook.id,
        name: webhook.name,
        path,
      })

      this.emit('incoming:success', webhook, payload, result)
      return result
    } catch (error) {
      this.metrics.failedIncoming++

      await logger.error('Incoming webhook processing failed', {
        webhookId: webhook.id,
        name: webhook.name,
        path,
      }, error instanceof Error ? error : new Error(String(error)))

      this.emit('incoming:failed', webhook, payload, error)
      throw error
    }
  }

  // Check rate limit for incoming webhooks
  private checkRateLimit(
    webhookId: string,
    rateLimit: { maxRequests: number; windowMs: number }
  ): { allowed: boolean; remaining: number } {
    const key = `webhook:${webhookId}`
    const now = Date.now()
    
    // Clean up expired entries
    for (const [k, v] of this.rateLimitStore.entries()) {
      if (v.resetTime < now) {
        this.rateLimitStore.delete(k)
      }
    }
    
    const current = this.rateLimitStore.get(key)
    
    if (!current) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      })
      return { allowed: true, remaining: rateLimit.maxRequests - 1 }
    }
    
    if (current.resetTime < now) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + rateLimit.windowMs,
      })
      return { allowed: true, remaining: rateLimit.maxRequests - 1 }
    }
    
    if (current.count >= rateLimit.maxRequests) {
      return { allowed: false, remaining: 0 }
    }
    
    current.count++
    return { allowed: true, remaining: rateLimit.maxRequests - current.count }
  }

  // Update delivery metrics
  private updateDeliveryMetrics(deliveryTime: number, _success: boolean): void {
    if (!this.config.enableMetrics) {
      return
    }

    this.deliveryTimes.push(deliveryTime)
    
    // Keep only last 1000 delivery times
    if (this.deliveryTimes.length > 1000) {
      this.deliveryTimes = this.deliveryTimes.slice(-1000)
    }

    this.metrics.averageDeliveryTime = 
      this.deliveryTimes.reduce((sum, time) => sum + time, 0) / this.deliveryTimes.length
  }

  // Get webhook endpoint
  getEndpoint(endpointId: string): WebhookEndpoint | null {
    return this.endpoints.get(endpointId) || null
  }

  // Get incoming webhook
  getIncomingWebhook(webhookId: string): IncomingWebhook | null {
    return this.incomingWebhooks.get(webhookId) || null
  }

  // Get delivery
  getDelivery(deliveryId: string): WebhookDelivery | null {
    return this.deliveries.get(deliveryId) || null
  }

  // Get deliveries for endpoint
  getDeliveriesForEndpoint(endpointId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(delivery => delivery.endpointId === endpointId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Update endpoint
  async updateEndpoint(
    endpointId: string,
    updates: Partial<Omit<WebhookEndpoint, 'id' | 'createdAt'>>
  ): Promise<void> {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`)
    }

    const updatedEndpoint = {
      ...endpoint,
      ...updates,
      updatedAt: new Date(),
    }

    // Validate updated endpoint
    webhookEndpointSchema.parse(updatedEndpoint)

    this.endpoints.set(endpointId, updatedEndpoint)
    await this.cache.set(`webhook:endpoint:${endpointId}`, updatedEndpoint, 86400 * 30)

    await logger.info('Webhook endpoint updated', { endpointId, updates })
    this.emit('endpoint:updated', updatedEndpoint)
  }

  // Delete endpoint
  async deleteEndpoint(endpointId: string): Promise<void> {
    const endpoint = this.endpoints.get(endpointId)
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`)
    }

    this.endpoints.delete(endpointId)
    await this.cache.delete(`webhook:endpoint:${endpointId}`)

    await logger.info('Webhook endpoint deleted', { endpointId })
    this.emit('endpoint:deleted', endpoint)
  }

  // Get metrics
  getMetrics(): WebhookMetrics {
    return { ...this.metrics }
  }

  // Setup cleanup for old deliveries
  private setupCleanup(): void {
    // Clean up old deliveries every hour
    setInterval(async () => {
      await this.cleanupDeliveries()
    }, 3600000)
  }

  // Clean up old deliveries
  async cleanupDeliveries(olderThan: number = 86400000 * 7): Promise<number> { // 7 days default
    const cutoff = new Date(Date.now() - olderThan)
    let removedCount = 0

    for (const [deliveryId, delivery] of this.deliveries.entries()) {
      if (delivery.createdAt < cutoff) {
        this.deliveries.delete(deliveryId)
        removedCount++
      }
    }

    await logger.info('Webhook deliveries cleanup completed', { removedCount })
    return removedCount
  }
}

// Webhook event types
export const WebhookEvents = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  TEST_CREATED: 'test.created',
  TEST_UPDATED: 'test.updated',
  TEST_COMPLETED: 'test.completed',
  TEST_DELETED: 'test.deleted',
  CONSULTATION_SCHEDULED: 'consultation.scheduled',
  CONSULTATION_COMPLETED: 'consultation.completed',
  CONSULTATION_CANCELLED: 'consultation.cancelled',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  NOTIFICATION_SENT: 'notification.sent',
  FILE_UPLOADED: 'file.uploaded',
  BACKUP_COMPLETED: 'backup.completed',
  SYSTEM_ALERT: 'system.alert',
} as const

// Export singleton instance
export const webhookManager = WebhookManager.getInstance()

// Setup webhook queue processor
const webhookQueue = queueManager.getQueue('webhooks')
webhookQueue.process(JobTypes.WEBHOOK, async (job, data) => {
  if (data.type === 'outgoing') {
    await webhookManager.processDelivery(data.deliveryId)
  }
  return { success: true }
})

export default webhookManager
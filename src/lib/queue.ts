import { logger } from './logger'
import { CacheService } from './cache'
import { z } from 'zod'
import { EventEmitter } from 'events'

// Queue configuration
interface QueueConfig {
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  timeout: number
  enablePersistence: boolean
  enableMetrics: boolean
  batchSize: number
  processingInterval: number
}

const defaultQueueConfig: QueueConfig = {
  maxConcurrency: parseInt(process.env.QUEUE_MAX_CONCURRENCY || '5'),
  retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.QUEUE_RETRY_DELAY || '1000'),
  timeout: parseInt(process.env.QUEUE_TIMEOUT || '30000'),
  enablePersistence: process.env.NODE_ENV === 'production',
  enableMetrics: true,
  batchSize: parseInt(process.env.QUEUE_BATCH_SIZE || '10'),
  processingInterval: parseInt(process.env.QUEUE_PROCESSING_INTERVAL || '1000'),
}

// Job interfaces
interface BaseJob {
  id: string
  type: string
  data: any
  priority: number
  attempts: number
  maxAttempts: number
  createdAt: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  error?: string
  result?: any
}

interface JobOptions {
  priority?: number
  delay?: number
  maxAttempts?: number
  timeout?: number
  backoff?: 'fixed' | 'exponential'
}

interface QueueMetrics {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  activeJobs: number
  waitingJobs: number
  averageProcessingTime: number
  throughput: number
}

// Job processor function type
type JobProcessor<T = any, R = any> = (job: BaseJob, data: T) => Promise<R>

// Zod schemas
const jobSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.any(),
  priority: z.number().min(0).max(10),
  attempts: z.number().min(0),
  maxAttempts: z.number().min(1),
  createdAt: z.date(),
  scheduledAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
  error: z.string().optional(),
  result: z.any().optional(),
})

const jobOptionsSchema = z.object({
  priority: z.number().min(0).max(10).default(5),
  delay: z.number().min(0).default(0),
  maxAttempts: z.number().min(1).default(3),
  timeout: z.number().min(1000).default(30000),
  backoff: z.enum(['fixed', 'exponential']).default('exponential'),
})

// Queue implementation
export class Queue extends EventEmitter {
  private config: QueueConfig
  private jobs: Map<string, BaseJob> = new Map()
  private processors: Map<string, JobProcessor> = new Map()
  private activeJobs: Set<string> = new Set()
  private metrics: QueueMetrics
  private processingTimer: NodeJS.Timeout | null = null
  private cache: CacheService
  private processingTimes: number[] = []

  constructor(name: string, config: Partial<QueueConfig> = {}) {
    super()
    this.config = { ...defaultQueueConfig, ...config }
    this.cache = new CacheService()
    this.metrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      averageProcessingTime: 0,
      throughput: 0,
    }

    this.startProcessing()
    this.setupCleanup()
  }

  // Add job to queue
  async add<T = any>(
    type: string,
    data: T,
    options: JobOptions = {}
  ): Promise<string> {
    const validatedOptions = jobOptionsSchema.parse(options)
    const jobId = crypto.randomUUID()
    
    const job: BaseJob = {
      id: jobId,
      type,
      data,
      priority: validatedOptions.priority,
      attempts: 0,
      maxAttempts: validatedOptions.maxAttempts,
      createdAt: new Date(),
      scheduledAt: validatedOptions.delay > 0 
        ? new Date(Date.now() + validatedOptions.delay)
        : undefined,
    }

    // Validate job
    jobSchema.parse(job)

    this.jobs.set(jobId, job)
    this.metrics.totalJobs++
    this.metrics.waitingJobs++

    // Persist job if enabled
    if (this.config.enablePersistence) {
      await this.persistJob(job)
    }

    await logger.debug('Job added to queue', {
      jobId,
      type,
      priority: job.priority,
      delay: validatedOptions.delay,
    })

    this.emit('job:added', job)
    return jobId
  }

  // Register job processor
  process<T = any, R = any>(type: string, processor: JobProcessor<T, R>): void {
    this.processors.set(type, processor)
    logger.info('Job processor registered', { type })
  }

  // Start processing jobs
  private startProcessing(): void {
    if (this.processingTimer) return

    this.processingTimer = setInterval(async () => {
      await this.processJobs()
    }, this.config.processingInterval)

    logger.info('Queue processing started')
  }

  // Stop processing jobs
  async stop(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer)
      this.processingTimer = null
    }

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info('Queue processing stopped')
  }

  // Process jobs from queue
  private async processJobs(): Promise<void> {
    if (this.activeJobs.size >= this.config.maxConcurrency) {
      return
    }

    const availableSlots = this.config.maxConcurrency - this.activeJobs.size
    const jobsToProcess = this.getJobsToProcess(availableSlots)

    for (const job of jobsToProcess) {
      this.processJob(job).catch(error => {
        logger.error('Error processing job', { jobId: job.id }, error)
      })
    }
  }

  // Get jobs ready for processing
  private getJobsToProcess(limit: number): BaseJob[] {
    const now = new Date()
    const readyJobs = Array.from(this.jobs.values())
      .filter(job => {
        // Skip if already active
        if (this.activeJobs.has(job.id)) return false
        
        // Skip if completed or failed
        if (job.completedAt || job.failedAt) return false
        
        // Skip if scheduled for later
        if (job.scheduledAt && job.scheduledAt > now) return false
        
        // Skip if no processor available
        if (!this.processors.has(job.type)) return false
        
        return true
      })
      .sort((a, b) => {
        // Sort by priority (higher first), then by creation time
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
      .slice(0, limit)

    return readyJobs
  }

  // Process individual job
  private async processJob(job: BaseJob): Promise<void> {
    const processor = this.processors.get(job.type)
    if (!processor) {
      await logger.error('No processor found for job type', { jobId: job.id, type: job.type })
      return
    }

    this.activeJobs.add(job.id)
    this.metrics.activeJobs++
    this.metrics.waitingJobs--

    job.startedAt = new Date()
    job.attempts++

    this.emit('job:started', job)

    const startTime = performance.now()
    let timeoutId: NodeJS.Timeout | null = null

    try {
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Job timeout after ${this.config.timeout}ms`))
        }, this.config.timeout)
      })

      // Process job with timeout
      const result = await Promise.race([
        processor(job, job.data),
        timeoutPromise
      ])

      if (timeoutId) clearTimeout(timeoutId)

      // Job completed successfully
      job.completedAt = new Date()
      job.result = result

      const processingTime = performance.now() - startTime
      this.updateProcessingMetrics(processingTime, true)

      await logger.info('Job completed successfully', {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        processingTime,
      })

      this.emit('job:completed', job, result)

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)

      const processingTime = performance.now() - startTime
      this.updateProcessingMetrics(processingTime, false)

      job.error = error instanceof Error ? error.message : String(error)

      await logger.warn('Job failed', {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: job.error,
      })

      // Retry logic
      if (job.attempts < job.maxAttempts) {
        const delay = this.calculateRetryDelay(job.attempts)
        job.scheduledAt = new Date(Date.now() + delay)
        
        await logger.info('Job scheduled for retry', {
          jobId: job.id,
          attempt: job.attempts + 1,
          maxAttempts: job.maxAttempts,
          delay,
        })

        this.emit('job:retry', job, error)
      } else {
        // Job failed permanently
        job.failedAt = new Date()
        this.metrics.failedJobs++
        
        await logger.error('Job failed permanently', {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
        })

        this.emit('job:failed', job, error)
      }
    } finally {
      this.activeJobs.delete(job.id)
      this.metrics.activeJobs--

      if (job.completedAt) {
        this.metrics.completedJobs++
      }

      // Persist job state if enabled
      if (this.config.enablePersistence) {
        await this.persistJob(job)
      }
    }
  }

  // Calculate retry delay with backoff
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay
    return baseDelay * Math.pow(2, attempt - 1)
  }

  // Update processing metrics
  private updateProcessingMetrics(processingTime: number, success: boolean): void {
    if (!this.config.enableMetrics) return

    this.processingTimes.push(processingTime)
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000)
    }

    this.metrics.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length

    // Calculate throughput (jobs per minute)
    const completedInLastMinute = this.processingTimes.filter(
      (_, index) => index >= this.processingTimes.length - 60
    ).length
    this.metrics.throughput = completedInLastMinute
  }

  // Persist job to cache/database
  private async persistJob(job: BaseJob): Promise<void> {
    try {
      await this.cache.set(`queue:job:${job.id}`, job, 86400) // 24 hours
    } catch (error) {
      await logger.error('Failed to persist job', { jobId: job.id }, error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Get job by ID
  async getJob(jobId: string): Promise<BaseJob | null> {
    const job = this.jobs.get(jobId)
    if (job) return job

    // Try to load from persistence
    if (this.config.enablePersistence) {
      try {
        const persistedJob = await this.cache.get<BaseJob>(`queue:job:${jobId}`)
        if (persistedJob) {
          this.jobs.set(jobId, persistedJob)
          return persistedJob
        }
      } catch (error) {
        await logger.error('Failed to load persisted job', { jobId }, error instanceof Error ? error : new Error(String(error)))
      }
    }

    return null
  }

  // Remove job from queue
  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job) return false

    // Don't remove active jobs
    if (this.activeJobs.has(jobId)) {
      throw new Error('Cannot remove active job')
    }

    this.jobs.delete(jobId)
    
    if (this.config.enablePersistence) {
      await this.cache.delete(`queue:job:${jobId}`)
    }

    await logger.info('Job removed from queue', { jobId })
    this.emit('job:removed', job)
    
    return true
  }

  // Get queue metrics
  getMetrics(): QueueMetrics {
    this.metrics.waitingJobs = Array.from(this.jobs.values())
      .filter(job => !job.completedAt && !job.failedAt && !this.activeJobs.has(job.id))
      .length

    return { ...this.metrics }
  }

  // Get jobs by status
  getJobs(status?: 'waiting' | 'active' | 'completed' | 'failed'): BaseJob[] {
    const allJobs = Array.from(this.jobs.values())
    
    if (!status) return allJobs

    return allJobs.filter(job => {
      switch (status) {
        case 'waiting':
          return !job.completedAt && !job.failedAt && !this.activeJobs.has(job.id)
        case 'active':
          return this.activeJobs.has(job.id)
        case 'completed':
          return !!job.completedAt
        case 'failed':
          return !!job.failedAt
        default:
          return false
      }
    })
  }

  // Clean up completed/failed jobs
  async cleanup(olderThan: number = 86400000): Promise<number> { // 24 hours default
    const cutoff = new Date(Date.now() - olderThan)
    let removedCount = 0

    for (const [jobId, job] of this.jobs.entries()) {
      const shouldRemove = (
        (job.completedAt && job.completedAt < cutoff) ||
        (job.failedAt && job.failedAt < cutoff)
      )

      if (shouldRemove) {
        this.jobs.delete(jobId)
        if (this.config.enablePersistence) {
          await this.cache.delete(`queue:job:${jobId}`)
        }
        removedCount++
      }
    }

    await logger.info('Queue cleanup completed', { removedCount })
    return removedCount
  }

  // Setup automatic cleanup
  private setupCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      await this.cleanup()
    }, 3600000)
  }
}

// Queue manager for multiple queues
export class QueueManager {
  private static instance: QueueManager
  private queues: Map<string, Queue> = new Map()

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager()
    }
    return QueueManager.instance
  }

  // Create or get queue
  getQueue(name: string, config?: Partial<QueueConfig>): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, config)
      this.queues.set(name, queue)
      logger.info('Queue created', { name })
    }
    return this.queues.get(name)!
  }

  // Get all queues
  getAllQueues(): Map<string, Queue> {
    return new Map(this.queues)
  }

  // Stop all queues
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.queues.values()).map(queue => queue.stop())
    await Promise.all(stopPromises)
    logger.info('All queues stopped')
  }

  // Get aggregated metrics
  getAggregatedMetrics(): QueueMetrics {
    const aggregated: QueueMetrics = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      averageProcessingTime: 0,
      throughput: 0,
    }

    const allMetrics = Array.from(this.queues.values()).map(queue => queue.getMetrics())
    
    for (const metrics of allMetrics) {
      aggregated.totalJobs += metrics.totalJobs
      aggregated.completedJobs += metrics.completedJobs
      aggregated.failedJobs += metrics.failedJobs
      aggregated.activeJobs += metrics.activeJobs
      aggregated.waitingJobs += metrics.waitingJobs
      aggregated.throughput += metrics.throughput
    }

    // Calculate average processing time
    if (allMetrics.length > 0) {
      aggregated.averageProcessingTime = 
        allMetrics.reduce((sum, m) => sum + m.averageProcessingTime, 0) / allMetrics.length
    }

    return aggregated
  }
}

// Predefined job types
export const JobTypes = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  FILE_PROCESSING: 'file_processing',
  DATA_EXPORT: 'data_export',
  BACKUP: 'backup',
  ANALYTICS: 'analytics',
  WEBHOOK: 'webhook',
  CLEANUP: 'cleanup',
} as const

// Export singleton instance
export const queueManager = QueueManager.getInstance()

// Default queues
export const emailQueue = queueManager.getQueue('email', { maxConcurrency: 3 })
export const notificationQueue = queueManager.getQueue('notifications', { maxConcurrency: 5 })
export const fileProcessingQueue = queueManager.getQueue('file-processing', { maxConcurrency: 2 })
export const analyticsQueue = queueManager.getQueue('analytics', { maxConcurrency: 1 })

export default queueManager
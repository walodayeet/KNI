import { PrismaClient, Prisma } from '@prisma/client'
import { logger, PerformanceMonitor } from './logger'

// Database configuration
interface DatabaseConfig {
  maxConnections: number
  connectionTimeout: number
  queryTimeout: number
  retryAttempts: number
  retryDelay: number
  enableLogging: boolean
  enableMetrics: boolean
}

const defaultConfig: DatabaseConfig = {
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000'),
  queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.DATABASE_RETRY_DELAY || '1000'),
  enableLogging: process.env.NODE_ENV !== 'production',
  enableMetrics: true,
}

// Database metrics
interface DatabaseMetrics {
  totalQueries: number
  successfulQueries: number
  failedQueries: number
  averageQueryTime: number
  connectionPoolSize: number
  activeConnections: number
}

class DatabaseManager {
  private static instance: DatabaseManager
  private prisma: PrismaClient
  private config: DatabaseConfig
  private metrics: DatabaseMetrics
  private queryTimes: number[] = []

  private constructor(config: Partial<DatabaseConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      connectionPoolSize: this.config.maxConnections,
      activeConnections: 0,
    }

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: this.config.enableLogging
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'info' },
            { emit: 'event', level: 'warn' },
          ]
        : [],
    })

    this.setupEventListeners()
  }

  public static getInstance(config?: Partial<DatabaseConfig>): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config)
    }
    return DatabaseManager.instance
  }

  private setupEventListeners(): void {
    if (this.config.enableLogging) {
      this.prisma.$on('query', async (e) => {
        await logger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target,
        })
      })

      this.prisma.$on('error', async (e) => {
        await logger.error('Database Error', {
          message: e.message,
          target: e.target,
        })
      })

      this.prisma.$on('warn', async (e) => {
        await logger.warn('Database Warning', {
          message: e.message,
          target: e.target,
        })
      })
    }
  }

  private updateMetrics(duration: number, success: boolean): void {
    if (!this.config.enableMetrics) return

    this.metrics.totalQueries++
    if (success) {
      this.metrics.successfulQueries++
    } else {
      this.metrics.failedQueries++
    }

    this.queryTimes.push(duration)
    // Keep only last 1000 query times for average calculation
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000)
    }

    this.metrics.averageQueryTime =
      this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length
  }

  // Execute query with retry logic and monitoring
  async executeQuery<T>(
    operation: string,
    queryFn: () => Promise<T>,
    retryAttempts?: number
  ): Promise<T> {
    const attempts = retryAttempts ?? this.config.retryAttempts
    const monitor = new PerformanceMonitor(`Database: ${operation}`)

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        this.metrics.activeConnections++
        const result = await queryFn()
        const duration = await monitor.end()
        
        this.updateMetrics(duration, true)
        await logger.logDatabaseOperation(operation, 'unknown', duration, true)
        
        return result
      } catch (error) {
        const duration = await monitor.end()
        this.updateMetrics(duration, false)
        
        const isLastAttempt = attempt === attempts
        const shouldRetry = this.shouldRetryError(error) && !isLastAttempt

        await logger.logDatabaseOperation(
          operation,
          'unknown',
          duration,
          false,
          error instanceof Error ? error : new Error(String(error))
        )

        if (shouldRetry) {
          await logger.warn(`Database operation retry ${attempt}/${attempts}`, {
            operation,
            error: error instanceof Error ? error.message : String(error),
          })
          
          await this.delay(this.config.retryDelay * attempt)
          continue
        }

        throw error
      } finally {
        this.metrics.activeConnections--
      }
    }

    throw new Error(`Database operation failed after ${attempts} attempts`)
  }

  private shouldRetryError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Retry on connection errors, timeouts, etc.
      return ['P1001', 'P1002', 'P1008', 'P1017'].includes(error.code)
    }
    
    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      return true // Retry unknown errors
    }
    
    return false
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Transaction wrapper with monitoring
  async transaction<T>(
    operations: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  ): Promise<T> {
    return this.executeQuery('transaction', () =>
      this.prisma.$transaction(operations, {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? this.config.queryTimeout,
        isolationLevel: options?.isolationLevel,
      })
    )
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    latency: number
    metrics: DatabaseMetrics
  }> {
    try {
      const start = performance.now()
      await this.prisma.$queryRaw`SELECT 1`
      const latency = performance.now() - start

      return {
        status: 'healthy',
        latency,
        metrics: { ...this.metrics },
      }
    } catch (error) {
      await logger.error('Database health check failed', {}, error instanceof Error ? error : new Error(String(error)))
      
      return {
        status: 'unhealthy',
        latency: -1,
        metrics: { ...this.metrics },
      }
    }
  }

  // Get database metrics
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics }
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      connectionPoolSize: this.config.maxConnections,
      activeConnections: 0,
    }
    this.queryTimes = []
  }

  // Get Prisma client
  getClient(): PrismaClient {
    return this.prisma
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect()
      await logger.info('Database disconnected successfully')
    } catch (error) {
      await logger.error('Error disconnecting from database', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }
}

// Repository base class with common operations
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected db: DatabaseManager
  protected tableName: string

  constructor(tableName: string) {
    this.db = DatabaseManager.getInstance()
    this.tableName = tableName
  }

  abstract create(data: CreateInput): Promise<T>
  abstract findById(id: string): Promise<T | null>
  abstract update(id: string, data: UpdateInput): Promise<T>
  abstract delete(id: string): Promise<void>
  abstract findMany(options?: any): Promise<T[]>

  // Common pagination helper
  protected getPaginationParams(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit
    return { skip, take: limit }
  }

  // Common search helper
  protected buildSearchFilter(searchTerm: string, searchFields: string[]) {
    if (!searchTerm) return {}
    
    return {
      OR: searchFields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive' as const,
        },
      })),
    }
  }
}

// User repository example
export class UserRepository extends BaseRepository<
  any, // User type
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  constructor() {
    super('user')
  }

  async create(data: Prisma.UserCreateInput) {
    return this.db.executeQuery('user.create', () =>
      this.db.getClient().user.create({ data })
    )
  }

  async findById(id: string) {
    return this.db.executeQuery('user.findById', () =>
      this.db.getClient().user.findUnique({ where: { id } })
    )
  }

  async findByEmail(email: string) {
    return this.db.executeQuery('user.findByEmail', () =>
      this.db.getClient().user.findUnique({ where: { email } })
    )
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.executeQuery('user.update', () =>
      this.db.getClient().user.update({ where: { id }, data })
    )
  }

  async delete(id: string) {
    await this.db.executeQuery('user.delete', () =>
      this.db.getClient().user.delete({ where: { id } })
    )
  }

  async findMany(options: {
    page?: number
    limit?: number
    search?: string
    orderBy?: Prisma.UserOrderByWithRelationInput
  } = {}) {
    const { page = 1, limit = 10, search, orderBy } = options
    const pagination = this.getPaginationParams(page, limit)
    const searchFilter = this.buildSearchFilter(search || '', ['name', 'email'])

    return this.db.executeQuery('user.findMany', () =>
      this.db.getClient().user.findMany({
        where: searchFilter,
        orderBy: orderBy || { createdAt: 'desc' },
        ...pagination,
      })
    )
  }

  async count(search?: string) {
    const searchFilter = this.buildSearchFilter(search || '', ['name', 'email'])
    
    return this.db.executeQuery('user.count', () =>
      this.db.getClient().user.count({ where: searchFilter })
    )
  }
}

// Export singleton instance
export const db = DatabaseManager.getInstance()
export const userRepository = new UserRepository()

// Export Prisma client for direct access when needed
export const prisma = db.getClient()

export default db
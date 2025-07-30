import Redis from 'ioredis'
import { logger } from './logger'
import crypto from 'crypto'

// Cache configuration
interface CacheConfig {
  redis: {
    enabled: boolean
    host: string
    port: number
    password?: string
    db: number
    keyPrefix: string
    maxRetriesPerRequest: number
    enableOfflineQueue: boolean
    lazyConnect: boolean
  }
  memory: {
    enabled: boolean
    maxSize: number
    ttl: number
  }
  defaultTtl: number
  compression: {
    enabled: boolean
    threshold: number
  }
}

const defaultConfig: CacheConfig = {
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'kni:',
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  },
  memory: {
    enabled: true,
    maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE || '1000'),
    ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300'), // 5 minutes
  },
  defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
  compression: {
    enabled: process.env.CACHE_COMPRESSION_ENABLED === 'true',
    threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'), // 1KB
  },
}

// Cache item interface
interface CacheItem<T = any> {
  value: T
  ttl: number
  createdAt: number
  compressed?: boolean
}

// Cache statistics
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  memoryUsage?: number
  redisConnected?: boolean
}

// Cache key patterns
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  userSession: (sessionId: string) => `session:${sessionId}`,
  userTests: (userId: string) => `user:${userId}:tests`,
  test: (id: string) => `test:${id}`,
  testQuestions: (testId: string) => `test:${testId}:questions`,
  testResults: (testId: string, userId: string) => `test:${testId}:results:${userId}`,
  consultation: (id: string) => `consultation:${id}`,
  consultationMessages: (consultationId: string) => `consultation:${consultationId}:messages`,
  apiRateLimit: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
  emailVerification: (token: string) => `email:verification:${token}`,
  passwordReset: (token: string) => `password:reset:${token}`,
  analytics: (type: string, period: string) => `analytics:${type}:${period}`,
  search: (query: string) => `search:${crypto.createHash('md5').update(query).digest('hex')}`,
} as const

// Cache tags for invalidation
export const CacheTags = {
  USER: 'user',
  TEST: 'test',
  CONSULTATION: 'consultation',
  ANALYTICS: 'analytics',
  SEARCH: 'search',
} as const

// Memory cache implementation
class MemoryCache {
  private cache = new Map<string, CacheItem>()
  private timers = new Map<string, NodeJS.Timeout>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  }
  private maxSize: number
  private defaultTtl: number

  constructor(maxSize: number, defaultTtl: number) {
    this.maxSize = maxSize
    this.defaultTtl = defaultTtl
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const item = this.cache.get(key)
      
      if (!item) {
        this.stats.misses++
        return null
      }

      // Check if expired
      if (Date.now() > item.createdAt + item.ttl * 1000) {
        this.delete(key)
        this.stats.misses++
        return null
      }

      this.stats.hits++
      return item.value as T
    } catch (error) {
      this.stats.errors++
      await logger.error('Memory cache get error', { key }, error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const actualTtl = ttl || this.defaultTtl
      
      // Remove oldest items if cache is full
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value
        if (oldestKey) {
          this.delete(oldestKey)
        }
      }

      // Clear existing timer
      const existingTimer = this.timers.get(key)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      // Set new item
      const item: CacheItem<T> = {
        value,
        ttl: actualTtl,
        createdAt: Date.now(),
      }

      this.cache.set(key, item)
      this.stats.sets++

      // Set expiration timer
      const timer = setTimeout(() => {
        this.delete(key)
      }, actualTtl * 1000)
      
      this.timers.set(key, timer)
      
      return true
    } catch (error) {
      this.stats.errors++
      await logger.error('Memory cache set error', { key }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const timer = this.timers.get(key)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(key)
      }
      
      const deleted = this.cache.delete(key)
      if (deleted) {
        this.stats.deletes++
      }
      
      return deleted
    } catch (error) {
      this.stats.errors++
      await logger.error('Memory cache delete error', { key }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  async clear(): Promise<boolean> {
    try {
      // Clear all timers
      for (const timer of this.timers.values()) {
        clearTimeout(timer)
      }
      
      this.timers.clear()
      this.cache.clear()
      
      return true
    } catch (error) {
      this.stats.errors++
      await logger.error('Memory cache clear error', {}, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key)
    if (!item) {return false}
    
    // Check if expired
    if (Date.now() > item.createdAt + item.ttl * 1000) {
      this.delete(key)
      return false
    }
    
    return true
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      memoryUsage: this.cache.size,
    }
  }

  getSize(): number {
    return this.cache.size
  }
}

// Main cache manager
export class CacheManager {
  private static instance: CacheManager
  private config: CacheConfig
  private redis?: Redis
  private memoryCache: MemoryCache
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  }
  private tags = new Map<string, Set<string>>()

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.memoryCache = new MemoryCache(
      this.config.memory.maxSize,
      this.config.memory.ttl
    )
    this.initializeRedis()
  }

  public static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config)
    }
    return CacheManager.instance
  }

  private initializeRedis(): void {
    if (!this.config.redis.enabled) {return}

    try {
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        ...(this.config.redis.password && { password: this.config.redis.password }),
        db: this.config.redis.db,
        keyPrefix: this.config.redis.keyPrefix,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest,
        enableOfflineQueue: this.config.redis.enableOfflineQueue,
        lazyConnect: this.config.redis.lazyConnect,
      })

      this.redis.on('connect', () => {
        logger.info('Redis connected')
      })

      this.redis.on('error', (error) => {
        logger.error('Redis error', {}, error)
      })

      this.redis.on('close', () => {
        logger.warn('Redis connection closed')
      })
    } catch (error) {
      logger.error('Failed to initialize Redis', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }

  private compressData(data: string): string {
    if (!this.config.compression.enabled || data.length < this.config.compression.threshold) {
      return data
    }
    
    // Simple compression using Buffer (in production, use a proper compression library)
    return Buffer.from(data).toString('base64')
  }

  private decompressData(data: string, compressed: boolean): string {
    if (!compressed) {return data}
    
    try {
      return Buffer.from(data, 'base64').toString('utf-8')
    } catch {
      return data
    }
  }

  private serializeValue<T>(value: T): { data: string; compressed: boolean } {
    const serialized = JSON.stringify(value)
    const compressed = this.config.compression.enabled && serialized.length >= this.config.compression.threshold
    
    return {
      data: compressed ? this.compressData(serialized) : serialized,
      compressed,
    }
  }

  private deserializeValue<T>(data: string, compressed: boolean): T {
    const decompressed = this.decompressData(data, compressed)
    return JSON.parse(decompressed) as T
  }

  // Get value from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first
      if (this.redis) {
        try {
          const result = await this.redis.hgetall(key)
          
          if (result.value) {
            const compressed = result.compressed === 'true'
            const value = this.deserializeValue<T>(result.value, compressed)
            
            this.stats.hits++
            
            // Also cache in memory for faster access
            if (this.config.memory.enabled) {
              await this.memoryCache.set(key, value, parseInt(result.ttl || String(this.config.defaultTtl)))
            }
            
            return value
          }
        } catch (error) {
          await logger.warn('Redis get failed, falling back to memory cache', { 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Fallback to memory cache
      if (this.config.memory.enabled) {
        const value = await this.memoryCache.get<T>(key)
        if (value !== null) {
          this.stats.hits++
          return value
        }
      }

      this.stats.misses++
      return null
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache get error', { key }, error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  // Set value in cache
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> {
    try {
      const actualTtl = ttl || this.config.defaultTtl
      const { data, compressed } = this.serializeValue(value)
      
      let success = false

      // Set in Redis
      if (this.redis) {
        try {
          const multi = this.redis.multi()
          multi.hset(key, {
            value: data,
            compressed: compressed.toString(),
            ttl: actualTtl.toString(),
            createdAt: Date.now().toString(),
          })
          multi.expire(key, actualTtl)
          
          await multi.exec()
          success = true
        } catch (error) {
          await logger.warn('Redis set failed, using memory cache only', { 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Set in memory cache
      if (this.config.memory.enabled) {
        const memorySuccess = await this.memoryCache.set(key, value, actualTtl)
        success = success || memorySuccess
      }

      // Handle tags
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          if (!this.tags.has(tag)) {
            this.tags.set(tag, new Set())
          }
          this.tags.get(tag)!.add(key)
        }
      }

      if (success) {
        this.stats.sets++
      }
      
      return success
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache set error', { key }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Delete value from cache
  async delete(key: string): Promise<boolean> {
    try {
      let success = false

      // Delete from Redis
      if (this.redis) {
        try {
          const result = await this.redis.del(key)
          success = result > 0
        } catch (error) {
          await logger.warn('Redis delete failed', { 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Delete from memory cache
      if (this.config.memory.enabled) {
        const memorySuccess = await this.memoryCache.delete(key)
        success = success || memorySuccess
      }

      // Remove from tags
      for (const tagKeys of this.tags.values()) {
        tagKeys.delete(key)
      }

      if (success) {
        this.stats.deletes++
      }
      
      return success
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache delete error', { key }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      // Check Redis first
      if (this.redis) {
        try {
          const result = await this.redis.exists(key)
          if (result > 0) {return true}
        } catch (error) {
          await logger.warn('Redis exists check failed', { 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Check memory cache
      if (this.config.memory.enabled) {
        return await this.memoryCache.exists(key)
      }

      return false
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache exists error', { key }, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Clear all cache
  async clear(): Promise<boolean> {
    try {
      let success = false

      // Clear Redis
      if (this.redis) {
        try {
          await this.redis.flushdb()
          success = true
        } catch (error) {
          await logger.warn('Redis clear failed', { 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Clear memory cache
      if (this.config.memory.enabled) {
        const memorySuccess = await this.memoryCache.clear()
        success = success || memorySuccess
      }

      // Clear tags
      this.tags.clear()
      
      return success
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache clear error', {}, error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  // Invalidate by tag
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = this.tags.get(tag)
      if (!keys || keys.size === 0) {return 0}

      let deletedCount = 0
      
      for (const key of keys) {
        const deleted = await this.delete(key)
        if (deleted) {deletedCount++}
      }

      this.tags.delete(tag)
      
      await logger.info('Cache invalidated by tag', { tag, deletedCount })
      return deletedCount
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache invalidate by tag error', { tag }, error instanceof Error ? error : new Error(String(error)))
      return 0
    }
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T | null> {
    try {
      // Try to get existing value
      const existing = await this.get<T>(key)
      if (existing !== null) {
        return existing
      }

      // Generate new value
      const value = await factory()
      
      // Cache the new value
      await this.set(key, value, ttl, tags)
      
      return value
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache getOrSet error', { key }, error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  // Increment counter
  async increment(key: string, amount: number = 1, ttl?: number): Promise<number> {
    try {
      if (this.redis) {
        try {
          const result = await this.redis.incrby(key, amount)
          if (ttl) {
            await this.redis.expire(key, ttl)
          }
          return result
        } catch (error) {
          await logger.warn('Redis increment failed', { 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          })
        }
      }

      // Fallback to get/set pattern
      const current = await this.get<number>(key) || 0
      const newValue = current + amount
      await this.set(key, newValue, ttl)
      return newValue
    } catch (error) {
      this.stats.errors++
      await logger.error('Cache increment error', { key }, error instanceof Error ? error : new Error(String(error)))
      return 0
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats()
    
    return {
      hits: this.stats.hits + memoryStats.hits,
      misses: this.stats.misses + memoryStats.misses,
      sets: this.stats.sets + memoryStats.sets,
      deletes: this.stats.deletes + memoryStats.deletes,
      errors: this.stats.errors + memoryStats.errors,
      memoryUsage: memoryStats.memoryUsage ?? 0,
      redisConnected: this.redis?.status === 'ready',
    }
  }

  // Health check
  async healthCheck(): Promise<{ redis: boolean; memory: boolean }> {
    const health = {
      redis: false,
      memory: false,
    }

    // Check Redis
    if (this.redis) {
      try {
        await this.redis.ping()
        health.redis = true
      } catch (error) {
        await logger.warn('Redis health check failed', { 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    // Check memory cache
    try {
      const testKey = `health-check-${  Date.now()}`
      await this.memoryCache.set(testKey, 'test', 1)
      const result = await this.memoryCache.get(testKey)
      health.memory = result === 'test'
      await this.memoryCache.delete(testKey)
    } catch (error) {
      await logger.warn('Memory cache health check failed', { 
        error: error instanceof Error ? error.message : String(error) 
      })
    }

    return health
  }
}

// Cache service with predefined methods
export class CacheService {
  private static cacheManager = CacheManager.getInstance()

  // User caching
  static async getUser(userId: string) {
    return this.cacheManager.get(CacheKeys.user(userId))
  }

  static async setUser(userId: string, user: any, ttl?: number) {
    return this.cacheManager.set(CacheKeys.user(userId), user, ttl, [CacheTags.USER])
  }

  static async invalidateUser(userId: string) {
    return this.cacheManager.delete(CacheKeys.user(userId))
  }

  // Test caching
  static async getTest(testId: string) {
    return this.cacheManager.get(CacheKeys.test(testId))
  }

  static async setTest(testId: string, test: any, ttl?: number) {
    return this.cacheManager.set(CacheKeys.test(testId), test, ttl, [CacheTags.TEST])
  }

  static async invalidateTest(testId: string) {
    return this.cacheManager.delete(CacheKeys.test(testId))
  }

  // Session caching
  static async getSession(sessionId: string) {
    return this.cacheManager.get(CacheKeys.userSession(sessionId))
  }

  static async setSession(sessionId: string, session: any, ttl?: number) {
    return this.cacheManager.set(CacheKeys.userSession(sessionId), session, ttl)
  }

  static async invalidateSession(sessionId: string) {
    return this.cacheManager.delete(CacheKeys.userSession(sessionId))
  }

  // Rate limiting
  static async incrementRateLimit(ip: string, endpoint: string, ttl: number = 3600) {
    return this.cacheManager.increment(CacheKeys.apiRateLimit(ip, endpoint), 1, ttl)
  }

  static async getRateLimit(ip: string, endpoint: string) {
    return this.cacheManager.get<number>(CacheKeys.apiRateLimit(ip, endpoint))
  }

  // Search caching
  static async getSearchResults(query: string) {
    return this.cacheManager.get(CacheKeys.search(query))
  }

  static async setSearchResults(query: string, results: any, ttl: number = 1800) {
    return this.cacheManager.set(CacheKeys.search(query), results, ttl, [CacheTags.SEARCH])
  }

  // Analytics caching
  static async getAnalytics(type: string, period: string) {
    return this.cacheManager.get(CacheKeys.analytics(type, period))
  }

  static async setAnalytics(type: string, period: string, data: any, ttl: number = 3600) {
    return this.cacheManager.set(CacheKeys.analytics(type, period), data, ttl, [CacheTags.ANALYTICS])
  }

  // Generic methods
  static async get<T>(key: string): Promise<T | null> {
    return this.cacheManager.get<T>(key)
  }

  static async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> {
    return this.cacheManager.set(key, value, ttl, tags)
  }

  static async delete(key: string): Promise<boolean> {
    return this.cacheManager.delete(key)
  }

  static async clear(): Promise<boolean> {
    return this.cacheManager.clear()
  }

  static async invalidateByTag(tag: string): Promise<number> {
    return this.cacheManager.invalidateByTag(tag)
  }

  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T | null> {
    return this.cacheManager.getOrSet(key, factory, ttl, tags)
  }

  static getStats() {
    return this.cacheManager.getStats()
  }

  static async healthCheck() {
    return this.cacheManager.healthCheck()
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance()
export default CacheService
import { z } from 'zod'
import { logger } from './logger'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import { performance } from 'perf_hooks'

// External API configuration interfaces
interface ExternalAPIConfig {
  baseURL: string
  timeout: number
  retries: number
  retryDelay: number
  rateLimit: RateLimitConfig
  authentication: AuthConfig
  caching: CacheConfig
  monitoring: MonitoringConfig
  headers: Record<string, string>
  interceptors: InterceptorConfig
  circuit: CircuitBreakerConfig
}

interface RateLimitConfig {
  enabled: boolean
  requests: number
  window: number // milliseconds
  strategy: 'fixed' | 'sliding' | 'token-bucket'
  burst?: number
  queueSize?: number
}

interface AuthConfig {
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'custom'
  token?: string | undefined
  username?: string | undefined
  password?: string | undefined
  apiKey?: string | undefined
  headerName?: string | undefined
  oauth2?: OAuth2Config | undefined
  custom?: ((request: ExternalAPIRequest) => Promise<ExternalAPIRequest>) | undefined
}

interface OAuth2Config {
  clientId: string
  clientSecret: string
  tokenUrl: string
  scope?: string
  grantType: 'client_credentials' | 'authorization_code' | 'refresh_token'
  refreshToken?: string
  accessToken?: string
  expiresAt?: Date
}

interface CacheConfig {
  enabled: boolean
  ttl: number // seconds
  maxSize: number
  strategy: 'lru' | 'lfu' | 'fifo'
  keyGenerator?: (request: ExternalAPIRequest) => string
  shouldCache?: (request: ExternalAPIRequest, response: ExternalAPIResponse) => boolean
}

interface MonitoringConfig {
  enabled: boolean
  metrics: {
    requests: boolean
    responses: boolean
    errors: boolean
    latency: boolean
    rateLimit: boolean
  }
  logging: {
    requests: boolean
    responses: boolean
    errors: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
  }
}

interface InterceptorConfig {
  request: RequestInterceptor[]
  response: ResponseInterceptor[]
  error: ErrorInterceptor[]
}

interface CircuitBreakerConfig {
  enabled: boolean
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  fallback?: (error: Error) => Promise<any>
}

// External API request/response interfaces
export interface ExternalAPIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  url: string
  headers?: Record<string, string> | undefined
  params?: Record<string, any> | undefined
  data?: any
  timeout?: number | undefined
  retries?: number | undefined
  cache?: boolean | undefined
  metadata?: Record<string, any> | undefined
}

export interface ExternalAPIResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: ExternalAPIRequest
  cached?: boolean
  timing: {
    start: number
    end: number
    duration: number
  }
}

export interface ExternalAPIError extends Error {
  code?: string
  status?: number
  response?: ExternalAPIResponse
  request?: ExternalAPIRequest
  isRetryable?: boolean
}

// Interceptor types
type RequestInterceptor = (request: ExternalAPIRequest) => Promise<ExternalAPIRequest>
type ResponseInterceptor = (response: ExternalAPIResponse) => Promise<ExternalAPIResponse>
type ErrorInterceptor = (error: ExternalAPIError) => Promise<ExternalAPIError | ExternalAPIResponse>

// API metrics
interface ExternalAPIMetrics {
  requests: {
    total: number
    success: number
    error: number
    cached: number
  }
  latency: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }
  rateLimit: {
    remaining: number
    reset: Date
    limit: number
  }
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open'
    failures: number
    lastFailure?: Date
  }
}

// Zod schemas
const externalAPIRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  params: z.record(z.any()).optional(),
  data: z.any().optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).optional(),
  cache: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
})

const externalAPIConfigSchema = z.object({
  baseURL: z.string().url(),
  timeout: z.number().positive().default(30000),
  retries: z.number().min(0).default(3),
  retryDelay: z.number().positive().default(1000),
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    requests: z.number().positive().default(100),
    window: z.number().positive().default(60000),
    strategy: z.enum(['fixed', 'sliding', 'token-bucket']).default('sliding'),
  }),
  authentication: z.object({
    type: z.enum(['none', 'bearer', 'basic', 'api-key', 'oauth2', 'custom']).default('none'),
  }),
  caching: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().positive().default(300),
    maxSize: z.number().positive().default(1000),
    strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  }),
})

// Rate limiter implementation
class ExternalRateLimiter {
  private requests: Map<string, number | number[]> = new Map()
  private tokens: Map<string, { count: number; lastRefill: number }> = new Map()
  
  constructor(private config: RateLimitConfig) {}

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; reset: Date }> {
    if (!this.config.enabled) {
      return { allowed: true, remaining: this.config.requests, reset: new Date() }
    }

    const now = Date.now()
    
    switch (this.config.strategy) {
      case 'fixed':
        return this.checkFixedWindow(key, now)
      case 'sliding':
        return this.checkSlidingWindow(key, now)
      case 'token-bucket':
        return this.checkTokenBucket(key, now)
      default:
        return this.checkSlidingWindow(key, now)
    }
  }

  private checkFixedWindow(key: string, now: number): { allowed: boolean; remaining: number; reset: Date } {
    const windowStart = Math.floor(now / this.config.window) * this.config.window
    const windowKey = `${key}:${windowStart}`
    
    const count = (this.requests.get(windowKey) as unknown as number) || 0
    const allowed = count < this.config.requests
    
    if (allowed) {
      this.requests.set(windowKey, count + 1)
    }
    
    const remaining = Math.max(0, this.config.requests - count - (allowed ? 1 : 0))
    const reset = new Date(windowStart + this.config.window)
    
    return { allowed, remaining, reset }
  }

  private checkSlidingWindow(key: string, now: number): { allowed: boolean; remaining: number; reset: Date } {
    const requests = this.requests.get(key) as number[] || []
    const windowStart = now - this.config.window
    
    // Remove old requests
    const validRequests = requests.filter(time => time > windowStart)
    
    const allowed = validRequests.length < this.config.requests
    
    if (allowed) {
      validRequests.push(now)
      this.requests.set(key, validRequests)
    }
    
    const remaining = Math.max(0, this.config.requests - validRequests.length)
    const reset = new Date(now + this.config.window)
    
    return { allowed, remaining, reset }
  }

  private checkTokenBucket(key: string, now: number): { allowed: boolean; remaining: number; reset: Date } {
    const bucket = this.tokens.get(key) || {
      count: this.config.requests,
      lastRefill: now,
    }
    
    // Refill tokens
    const timePassed = now - bucket.lastRefill
    const tokensToAdd = Math.floor(timePassed / this.config.window * this.config.requests)
    
    bucket.count = Math.min(this.config.requests, bucket.count + tokensToAdd)
    bucket.lastRefill = now
    
    const allowed = bucket.count > 0
    
    if (allowed) {
      bucket.count--
    }
    
    this.tokens.set(key, bucket)
    
    const remaining = bucket.count
    const reset = new Date(now + this.config.window)
    
    return { allowed, remaining, reset }
  }

  cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.config.window * 2
    
    // Clean up old entries
    for (const [key, requests] of this.requests.entries()) {
      if (Array.isArray(requests)) {
        const validRequests = requests.filter(time => time > cutoff)
        if (validRequests.length === 0) {
          this.requests.delete(key)
        } else {
          this.requests.set(key, validRequests)
        }
      } else if (typeof requests === 'number') {
        // Fixed window cleanup
        const keyParts = key.split(':')
        if (keyParts.length > 1 && keyParts[1]) {
          const windowStart = parseInt(keyParts[1])
          if (windowStart < cutoff) {
            this.requests.delete(key)
          }
        }
      }
    }
    
    // Clean up old token buckets
    for (const [key, bucket] of this.tokens.entries()) {
      if (bucket.lastRefill < cutoff) {
        this.tokens.delete(key)
      }
    }
  }
}

// Cache implementation
class ExternalAPICache {
  private cache: Map<string, { data: any; expires: number; hits: number; created: number }> = new Map()
  private accessOrder: string[] = []
  
  constructor(private config: CacheConfig) {}

  get(key: string): any | null {
    if (!this.config.enabled) return null
    
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expires) {
      this.delete(key)
      return null
    }
    
    entry.hits++
    this.updateAccessOrder(key)
    
    return entry.data
  }

  set(key: string, data: any, ttl?: number): void {
    if (!this.config.enabled) return
    
    const expires = Date.now() + (ttl || this.config.ttl) * 1000
    
    // Evict if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict()
    }
    
    this.cache.set(key, {
      data,
      expires,
      hits: 0,
      created: Date.now(),
    })
    
    this.updateAccessOrder(key)
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
    }
    return deleted
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  private evict(): void {
    let keyToEvict: string | undefined
    
    switch (this.config.strategy) {
      case 'lru':
        keyToEvict = this.accessOrder[0]
        break
      case 'lfu':
        keyToEvict = this.findLeastFrequentlyUsed()
        break
      case 'fifo':
        keyToEvict = this.findOldest()
        break
      default:
        keyToEvict = this.accessOrder[0]
    }
    
    if (keyToEvict) {
      this.delete(keyToEvict)
    }
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
  }

  private findLeastFrequentlyUsed(): string | undefined {
    let minHits = Infinity
    let keyToEvict: string | undefined
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits
        keyToEvict = key
      }
    }
    
    return keyToEvict
  }

  private findOldest(): string | undefined {
    let oldestTime = Infinity
    let keyToEvict: string | undefined
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.created < oldestTime) {
        oldestTime = entry.created
        keyToEvict = key
      }
    }
    
    return keyToEvict
  }

  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; hits: number; age: number }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.created,
    }))
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0)
    const totalRequests = entries.length
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      entries,
    }
  }
}

// Circuit breaker implementation
class ExternalCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures = 0
  private lastFailureTime?: number
  private nextAttempt: number | undefined
  
  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return operation()
    }
    
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
    this.nextAttempt = undefined
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open'
      this.nextAttempt = Date.now() + this.config.recoveryTimeout
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt : false
  }

  getState(): { state: 'closed' | 'open' | 'half-open'; failures: number; lastFailure?: Date } {
    const result: { state: 'closed' | 'open' | 'half-open'; failures: number; lastFailure?: Date } = {
      state: this.state,
      failures: this.failures,
    }
    
    if (this.lastFailureTime) {
      result.lastFailure = new Date(this.lastFailureTime)
    }
    
    return result
  }
}

// OAuth2 token manager
class ExternalOAuth2TokenManager {
  private tokenCache: Map<string, OAuth2Config> = new Map()
  
  async getAccessToken(config: OAuth2Config): Promise<string> {
    const cacheKey = this.getCacheKey(config)
    const cached = this.tokenCache.get(cacheKey)
    
    if (cached?.accessToken && cached.expiresAt && cached.expiresAt > new Date()) {
      return cached.accessToken
    }
    
    const tokenData = await this.requestToken(config)
    
    const updatedConfig = {
      ...config,
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      refreshToken: tokenData.refresh_token || config.refreshToken,
    }
    
    this.tokenCache.set(cacheKey, updatedConfig)
    
    return tokenData.access_token
  }

  private async requestToken(config: OAuth2Config): Promise<any> {
    const body = new URLSearchParams()
    body.append('grant_type', config.grantType)
    body.append('client_id', config.clientId)
    body.append('client_secret', config.clientSecret)
    
    if (config.scope) {
      body.append('scope', config.scope)
    }
    
    if (config.grantType === 'refresh_token' && config.refreshToken) {
      body.append('refresh_token', config.refreshToken)
    }
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    
    if (!response.ok) {
      throw new Error(`OAuth2 token request failed: ${response.statusText}`)
    }
    
    return response.json()
  }

  private getCacheKey(config: OAuth2Config): string {
    return crypto
      .createHash('sha256')
      .update(`${config.clientId}:${config.tokenUrl}:${config.scope || ''}`)
      .digest('hex')
  }
}

// External API client implementation
class ExternalAPIClient extends EventEmitter {
  private config: ExternalAPIConfig
  private rateLimiter: ExternalRateLimiter
  private cache: ExternalAPICache
  private circuitBreaker: ExternalCircuitBreaker
  private oauth2Manager: ExternalOAuth2TokenManager
  private metrics: ExternalAPIMetrics
  private latencyHistory: number[] = []
  
  constructor(config: Partial<ExternalAPIConfig>) {
    super()
    
    this.config = this.mergeConfig(config)
    this.rateLimiter = new ExternalRateLimiter(this.config.rateLimit)
    this.cache = new ExternalAPICache(this.config.caching)
    this.circuitBreaker = new ExternalCircuitBreaker(this.config.circuit)
    this.oauth2Manager = new ExternalOAuth2TokenManager()
    
    this.metrics = {
      requests: { total: 0, success: 0, error: 0, cached: 0 },
      latency: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
      rateLimit: { remaining: this.config.rateLimit.requests, reset: new Date(), limit: this.config.rateLimit.requests },
      circuitBreaker: { state: 'closed', failures: 0 },
    }
    
    // Start cleanup intervals
    setInterval(() => this.rateLimiter.cleanup(), 60000) // Every minute
    setInterval(() => this.updateMetrics(), 10000) // Every 10 seconds
  }

  async request<T = any>(request: ExternalAPIRequest): Promise<ExternalAPIResponse<T>> {
    // Validate request
    const validatedRequest = externalAPIRequestSchema.parse(request)
    
    // Apply request interceptors
    let processedRequest = validatedRequest
    for (const interceptor of this.config.interceptors.request) {
      processedRequest = await interceptor(processedRequest)
    }
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(processedRequest)
    
    // Check cache
    if (processedRequest.cache !== false) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        this.metrics.requests.cached++
        this.emit('request:cached', { request: processedRequest, response: cached })
        return { ...cached, cached: true }
      }
    }
    
    // Check rate limit
    const rateLimitKey = this.getRateLimitKey(processedRequest)
    const rateLimitResult = await this.rateLimiter.checkLimit(rateLimitKey)
    
    if (!rateLimitResult.allowed) {
      const error: ExternalAPIError = new Error('Rate limit exceeded')
      error.code = 'RATE_LIMIT_EXCEEDED'
      error.status = 429
      throw error
    }
    
    this.metrics.rateLimit = {
      remaining: rateLimitResult.remaining,
      reset: rateLimitResult.reset,
      limit: this.config.rateLimit.requests,
    }
    
    // Execute request with circuit breaker
    try {
      const response = await this.circuitBreaker.execute(() => this.executeRequest<T>(processedRequest))
      
      // Apply response interceptors
      let processedResponse = response
      for (const interceptor of this.config.interceptors.response) {
        processedResponse = await interceptor(processedResponse)
      }
      
      // Cache response if applicable
      if (this.shouldCacheResponse(processedRequest, processedResponse)) {
        this.cache.set(cacheKey, processedResponse)
      }
      
      this.metrics.requests.success++
      this.updateLatencyMetrics(processedResponse.timing.duration)
      
      this.emit('request:success', { request: processedRequest, response: processedResponse })
      
      return processedResponse
    } catch (error) {
      this.metrics.requests.error++
      
      // Apply error interceptors
      let processedError = error as ExternalAPIError
      for (const interceptor of this.config.interceptors.error) {
        const result = await interceptor(processedError)
        if ('data' in result) {
          // Interceptor returned a response
          return result as ExternalAPIResponse<T>
        }
        processedError = result as ExternalAPIError
      }
      
      this.emit('request:error', { request: processedRequest, error: processedError })
      
      throw processedError
    } finally {
      this.metrics.requests.total++
    }
  }

  private async executeRequest<T>(request: ExternalAPIRequest): Promise<ExternalAPIResponse<T>> {
    const startTime = performance.now()
    
    // Build URL
    const url = new URL(request.url, this.config.baseURL)
    if (request.params) {
      for (const [key, value] of Object.entries(request.params)) {
        url.searchParams.append(key, String(value))
      }
    }
    
    // Build headers
    const headers = {
      ...this.config.headers,
      ...request.headers,
    }
    
    // Apply authentication
    await this.applyAuthentication(headers, request)
    
    // Build fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(request.timeout || this.config.timeout),
    }
    
    if (request.data && request.method !== 'GET' && request.method !== 'HEAD') {
      if (typeof request.data === 'object') {
        fetchOptions.body = JSON.stringify(request.data)
        headers['Content-Type'] = headers['Content-Type'] || 'application/json'
      } else {
        fetchOptions.body = request.data
      }
    }
    
    // Execute request with retries
    let lastError: Error
    const maxRetries = request.retries ?? this.config.retries
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (this.config.monitoring.logging.requests) {
          await logger.debug('External API request', {
            method: request.method,
            url: url.toString(),
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
          })
        }
        
        const response = await fetch(url.toString(), fetchOptions)
        const endTime = performance.now()
        
        let data: T
        const contentType = response.headers.get('content-type')
        
        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else if (contentType?.includes('text/')) {
          data = await response.text() as T
        } else {
          data = await response.arrayBuffer() as T
        }
        
        const apiResponse: ExternalAPIResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          config: request,
          timing: {
            start: startTime,
            end: endTime,
            duration: endTime - startTime,
          },
        }
        
        if (!response.ok) {
          const error: ExternalAPIError = new Error(`HTTP ${response.status}: ${response.statusText}`)
          error.status = response.status
          error.response = apiResponse
          error.request = request
          error.isRetryable = this.isRetryableError(response.status)
          
          if (!error.isRetryable || attempt === maxRetries) {
            throw error
          }
          
          lastError = error
          await this.delay(this.config.retryDelay * Math.pow(2, attempt))
          continue
        }
        
        if (this.config.monitoring.logging.responses) {
          await logger.debug('External API response', {
            status: response.status,
            duration: apiResponse.timing.duration,
            cached: false,
          })
        }
        
        return apiResponse
      } catch (error) {
        lastError = error as Error
        
        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError: ExternalAPIError = new Error('Request timeout')
          timeoutError.code = 'TIMEOUT'
          timeoutError.request = request
          timeoutError.isRetryable = true
          throw timeoutError
        }
        
        if (attempt === maxRetries) {
          break
        }
        
        await this.delay(this.config.retryDelay * Math.pow(2, attempt))
      }
    }
    
    throw lastError!
  }

  private async applyAuthentication(headers: Record<string, string>, request: ExternalAPIRequest): Promise<void> {
    const auth = this.config.authentication
    
    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          headers.Authorization = `Bearer ${auth.token}`
        }
        break
      
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = btoa(`${auth.username}:${auth.password}`)
          headers.Authorization = `Basic ${credentials}`
        }
        break
      
      case 'api-key':
        if (auth.apiKey && auth.headerName) {
          headers[auth.headerName] = auth.apiKey
        }
        break
      
      case 'oauth2':
        if (auth.oauth2) {
          const token = await this.oauth2Manager.getAccessToken(auth.oauth2)
          headers.Authorization = `Bearer ${token}`
        }
        break
      
      case 'custom':
        if (auth.custom) {
          await auth.custom(request)
        }
        break
    }
  }

  private generateCacheKey(request: ExternalAPIRequest): string {
    if (this.config.caching.keyGenerator) {
      return this.config.caching.keyGenerator(request)
    }
    
    const key = {
      method: request.method,
      url: request.url,
      params: request.params,
      data: request.method === 'GET' ? undefined : request.data,
    }
    
    return crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')
  }

  private getRateLimitKey(request: ExternalAPIRequest): string {
    // Use base URL + method as rate limit key
    return `${this.config.baseURL}:${request.method}`
  }

  private shouldCacheResponse(request: ExternalAPIRequest, response: ExternalAPIResponse): boolean {
    if (!this.config.caching.enabled || request.cache === false) {
      return false
    }
    
    if (this.config.caching.shouldCache) {
      return this.config.caching.shouldCache(request, response)
    }
    
    // Default caching logic
    return (
      request.method === 'GET' &&
      response.status >= 200 &&
      response.status < 300
    )
  }

  private isRetryableError(status: number): boolean {
    return (
      status >= 500 || // Server errors
      status === 429 || // Rate limit
      status === 408 || // Request timeout
      status === 409    // Conflict
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private updateLatencyMetrics(duration: number): void {
    this.latencyHistory.push(duration)
    
    // Keep only last 1000 measurements
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory = this.latencyHistory.slice(-1000)
    }
  }

  private updateMetrics(): void {
    if (this.latencyHistory.length === 0) return
    
    const sorted = [...this.latencyHistory].sort((a, b) => a - b)
    
    this.metrics.latency = {
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      avg: sorted.reduce((sum, val) => sum + val, 0) / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)]!,
      p95: sorted[Math.floor(sorted.length * 0.95)]!,
      p99: sorted[Math.floor(sorted.length * 0.99)]!,
    }
    
    this.metrics.circuitBreaker = this.circuitBreaker.getState()
  }

  private mergeConfig(config: Partial<ExternalAPIConfig>): ExternalAPIConfig {
    return {
      baseURL: config.baseURL || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimit: {
        enabled: true,
        requests: 100,
        window: 60000,
        strategy: 'sliding',
        ...config.rateLimit,
      },
      authentication: {
        type: 'none',
        ...config.authentication,
      },
      caching: {
        enabled: true,
        ttl: 300,
        maxSize: 1000,
        strategy: 'lru',
        ...config.caching,
      },
      monitoring: {
        enabled: true,
        metrics: {
          requests: true,
          responses: true,
          errors: true,
          latency: true,
          rateLimit: true,
        },
        logging: {
          requests: false,
          responses: false,
          errors: true,
          level: 'info',
        },
        ...config.monitoring,
      },
      headers: {
        'User-Agent': 'KNI-External-API-Client/1.0.0',
        ...config.headers,
      },
      interceptors: {
        request: [],
        response: [],
        error: [],
        ...config.interceptors,
      },
      circuit: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000,
        ...config.circuit,
      },
    }
  }

  // Convenience methods
  async get<T = any>(url: string, config?: Partial<ExternalAPIRequest>): Promise<ExternalAPIResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...config })
  }

  async post<T = any>(url: string, data?: any, config?: Partial<ExternalAPIRequest>): Promise<ExternalAPIResponse<T>> {
    return this.request<T>({ method: 'POST', url, data, ...config })
  }

  async put<T = any>(url: string, data?: any, config?: Partial<ExternalAPIRequest>): Promise<ExternalAPIResponse<T>> {
    return this.request<T>({ method: 'PUT', url, data, ...config })
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<ExternalAPIRequest>): Promise<ExternalAPIResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, data, ...config })
  }

  async delete<T = any>(url: string, config?: Partial<ExternalAPIRequest>): Promise<ExternalAPIResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...config })
  }

  // Utility methods
  getMetrics(): ExternalAPIMetrics {
    return { ...this.metrics }
  }

  getCacheStats() {
    return this.cache.getStats()
  }

  clearCache(): void {
    this.cache.clear()
  }

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.config.interceptors.request.push(interceptor)
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.config.interceptors.response.push(interceptor)
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): void {
    this.config.interceptors.error.push(interceptor)
  }
}

// External API service for common integrations
class ExternalAPIService {
  private static clients: Map<string, ExternalAPIClient> = new Map()

  static createClient(name: string, config: Partial<ExternalAPIConfig>): ExternalAPIClient {
    const client = new ExternalAPIClient(config)
    this.clients.set(name, client)
    return client
  }

  static getClient(name: string): ExternalAPIClient | undefined {
    return this.clients.get(name)
  }

  static removeClient(name: string): boolean {
    return this.clients.delete(name)
  }

  static listClients(): string[] {
    return Array.from(this.clients.keys())
  }

  // Predefined clients for common services
  static createOpenAIClient(apiKey: string): ExternalAPIClient {
    return this.createClient('openai', {
      baseURL: 'https://api.openai.com/v1',
      authentication: {
        type: 'bearer',
        token: apiKey,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      rateLimit: {
        enabled: true,
        requests: 60,
        window: 60000,
        strategy: 'sliding',
      },
    })
  }

  static createStripeClient(apiKey: string): ExternalAPIClient {
    return this.createClient('stripe', {
      baseURL: 'https://api.stripe.com/v1',
      authentication: {
        type: 'bearer',
        token: apiKey,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  }

  static createSendGridClient(apiKey: string): ExternalAPIClient {
    return this.createClient('sendgrid', {
      baseURL: 'https://api.sendgrid.com/v3',
      authentication: {
        type: 'bearer',
        token: apiKey,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  static createTwilioClient(accountSid: string, authToken: string): ExternalAPIClient {
    return this.createClient('twilio', {
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`,
      authentication: {
        type: 'basic',
        username: accountSid,
        password: authToken,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  }

  static createSlackClient(token: string): ExternalAPIClient {
    return this.createClient('slack', {
      baseURL: 'https://slack.com/api',
      authentication: {
        type: 'bearer',
        token,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  static createGitHubClient(token: string): ExternalAPIClient {
    return this.createClient('github', {
      baseURL: 'https://api.github.com',
      authentication: {
        type: 'bearer',
        token,
      },
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    })
  }

  static createDiscordClient(token: string): ExternalAPIClient {
    return this.createClient('discord', {
      baseURL: 'https://discord.com/api/v10',
      authentication: {
        type: 'bearer',
        token,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  static createNotionClient(token: string): ExternalAPIClient {
    return this.createClient('notion', {
      baseURL: 'https://api.notion.com/v1',
      authentication: {
        type: 'bearer',
        token,
      },
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
    })
  }

  static createAirtableClient(apiKey: string): ExternalAPIClient {
    return this.createClient('airtable', {
      baseURL: 'https://api.airtable.com/v0',
      authentication: {
        type: 'bearer',
        token: apiKey,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

// Default external API client instance
export const defaultExternalAPIClient = new ExternalAPIClient({
  baseURL: process.env.EXTERNAL_API_BASE_URL || 'https://api.example.com',
  timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '30000'),
  retries: parseInt(process.env.EXTERNAL_API_RETRIES || '3'),
  authentication: {
    type: process.env.EXTERNAL_API_AUTH_TYPE as any || 'none',
    token: process.env.EXTERNAL_API_TOKEN,
    apiKey: process.env.EXTERNAL_API_KEY,
    headerName: process.env.EXTERNAL_API_KEY_HEADER,
  },
  rateLimit: {
    enabled: process.env.EXTERNAL_API_RATE_LIMIT_ENABLED !== 'false',
    requests: parseInt(process.env.EXTERNAL_API_RATE_LIMIT_REQUESTS || '100'),
    window: parseInt(process.env.EXTERNAL_API_RATE_LIMIT_WINDOW || '60000'),
    strategy: (process.env.EXTERNAL_API_RATE_LIMIT_STRATEGY as any) || 'sliding',
  },
  caching: {
    enabled: process.env.EXTERNAL_API_CACHE_ENABLED !== 'false',
    ttl: parseInt(process.env.EXTERNAL_API_CACHE_TTL || '300'),
    maxSize: parseInt(process.env.EXTERNAL_API_CACHE_MAX_SIZE || '1000'),
    strategy: (process.env.EXTERNAL_API_CACHE_STRATEGY as any) || 'lru',
  },
})

export {
  ExternalAPIClient,
  ExternalAPIService,
  ExternalRateLimiter,
  ExternalAPICache,
  ExternalCircuitBreaker,
  ExternalOAuth2TokenManager,
  externalAPIRequestSchema,
  externalAPIConfigSchema,
}

export default {
  ExternalAPIClient,
  ExternalAPIService,
  defaultExternalAPIClient,
  ExternalRateLimiter,
  ExternalAPICache,
  ExternalCircuitBreaker,
  ExternalOAuth2TokenManager,
}
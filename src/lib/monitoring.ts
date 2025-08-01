import { logger } from './logger'
import { prisma } from './database'
import { CacheService } from './cache'
import os from 'os'
import { performance } from 'perf_hooks'

// Monitoring configuration
interface MonitoringConfig {
  enabled: boolean
  healthChecks: {
    enabled: boolean
    interval: number
    timeout: number
    retries: number
  }
  metrics: {
    enabled: boolean
    collectInterval: number
    retentionDays: number
    aggregationInterval: number
  }
  alerts: {
    enabled: boolean
    thresholds: {
      responseTime: number
      errorRate: number
      memoryUsage: number
      cpuUsage: number
      diskUsage: number
    }
    cooldownPeriod: number
  }
  performance: {
    enabled: boolean
    sampleRate: number
    slowQueryThreshold: number
    slowRequestThreshold: number
  }
  external: {
    enabled: boolean
    endpoints: string[]
    timeout: number
  }
}

const defaultConfig: MonitoringConfig = {
  enabled: process.env.MONITORING_ENABLED !== 'false',
  healthChecks: {
    enabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    collectInterval: parseInt(process.env.METRICS_COLLECT_INTERVAL || '60000'), // 1 minute
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
    aggregationInterval: parseInt(process.env.METRICS_AGGREGATION_INTERVAL || '300000'), // 5 minutes
  },
  alerts: {
    enabled: process.env.ALERTS_ENABLED !== 'false',
    thresholds: {
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '2000'), // 2 seconds
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '0.05'), // 5%
      memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE_THRESHOLD || '0.85'), // 85%
      cpuUsage: parseFloat(process.env.ALERT_CPU_USAGE_THRESHOLD || '0.80'), // 80%
      diskUsage: parseFloat(process.env.ALERT_DISK_USAGE_THRESHOLD || '0.90'), // 90%
    },
    cooldownPeriod: parseInt(process.env.ALERT_COOLDOWN_PERIOD || '300000'), // 5 minutes
  },
  performance: {
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
    sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '0.1'), // 10%
    slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'), // 1 second
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '2000'), // 2 seconds
  },
  external: {
    enabled: process.env.EXTERNAL_MONITORING_ENABLED !== 'false',
    endpoints: (process.env.EXTERNAL_MONITORING_ENDPOINTS || '').split(',').filter(Boolean),
    timeout: parseInt(process.env.EXTERNAL_MONITORING_TIMEOUT || '10000'), // 10 seconds
  },
}

// Health check status
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

// Alert severity
export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Interfaces
export interface HealthCheck {
  name: string
  status: HealthStatus
  message?: string
  duration: number
  timestamp: Date
  metadata?: Record<string, any>
}

export interface SystemMetrics {
  timestamp: Date
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    total: number
    used: number
    free: number
    usage: number
  }
  disk: {
    total: number
    used: number
    free: number
    usage: number
  }
  network: {
    bytesIn: number
    bytesOut: number
  }
  process: {
    pid: number
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
  }
}

export interface ApplicationMetrics {
  timestamp: Date
  requests: {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
  }
  database: {
    connections: number
    queries: number
    slowQueries: number
    averageQueryTime: number
  }
  cache: {
    hits: number
    misses: number
    hitRate: number
    size: number
  }
  users: {
    active: number
    online: number
    registered: number
  }
}

export interface PerformanceMetric {
  id: string
  type: MetricType
  name: string
  value: number
  tags?: Record<string, string>
  timestamp: Date
}

export interface Alert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  source: string
  timestamp: Date
  resolved?: Date
  metadata?: Record<string, any>
}

// Health check implementations
class HealthChecks {
  // Database health check
  static async database(): Promise<HealthCheck> {
    const start = performance.now()
    
    try {
      await prisma.$queryRaw`SELECT 1`
      const duration = performance.now() - start
      
      return {
        name: 'database',
        status: duration < 1000 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: `Database connection successful (${duration.toFixed(2)}ms)`,
        duration,
        timestamp: new Date(),
      }
    } catch (error) {
      const duration = performance.now() - start
      
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.stack : String(error) },
      }
    }
  }

  // Cache health check
  static async cache(): Promise<HealthCheck> {
    const start = performance.now()
    
    try {
      const testKey = 'health-check-test'
      const testValue = Date.now().toString()
      
      await CacheService.set(testKey, testValue, 10)
      const retrieved = await CacheService.get(testKey)
      await CacheService.delete(testKey)
      
      const duration = performance.now() - start
      
      if (retrieved === testValue) {
        return {
          name: 'cache',
          status: duration < 500 ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          message: `Cache is working (${duration.toFixed(2)}ms)`,
          duration,
          timestamp: new Date(),
        }
      } else {
        return {
          name: 'cache',
          status: HealthStatus.DEGRADED,
          message: 'Cache read/write mismatch',
          duration,
          timestamp: new Date(),
        }
      }
    } catch (error) {
      const duration = performance.now() - start
      
      return {
        name: 'cache',
        status: HealthStatus.UNHEALTHY,
        message: `Cache check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.stack : String(error) },
      }
    }
  }

  // External service health check
  static async externalService(url: string): Promise<HealthCheck> {
    const start = performance.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), defaultConfig.external.timeout)
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      const duration = performance.now() - start
      
      return {
        name: `external-${url}`,
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: `External service ${response.ok ? 'available' : 'unavailable'} (${response.status}, ${duration.toFixed(2)}ms)`,
        duration,
        timestamp: new Date(),
        metadata: { url, status: response.status },
      }
    } catch (error) {
      const duration = performance.now() - start
      
      return {
        name: `external-${url}`,
        status: HealthStatus.UNHEALTHY,
        message: `External service check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
        metadata: { url, error: error instanceof Error ? error.stack : String(error) },
      }
    }
  }

  // System resources health check
  static async systemResources(): Promise<HealthCheck> {
    const start = performance.now()
    
    try {
      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryUsagePercent = usedMemory / totalMemory
      
      const cpuUsage = (os.loadavg()[0] || 0) / os.cpus().length
      
      let status = HealthStatus.HEALTHY
      const issues: string[] = []
      
      if (memoryUsagePercent > defaultConfig.alerts.thresholds.memoryUsage) {
        status = HealthStatus.DEGRADED
        issues.push(`High memory usage: ${(memoryUsagePercent * 100).toFixed(1)}%`)
      }
      
      if (cpuUsage > defaultConfig.alerts.thresholds.cpuUsage) {
        status = HealthStatus.DEGRADED
        issues.push(`High CPU usage: ${(cpuUsage * 100).toFixed(1)}%`)
      }
      
      const duration = performance.now() - start
      
      return {
        name: 'system-resources',
        status,
        message: issues.length > 0 ? issues.join(', ') : 'System resources normal',
        duration,
        timestamp: new Date(),
        metadata: {
          memory: {
            total: totalMemory,
            used: usedMemory,
            usage: memoryUsagePercent,
          },
          cpu: {
            usage: cpuUsage,
            cores: os.cpus().length,
          },
        },
      }
    } catch (error) {
      const duration = performance.now() - start
      
      return {
        name: 'system-resources',
        status: HealthStatus.UNHEALTHY,
        message: `System resources check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.stack : String(error) },
      }
    }
  }
}

// Metrics collector
class MetricsCollector {
  private static metrics: Map<string, PerformanceMetric[]> = new Map()
  private static counters: Map<string, number> = new Map()
  private static gauges: Map<string, number> = new Map()
  private static timers: Map<string, number[]> = new Map()

  // Collect system metrics
  static async collectSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    
    return {
      timestamp: new Date(),
      cpu: {
        usage: (os.loadavg()[0] || 0) / os.cpus().length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usage: usedMemory / totalMemory,
      },
      disk: {
        total: 0, // Would need additional library for disk stats
        used: 0,
        free: 0,
        usage: 0,
      },
      network: {
        bytesIn: 0, // Would need additional library for network stats
        bytesOut: 0,
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage,
      },
    }
  }

  // Collect application metrics
  static async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    try {
      // Get database metrics
      const dbQueries = await this.getDatabaseQueries()
      
      // Get cache metrics
      const cacheStats = await this.getCacheStats()
      
      // Get user metrics
      const userStats = await this.getUserStats()
      
      // Get request metrics
      const requestStats = this.getRequestStats()
      
      return {
        timestamp: new Date(),
        requests: requestStats,
        database: dbQueries,
        cache: cacheStats,
        users: userStats,
      }
    } catch (error) {
      await logger.error('Failed to collect application metrics', {}, error instanceof Error ? error : new Error(String(error)))
      
      // Return default metrics on error
      return {
        timestamp: new Date(),
        requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
        database: { connections: 0, queries: 0, slowQueries: 0, averageQueryTime: 0 },
        cache: { hits: 0, misses: 0, hitRate: 0, size: 0 },
        users: { active: 0, online: 0, registered: 0 },
      }
    }
  }

  private static async getDatabaseConnections(): Promise<number> {
    try {
      // This would depend on your database setup
      // For PostgreSQL with Prisma, you might query pg_stat_activity
      return 0 // Placeholder
    } catch {
      return 0
    }
  }

  private static async getDatabaseQueries(): Promise<{
    connections: number
    queries: number
    slowQueries: number
    averageQueryTime: number
  }> {
    try {
      // Get query stats from cache or database
      const queryCount = this.counters.get('db.queries') || 0
      const slowQueryCount = this.counters.get('db.slow_queries') || 0
      const queryTimes = this.timers.get('db.query_time') || []
      const avgQueryTime = queryTimes.length > 0 
        ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length 
        : 0
      
      return {
        connections: await this.getDatabaseConnections(),
        queries: queryCount,
        slowQueries: slowQueryCount,
        averageQueryTime: avgQueryTime,
      }
    } catch {
      return { connections: 0, queries: 0, slowQueries: 0, averageQueryTime: 0 }
    }
  }

  private static async getCacheStats(): Promise<{
    hits: number
    misses: number
    hitRate: number
    size: number
  }> {
    try {
      const hits = this.counters.get('cache.hits') || 0
      const misses = this.counters.get('cache.misses') || 0
      const total = hits + misses
      const hitRate = total > 0 ? hits / total : 0
      
      return {
        hits,
        misses,
        hitRate,
        size: this.gauges.get('cache.size') || 0,
      }
    } catch {
      return { hits: 0, misses: 0, hitRate: 0, size: 0 }
    }
  }

  private static async getUserStats(): Promise<{
    active: number
    online: number
    registered: number
  }> {
    try {
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      
      const [active, online, registered] = await Promise.all([
        // Use updatedAt as proxy for recent activity (users updated in last 24h)
        prisma.user.count({
          where: {
            updatedAt: {
              gte: oneDayAgo,
            },
          },
        }),
        // Use updatedAt as proxy for online users (users updated in last hour)
        prisma.user.count({
          where: {
            updatedAt: {
              gte: oneHourAgo,
            },
          },
        }),
        // Total registered users
        prisma.user.count(),
      ])
      
      return { active, online, registered }
    } catch {
      return { active: 0, online: 0, registered: 0 }
    }
  }

  private static getRequestStats(): {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
  } {
    const total = this.counters.get('requests.total') || 0
    const successful = this.counters.get('requests.successful') || 0
    const failed = this.counters.get('requests.failed') || 0
    const responseTimes = this.timers.get('requests.response_time') || []
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0
    
    return { total, successful, failed, averageResponseTime }
  }

  // Record metrics
  static increment(name: string, value = 1, tags?: Record<string, string>) {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)
    
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      type: MetricType.COUNTER,
      name,
      value: current + value,
      timestamp: new Date(),
    }
    
    if (tags) {
      metric.tags = tags
    }
    
    this.recordMetric(metric)
  }

  static gauge(name: string, value: number, tags?: Record<string, string>) {
    this.gauges.set(name, value)
    
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      type: MetricType.GAUGE,
      name,
      value,
      timestamp: new Date(),
    }
    
    if (tags) {
      metric.tags = tags
    }
    
    this.recordMetric(metric)
  }

  static timer(name: string, duration: number, tags?: Record<string, string>) {
    const times = this.timers.get(name) || []
    times.push(duration)
    
    // Keep only last 1000 measurements
    if (times.length > 1000) {
      times.shift()
    }
    
    this.timers.set(name, times)
    
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      type: MetricType.TIMER,
      name,
      value: duration,
      timestamp: new Date(),
    }
    
    if (tags) {
      metric.tags = tags
    }
    
    this.recordMetric(metric)
  }

  static histogram(name: string, value: number, tags?: Record<string, string>) {
    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      type: MetricType.HISTOGRAM,
      name,
      value,
      timestamp: new Date(),
    }
    
    if (tags) {
      metric.tags = tags
    }
    
    this.recordMetric(metric)
  }

  private static recordMetric(metric: PerformanceMetric) {
    if (!defaultConfig.metrics.enabled) return
    
    const metrics = this.metrics.get(metric.name) || []
    metrics.push(metric)
    
    // Keep only recent metrics
    const cutoff = new Date(Date.now() - defaultConfig.metrics.retentionDays * 24 * 60 * 60 * 1000)
    const filtered = metrics.filter(m => m.timestamp > cutoff)
    
    this.metrics.set(metric.name, filtered)
  }

  // Get metrics
  static getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || []
    }
    
    const allMetrics: PerformanceMetric[] = []
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics)
    }
    
    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Clear old metrics
  static clearOldMetrics() {
    const cutoff = new Date(Date.now() - defaultConfig.metrics.retentionDays * 24 * 60 * 60 * 1000)
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff)
      this.metrics.set(name, filtered)
    }
  }
}

// Alert manager
class AlertManager {
  private static alerts: Map<string, Alert> = new Map()
  private static lastAlertTime: Map<string, number> = new Map()

  // Create alert
  static async createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const alertId = crypto.randomUUID()
    const now = Date.now()
    
    // Check cooldown period
    const lastAlert = this.lastAlertTime.get(source)
    if (lastAlert && (now - lastAlert) < defaultConfig.alerts.cooldownPeriod) {
      return '' // Skip alert due to cooldown
    }
    
    const alert: Alert = {
      id: alertId,
      severity,
      title,
      message,
      source,
      timestamp: new Date(),
    }
    
    if (metadata) {
      alert.metadata = metadata
    }
    
    this.alerts.set(alertId, alert)
    this.lastAlertTime.set(source, now)
    
    // Log alert
    await logger.warn(`Alert: ${title}`, {
      alertId,
      severity,
      source,
      message,
      metadata,
    })
    
    // Send notification (implement based on your notification system)
    // await NotificationService.sendAlert(alert)
    
    return alertId
  }

  // Resolve alert
  static resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.resolved) return false
    
    alert.resolved = new Date()
    this.alerts.set(alertId, alert)
    
    return true
  }

  // Get alerts
  static getAlerts(resolved = false): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => resolved ? !!alert.resolved : !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  // Check thresholds and create alerts
  static async checkThresholds(systemMetrics: SystemMetrics, appMetrics: ApplicationMetrics) {
    const { thresholds } = defaultConfig.alerts
    
    // Memory usage alert
    if (systemMetrics.memory.usage > thresholds.memoryUsage) {
      await this.createAlert(
        AlertSeverity.HIGH,
        'High Memory Usage',
        `Memory usage is ${(systemMetrics.memory.usage * 100).toFixed(1)}% (threshold: ${(thresholds.memoryUsage * 100).toFixed(1)}%)`,
        'system.memory',
        { usage: systemMetrics.memory.usage, threshold: thresholds.memoryUsage }
      )
    }
    
    // CPU usage alert
    if (systemMetrics.cpu.usage > thresholds.cpuUsage) {
      await this.createAlert(
        AlertSeverity.HIGH,
        'High CPU Usage',
        `CPU usage is ${(systemMetrics.cpu.usage * 100).toFixed(1)}% (threshold: ${(thresholds.cpuUsage * 100).toFixed(1)}%)`,
        'system.cpu',
        { usage: systemMetrics.cpu.usage, threshold: thresholds.cpuUsage }
      )
    }
    
    // Response time alert
    if (appMetrics.requests.averageResponseTime > thresholds.responseTime) {
      await this.createAlert(
        AlertSeverity.MEDIUM,
        'Slow Response Time',
        `Average response time is ${appMetrics.requests.averageResponseTime.toFixed(0)}ms (threshold: ${thresholds.responseTime}ms)`,
        'app.response_time',
        { responseTime: appMetrics.requests.averageResponseTime, threshold: thresholds.responseTime }
      )
    }
    
    // Error rate alert
    const errorRate = appMetrics.requests.total > 0 
      ? appMetrics.requests.failed / appMetrics.requests.total 
      : 0
    
    if (errorRate > thresholds.errorRate) {
      await this.createAlert(
        AlertSeverity.HIGH,
        'High Error Rate',
        `Error rate is ${(errorRate * 100).toFixed(1)}% (threshold: ${(thresholds.errorRate * 100).toFixed(1)}%)`,
        'app.error_rate',
        { errorRate, threshold: thresholds.errorRate }
      )
    }
  }
}

// Request tracker
export class RequestTracker {
  private static activeRequests: Map<string, { start: number; metadata: any }> = new Map()

  // Start request tracking
  static startRequest(requestId: string, metadata: any = {}) {
    if (!defaultConfig.performance.enabled) return
    
    this.activeRequests.set(requestId, {
      start: performance.now(),
      metadata,
    })
  }

  // End request tracking
  static endRequest(requestId: string, success = true) {
    if (!defaultConfig.performance.enabled) return
    
    const request = this.activeRequests.get(requestId)
    if (!request) return
    
    const duration = performance.now() - request.start
    this.activeRequests.delete(requestId)
    
    // Record metrics
    MetricsCollector.increment('requests.total')
    MetricsCollector.increment(success ? 'requests.successful' : 'requests.failed')
    MetricsCollector.timer('requests.response_time', duration)
    
    // Check for slow requests
    if (duration > defaultConfig.performance.slowRequestThreshold) {
      logger.warn('Slow request detected', {
        requestId,
        duration: duration.toFixed(2),
        threshold: defaultConfig.performance.slowRequestThreshold,
        metadata: request.metadata,
      })
    }
  }

  // Track database query
  static trackQuery(query: string, duration: number) {
    if (!defaultConfig.performance.enabled) return
    
    MetricsCollector.increment('db.queries')
    MetricsCollector.timer('db.query_time', duration)
    
    if (duration > defaultConfig.performance.slowQueryThreshold) {
      MetricsCollector.increment('db.slow_queries')
      
      logger.warn('Slow query detected', {
        query: query.substring(0, 200), // Truncate long queries
        duration: duration.toFixed(2),
        threshold: defaultConfig.performance.slowQueryThreshold,
      })
    }
  }

  // Track cache operation
  static trackCacheOperation(operation: 'hit' | 'miss', key: string) {
    if (!defaultConfig.performance.enabled) return
    
    MetricsCollector.increment(`cache.${operation}s`, 1, { key })
  }
}

// Main monitoring manager
export class MonitoringManager {
  private static instance: MonitoringManager
  private config: MonitoringConfig
  private healthCheckTimer?: NodeJS.Timeout
  private metricsTimer?: NodeJS.Timeout
  private isRunning = false

  private constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  public static getInstance(config?: Partial<MonitoringConfig>): MonitoringManager {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager(config)
    }
    return MonitoringManager.instance
  }

  // Start monitoring
  async start() {
    if (!this.config.enabled || this.isRunning) return
    
    this.isRunning = true
    
    if (this.config.healthChecks.enabled) {
      this.startHealthChecks()
    }
    
    if (this.config.metrics.enabled) {
      this.startMetricsCollection()
    }
    
    await logger.info('Monitoring started', {
      healthChecks: this.config.healthChecks.enabled,
      metrics: this.config.metrics.enabled,
      alerts: this.config.alerts.enabled,
    })
  }

  // Stop monitoring
  async stop() {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      delete this.healthCheckTimer
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      delete this.metricsTimer
    }
    
    await logger.info('Monitoring stopped')
  }

  // Start health checks
  private startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.runHealthChecks()
    }, this.config.healthChecks.interval)
    
    // Run initial health check
    this.runHealthChecks()
  }

  // Start metrics collection
  private startMetricsCollection() {
    this.metricsTimer = setInterval(async () => {
      await this.collectMetrics()
    }, this.config.metrics.collectInterval)
    
    // Run initial metrics collection
    this.collectMetrics()
  }

  // Run health checks
  private async runHealthChecks() {
    try {
      const checks = await Promise.allSettled([
        HealthChecks.database(),
        HealthChecks.cache(),
        HealthChecks.systemResources(),
        ...this.config.external.endpoints.map(url => HealthChecks.externalService(url)),
      ])
      
      const results = checks.map(check => 
        check.status === 'fulfilled' ? check.value : {
          name: 'unknown',
          status: HealthStatus.UNKNOWN,
          message: 'Health check failed',
          duration: 0,
          timestamp: new Date(),
        }
      )
      
      // Log unhealthy services
      const unhealthy = results.filter(r => r.status === HealthStatus.UNHEALTHY)
      if (unhealthy.length > 0) {
        await logger.error('Unhealthy services detected', {
          services: unhealthy.map(s => ({ name: s.name, message: s.message })),
        })
      }
      
      // Store health check results (implement based on your storage needs)
      await this.storeHealthChecks(results)
    } catch (error) {
      await logger.error('Health check execution failed', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Collect metrics
  private async collectMetrics() {
    try {
      const [systemMetrics, appMetrics] = await Promise.all([
        MetricsCollector.collectSystemMetrics(),
        MetricsCollector.collectApplicationMetrics(),
      ])
      
      // Check alert thresholds
      if (this.config.alerts.enabled) {
        await AlertManager.checkThresholds(systemMetrics, appMetrics)
      }
      
      // Store metrics (implement based on your storage needs)
      await this.storeMetrics(systemMetrics, appMetrics)
      
      // Clean up old metrics
      MetricsCollector.clearOldMetrics()
    } catch (error) {
      await logger.error('Metrics collection failed', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Store health checks (implement based on your needs)
  private async storeHealthChecks(checks: HealthCheck[]) {
    // Store in database, send to monitoring service, etc.
    // For now, just cache the latest results
    await CacheService.set('health-checks', checks, 300) // 5 minutes
  }

  // Store metrics (implement based on your needs)
  private async storeMetrics(systemMetrics: SystemMetrics, appMetrics: ApplicationMetrics) {
    // Store in time-series database, send to monitoring service, etc.
    // For now, just cache the latest results
    await CacheService.set('system-metrics', systemMetrics, 300) // 5 minutes
    await CacheService.set('app-metrics', appMetrics, 300) // 5 minutes
  }

  // Get current health status
  async getHealthStatus(): Promise<{
    status: HealthStatus
    checks: HealthCheck[]
    timestamp: Date
  }> {
    try {
      const checks = await CacheService.get<HealthCheck[]>('health-checks') || []
      
      let overallStatus = HealthStatus.HEALTHY
      
      if (checks.some(c => c.status === HealthStatus.UNHEALTHY)) {
        overallStatus = HealthStatus.UNHEALTHY
      } else if (checks.some(c => c.status === HealthStatus.DEGRADED)) {
        overallStatus = HealthStatus.DEGRADED
      }
      
      return {
        status: overallStatus,
        checks,
        timestamp: new Date(),
      }
    } catch (error) {
      await logger.error('Failed to get health status', {}, error instanceof Error ? error : new Error(String(error)))
      
      return {
        status: HealthStatus.UNKNOWN,
        checks: [],
        timestamp: new Date(),
      }
    }
  }

  // Get current metrics
  async getCurrentMetrics(): Promise<{
    system: SystemMetrics | null
    application: ApplicationMetrics | null
    timestamp: Date
  }> {
    try {
      const [systemMetrics, appMetrics] = await Promise.all([
        CacheService.get<SystemMetrics>('system-metrics'),
        CacheService.get<ApplicationMetrics>('app-metrics'),
      ])
      
      return {
        system: systemMetrics,
        application: appMetrics,
        timestamp: new Date(),
      }
    } catch (error) {
      await logger.error('Failed to get current metrics', {}, error instanceof Error ? error : new Error(String(error)))
      
      return {
        system: null,
        application: null,
        timestamp: new Date(),
      }
    }
  }

  // Get alerts
  getAlerts(resolved = false): Alert[] {
    return AlertManager.getAlerts(resolved)
  }

  // Resolve alert
  resolveAlert(alertId: string): boolean {
    return AlertManager.resolveAlert(alertId)
  }
}

// Export singleton instance
export const monitoringManager = MonitoringManager.getInstance()

// Export utilities
export {
  MetricsCollector,
  AlertManager,
  HealthChecks,
}

// Export default
export default MonitoringManager
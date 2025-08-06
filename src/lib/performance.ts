import { logger } from './logger'
import { CacheService } from './cache'
import { EventEmitter } from 'events'
import { performance, PerformanceObserver } from 'perf_hooks'
import cluster from 'cluster'
import os from 'os'

// Performance configuration
interface PerformanceConfig {
  monitoring: MonitoringConfig
  optimization: OptimizationConfig
  caching: CachingConfig
  compression: CompressionConfig
  bundling: BundlingConfig
  database: DatabaseOptimizationConfig
  memory: MemoryConfig
  cpu: CPUConfig
}

interface MonitoringConfig {
  enabled: boolean
  metricsInterval: number
  alertThresholds: AlertThresholds
  sampling: SamplingConfig
  profiling: ProfilingConfig
}

interface AlertThresholds {
  responseTime: number
  memoryUsage: number
  cpuUsage: number
  errorRate: number
  throughput: number
}

interface SamplingConfig {
  enabled: boolean
  rate: number
  maxSamples: number
}

interface ProfilingConfig {
  enabled: boolean
  duration: number
  interval: number
  includeStackTrace: boolean
}

interface OptimizationConfig {
  lazyLoading: boolean
  codesplitting: boolean
  treeshaking: boolean
  minification: boolean
  imageOptimization: boolean
  preloading: PreloadingConfig
}

interface PreloadingConfig {
  enabled: boolean
  strategies: ('dns-prefetch' | 'preconnect' | 'modulepreload' | 'prefetch' | 'preload')[]
  resources: PreloadResource[]
}

interface PreloadResource {
  url: string
  type: 'script' | 'style' | 'image' | 'font' | 'fetch'
  priority: 'high' | 'low'
  crossorigin?: boolean
}

interface CachingConfig {
  strategies: CacheStrategy[]
  levels: CacheLevel[]
  invalidation: InvalidationConfig
}

interface CacheStrategy {
  name: string
  type: 'memory' | 'redis' | 'cdn' | 'browser' | 'service-worker'
  ttl: number
  maxSize: number
  compression: boolean
  patterns: string[]
}

interface CacheLevel {
  name: string
  priority: number
  fallback?: string
}

interface InvalidationConfig {
  enabled: boolean
  strategies: ('time-based' | 'event-based' | 'manual' | 'tag-based')[]
  tags: string[]
}

interface CompressionConfig {
  enabled: boolean
  algorithms: ('gzip' | 'brotli' | 'deflate')[]
  level: number
  threshold: number
  mimeTypes: string[]
}

interface BundlingConfig {
  enabled: boolean
  strategy: 'webpack' | 'rollup' | 'esbuild' | 'vite'
  splitting: SplittingConfig
  optimization: BundleOptimizationConfig
}

interface SplittingConfig {
  vendor: boolean
  async: boolean
  dynamic: boolean
  chunks: ChunkConfig[]
}

interface ChunkConfig {
  name: string
  test: string
  priority: number
  enforce?: boolean
}

interface BundleOptimizationConfig {
  minimize: boolean
  concatenate: boolean
  dedupe: boolean
  sideEffects: boolean
}

interface DatabaseOptimizationConfig {
  indexing: IndexingConfig
  querying: QueryOptimizationConfig
  connection: ConnectionOptimizationConfig
  caching: DatabaseCachingConfig
}

interface IndexingConfig {
  enabled: boolean
  autoCreate: boolean
  strategies: IndexStrategy[]
}

interface IndexStrategy {
  table: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  unique: boolean
  partial?: string
}

interface QueryOptimizationConfig {
  enabled: boolean
  explain: boolean
  timeout: number
  batchSize: number
  pagination: PaginationConfig
}

interface PaginationConfig {
  defaultLimit: number
  maxLimit: number
  cursorBased: boolean
}

interface ConnectionOptimizationConfig {
  pooling: PoolingConfig
  keepAlive: boolean
  timeout: number
}

interface PoolingConfig {
  min: number
  max: number
  acquireTimeout: number
  idleTimeout: number
}

interface DatabaseCachingConfig {
  enabled: boolean
  queryCache: boolean
  resultCache: boolean
  ttl: number
}

interface MemoryConfig {
  monitoring: boolean
  gc: GCConfig
  limits: MemoryLimits
  optimization: MemoryOptimizationConfig
}

interface GCConfig {
  enabled: boolean
  strategy: 'aggressive' | 'balanced' | 'conservative'
  interval: number
}

interface MemoryLimits {
  heap: number
  rss: number
  external: number
}

interface MemoryOptimizationConfig {
  objectPooling: boolean
  stringInterning: boolean
  bufferReuse: boolean
}

interface CPUConfig {
  monitoring: boolean
  clustering: ClusteringConfig
  workers: WorkerConfig
  optimization: CPUOptimizationConfig
}

interface ClusteringConfig {
  enabled: boolean
  workers: number
  strategy: 'round-robin' | 'least-connections' | 'ip-hash'
}

interface WorkerConfig {
  enabled: boolean
  maxWorkers: number
  taskQueue: TaskQueueConfig
}

interface TaskQueueConfig {
  maxSize: number
  timeout: number
  priority: boolean
}

interface CPUOptimizationConfig {
  scheduling: boolean
  affinity: boolean
  throttling: ThrottlingConfig
}

interface ThrottlingConfig {
  enabled: boolean
  threshold: number
  cooldown: number
}

// Performance metrics
interface PerformanceMetrics {
  timestamp: Date
  responseTime: ResponseTimeMetrics
  throughput: ThroughputMetrics
  resource: ResourceMetrics
  error: ErrorMetrics
  user: UserMetrics
}

interface ResponseTimeMetrics {
  avg: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
}

interface ThroughputMetrics {
  requestsPerSecond: number
  requestsPerMinute: number
  concurrentUsers: number
  queueLength: number
}

interface ResourceMetrics {
  cpu: CPUMetrics
  memory: MemoryMetrics
  disk: DiskMetrics
  network: NetworkMetrics
}

interface CPUMetrics {
  usage: number
  loadAverage: number[]
  processes: number
  threads: number
}

interface MemoryMetrics {
  used: number
  free: number
  total: number
  heap: HeapMetrics
  gc: GCMetrics
}

interface HeapMetrics {
  used: number
  total: number
  limit: number
}

interface GCMetrics {
  collections: number
  duration: number
  freed: number
}

interface DiskMetrics {
  usage: number
  free: number
  total: number
  iops: number
}

interface NetworkMetrics {
  bytesIn: number
  bytesOut: number
  connections: number
  latency: number
}

interface ErrorMetrics {
  total: number
  rate: number
  types: Record<string, number>
  recent: ErrorInfo[]
}

interface ErrorInfo {
  timestamp: Date
  type: string
  message: string
  stack?: string
}

interface UserMetrics {
  active: number
  sessions: number
  pageViews: number
  bounceRate: number
}

// Performance measurement
interface PerformanceMeasurement {
  id: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  tags?: string[]
}

interface PerformanceProfile {
  id: string
  name: string
  startTime: Date
  endTime?: Date
  duration?: number
  measurements: PerformanceMeasurement[]
  metrics: PerformanceMetrics
  recommendations: PerformanceRecommendation[]
}

interface PerformanceRecommendation {
  type: 'critical' | 'warning' | 'info'
  category: 'memory' | 'cpu' | 'network' | 'database' | 'cache' | 'bundle'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  actions: string[]
}



// Performance monitor
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private measurements: Map<string, PerformanceMeasurement> = new Map()
  private observer?: PerformanceObserver
  private config: MonitoringConfig

  constructor(config: MonitoringConfig) {
    this.config = config
    this.setupObserver()
  }

  private setupObserver(): void {
    if (!this.config.enabled) return

    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordEntry(entry)
      }
    })

    this.observer.observe({ entryTypes: ['measure', 'navigation', 'resource', 'paint'] })
  }

  private recordEntry(entry: PerformanceEntry): void {
    if (this.config.sampling.enabled) {
      if (Math.random() > this.config.sampling.rate) {
        return
      }
    }

    const measurement: PerformanceMeasurement = {
      id: this.generateId(),
      name: entry.name,
      startTime: entry.startTime,
      endTime: entry.startTime + entry.duration,
      duration: entry.duration,
      metadata: {
        entryType: entry.entryType,
        ...this.extractMetadata(entry),
      },
    }

    this.measurements.set(measurement.id, measurement)
    this.pruneOldMeasurements()
  }

  private extractMetadata(entry: PerformanceEntry): Record<string, any> {
    const metadata: Record<string, any> = {}

    if ('transferSize' in entry) {
      metadata.transferSize = (entry as any).transferSize
    }
    if ('decodedBodySize' in entry) {
      metadata.decodedBodySize = (entry as any).decodedBodySize
    }
    if ('encodedBodySize' in entry) {
      metadata.encodedBodySize = (entry as any).encodedBodySize
    }

    return metadata
  }

  startMeasurement(name: string, metadata?: Record<string, any>): string {
    const id = this.generateId()
    const measurement: PerformanceMeasurement = {
      id,
      name,
      startTime: performance.now(),
      metadata,
    }

    this.measurements.set(id, measurement)
    performance.mark(`${name}-start-${id}`)
    
    return id
  }

  endMeasurement(id: string): PerformanceMeasurement | null {
    const measurement = this.measurements.get(id)
    if (!measurement) return null

    measurement.endTime = performance.now()
    measurement.duration = measurement.endTime - measurement.startTime

    performance.mark(`${measurement.name}-end-${id}`)
    performance.measure(
      `${measurement.name}-${id}`,
      `${measurement.name}-start-${id}`,
      `${measurement.name}-end-${id}`
    )

    return measurement
  }

  getMeasurements(name?: string): PerformanceMeasurement[] {
    const measurements = Array.from(this.measurements.values())
    return name ? measurements.filter(m => m.name === name) : measurements
  }

  getMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      responseTime: this.calculateResponseTimeMetrics(),
      throughput: this.calculateThroughputMetrics(),
      resource: this.calculateResourceMetrics(),
      error: this.calculateErrorMetrics(),
      user: this.calculateUserMetrics(),
    }
  }

  private calculateResponseTimeMetrics(): ResponseTimeMetrics {
    const durations = this.getMeasurements()
      .filter(m => m.duration !== undefined)
      .map(m => m.duration!)
      .sort((a, b) => a - b)

    if (durations.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 }
    }

    return {
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      min: durations[0],
      max: durations[durations.length - 1],
    }
  }

  private calculateThroughputMetrics(): ThroughputMetrics {
    const now = Date.now()
    const oneSecondAgo = now - 1000
    const oneMinuteAgo = now - 60000

    const recentMeasurements = this.getMeasurements()
      .filter(m => m.startTime > oneMinuteAgo)

    const lastSecond = recentMeasurements
      .filter(m => m.startTime > oneSecondAgo)

    return {
      requestsPerSecond: lastSecond.length,
      requestsPerMinute: recentMeasurements.length,
      concurrentUsers: 0, // Would need session tracking
      queueLength: 0, // Would need queue monitoring
    }
  }

  private calculateResourceMetrics(): ResourceMetrics {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    const loadAvg = os.loadavg()

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: loadAvg,
        processes: 1, // Single process for now
        threads: 1,
      },
      memory: {
        used: memUsage.heapUsed,
        free: memUsage.heapTotal - memUsage.heapUsed,
        total: memUsage.heapTotal,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          limit: 0, // Would need v8.getHeapStatistics()
        },
        gc: {
          collections: 0, // Would need gc monitoring
          duration: 0,
          freed: 0,
        },
      },
      disk: {
        usage: 0, // Would need disk monitoring
        free: 0,
        total: 0,
        iops: 0,
      },
      network: {
        bytesIn: 0, // Would need network monitoring
        bytesOut: 0,
        connections: 0,
        latency: 0,
      },
    }
  }

  private calculateErrorMetrics(): ErrorMetrics {
    return {
      total: 0,
      rate: 0,
      types: {},
      recent: [],
    }
  }

  private calculateUserMetrics(): UserMetrics {
    return {
      active: 0,
      sessions: 0,
      pageViews: 0,
      bounceRate: 0,
    }
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1
    return values[Math.max(0, index)]
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private pruneOldMeasurements(): void {
    if (this.measurements.size <= this.config.sampling.maxSamples) return

    const measurements = Array.from(this.measurements.entries())
      .sort(([, a], [, b]) => b.startTime - a.startTime)
      .slice(0, this.config.sampling.maxSamples)

    this.measurements.clear()
    for (const [id, measurement] of measurements) {
      this.measurements.set(id, measurement)
    }
  }

  cleanup(): void {
    this.observer?.disconnect()
    this.measurements.clear()
    this.metrics = []
  }
}

// Performance optimizer
class PerformanceOptimizer {
  private config: OptimizationConfig
  private cache: CacheService

  constructor(config: OptimizationConfig, cache: CacheService) {
    this.config = config
    this.cache = cache
  }

  // Optimize images
  async optimizeImage(buffer: Buffer, options: ImageOptimizationOptions = {}): Promise<Buffer> {
    if (!this.config.imageOptimization) {
      return buffer
    }

    // This would typically use sharp or similar library
    // For now, return original buffer
    return buffer
  }

  // Generate preload hints
  generatePreloadHints(resources: PreloadResource[]): string[] {
    if (!this.config.preloading.enabled) {
      return []
    }

    return resources.map(resource => {
      const attrs = [`rel="preload"`, `href="${resource.url}"`, `as="${resource.type}"`]
      
      if (resource.crossorigin) {
        attrs.push('crossorigin')
      }
      
      if (resource.priority === 'high') {
        attrs.push('importance="high"')
      }

      return `<link ${attrs.join(' ')} />`
    })
  }

  // Optimize bundle
  async optimizeBundle(code: string, options: BundleOptimizationOptions = {}): Promise<string> {
    let optimized = code

    if (options.minimize) {
      optimized = this.minifyCode(optimized)
    }

    if (options.dedupe) {
      optimized = this.deduplicateCode(optimized)
    }

    return optimized
  }

  private minifyCode(code: string): string {
    // This would typically use terser or similar
    // For now, just remove comments and extra whitespace
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
  }

  private deduplicateCode(code: string): string {
    // Simple deduplication - would need more sophisticated logic
    const lines = code.split('\n')
    const unique = [...new Set(lines)]
    return unique.join('\n')
  }
}

interface ImageOptimizationOptions {
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  width?: number
  height?: number
  progressive?: boolean
}

// Performance analyzer
class PerformanceAnalyzer {
  private monitor: PerformanceMonitor
  private config: PerformanceConfig

  constructor(monitor: PerformanceMonitor, config: PerformanceConfig) {
    this.monitor = monitor
    this.config = config
  }

  analyzePerformance(): PerformanceProfile {
    const metrics = this.monitor.getMetrics()
    const measurements = this.monitor.getMeasurements()
    const recommendations = this.generateRecommendations(metrics)

    return {
      id: this.generateId(),
      name: 'Performance Analysis',
      startTime: new Date(),
      measurements,
      metrics,
      recommendations,
    }
  }

  private generateRecommendations(metrics: PerformanceMetrics): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = []

    // Response time recommendations
    if (metrics.responseTime.avg > this.config.monitoring.alertThresholds.responseTime) {
      recommendations.push({
        type: 'warning',
        category: 'network',
        title: 'High Response Time',
        description: `Average response time (${metrics.responseTime.avg.toFixed(2)}ms) exceeds threshold`,
        impact: 'high',
        effort: 'medium',
        actions: [
          'Enable caching for static resources',
          'Optimize database queries',
          'Consider using a CDN',
          'Implement response compression',
        ],
      })
    }

    // Memory recommendations
    if (metrics.resource.memory.used > this.config.monitoring.alertThresholds.memoryUsage) {
      recommendations.push({
        type: 'critical',
        category: 'memory',
        title: 'High Memory Usage',
        description: `Memory usage (${(metrics.resource.memory.used / 1024 / 1024).toFixed(2)}MB) is high`,
        impact: 'high',
        effort: 'high',
        actions: [
          'Implement object pooling',
          'Review memory leaks',
          'Optimize data structures',
          'Enable garbage collection tuning',
        ],
      })
    }

    // CPU recommendations
    if (metrics.resource.cpu.usage > this.config.monitoring.alertThresholds.cpuUsage) {
      recommendations.push({
        type: 'warning',
        category: 'cpu',
        title: 'High CPU Usage',
        description: `CPU usage (${(metrics.resource.cpu.usage * 100).toFixed(2)}%) is high`,
        impact: 'medium',
        effort: 'medium',
        actions: [
          'Enable clustering',
          'Optimize algorithms',
          'Use worker threads for CPU-intensive tasks',
          'Implement request throttling',
        ],
      })
    }

    // Bundle size recommendations
    recommendations.push({
      type: 'info',
      category: 'bundle',
      title: 'Bundle Optimization',
      description: 'Consider optimizing bundle size for better performance',
      impact: 'medium',
      effort: 'low',
      actions: [
        'Enable code splitting',
        'Implement lazy loading',
        'Remove unused dependencies',
        'Use tree shaking',
      ],
    })

    return recommendations
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15)
  }
}

// Performance manager
export class PerformanceManager extends EventEmitter {
  private static instance: PerformanceManager
  private config: PerformanceConfig
  private monitor: PerformanceMonitor
  private optimizer: PerformanceOptimizer
  private analyzer: PerformanceAnalyzer
  private cache: CacheService
  private metricsInterval?: NodeJS.Timeout

  private constructor(config: PerformanceConfig) {
    super()
    this.config = config
    this.cache = new CacheService()
    this.monitor = new PerformanceMonitor(config.monitoring)
    this.optimizer = new PerformanceOptimizer(config.optimization, this.cache)
    this.analyzer = new PerformanceAnalyzer(this.monitor, config)
    
    this.setupMetricsCollection()
  }

  static getInstance(config?: PerformanceConfig): PerformanceManager {
    if (!PerformanceManager.instance && config) {
      PerformanceManager.instance = new PerformanceManager(config)
    }
    return PerformanceManager.instance
  }

  private setupMetricsCollection(): void {
    if (!this.config.monitoring.enabled) return

    this.metricsInterval = setInterval(() => {
      const metrics = this.monitor.getMetrics()
      this.checkAlerts(metrics)
      this.emit('metrics:collected', metrics)
    }, this.config.monitoring.metricsInterval)
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    const { alertThresholds } = this.config.monitoring

    if (metrics.responseTime.avg > alertThresholds.responseTime) {
      this.emit('alert:response-time', {
        type: 'response-time',
        value: metrics.responseTime.avg,
        threshold: alertThresholds.responseTime,
        severity: 'warning',
      })
    }

    if (metrics.resource.memory.used > alertThresholds.memoryUsage) {
      this.emit('alert:memory', {
        type: 'memory',
        value: metrics.resource.memory.used,
        threshold: alertThresholds.memoryUsage,
        severity: 'critical',
      })
    }

    if (metrics.resource.cpu.usage > alertThresholds.cpuUsage) {
      this.emit('alert:cpu', {
        type: 'cpu',
        value: metrics.resource.cpu.usage,
        threshold: alertThresholds.cpuUsage,
        severity: 'warning',
      })
    }
  }

  // Start performance measurement
  startMeasurement(name: string, metadata?: Record<string, any>): string {
    return this.monitor.startMeasurement(name, metadata)
  }

  // End performance measurement
  endMeasurement(id: string): PerformanceMeasurement | null {
    return this.monitor.endMeasurement(id)
  }

  // Measure function execution
  async measureFunction<T>(name: string, fn: () => Promise<T> | T, metadata?: Record<string, any>): Promise<T> {
    const id = this.startMeasurement(name, metadata)
    
    try {
      const result = await fn()
      this.endMeasurement(id)
      return result
    } catch (error) {
      this.endMeasurement(id)
      throw error
    }
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return this.monitor.getMetrics()
  }

  // Get measurements
  getMeasurements(name?: string): PerformanceMeasurement[] {
    return this.monitor.getMeasurements(name)
  }

  // Analyze performance
  analyzePerformance(): PerformanceProfile {
    return this.analyzer.analyzePerformance()
  }

  // Optimize image
  async optimizeImage(buffer: Buffer, options?: ImageOptimizationOptions): Promise<Buffer> {
    return this.optimizer.optimizeImage(buffer, options)
  }

  // Generate preload hints
  generatePreloadHints(resources: PreloadResource[]): string[] {
    return this.optimizer.generatePreloadHints(resources)
  }

  // Optimize bundle
  async optimizeBundle(code: string, options?: BundleOptimizationOptions): Promise<string> {
    return this.optimizer.optimizeBundle(code, options)
  }

  // Enable clustering
  enableClustering(): void {
    if (!this.config.cpu.clustering.enabled) return

    const numWorkers = this.config.cpu.clustering.workers || os.cpus().length

    if (cluster.isPrimary) {
      logger.info(`Starting ${numWorkers} workers`)

      for (let i = 0; i < numWorkers; i++) {
        cluster.fork()
      }

      cluster.on('exit', (worker, code, signal) => {
        logger.warn(`Worker ${worker.process.pid} died`, { code, signal })
        cluster.fork()
      })
    }
  }

  // Cleanup
  cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    this.monitor.cleanup()
  }
}

// Performance middleware for Express
export function performanceMiddleware(manager: PerformanceManager) {
  return (req: any, res: any, next: any) => {
    const measurementId = manager.startMeasurement(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    })

    res.on('finish', () => {
      const measurement = manager.endMeasurement(measurementId)
      if (measurement) {
        measurement.metadata = {
          ...measurement.metadata,
          statusCode: res.statusCode,
          contentLength: res.get('Content-Length'),
        }
      }
    })

    next()
  }
}

// Default configuration
const defaultPerformanceConfig: PerformanceConfig = {
  monitoring: {
    enabled: process.env.PERFORMANCE_MONITORING !== 'false',
    metricsInterval: parseInt(process.env.PERFORMANCE_METRICS_INTERVAL || '30000'),
    alertThresholds: {
      responseTime: parseInt(process.env.PERFORMANCE_RESPONSE_TIME_THRESHOLD || '1000'),
      memoryUsage: parseInt(process.env.PERFORMANCE_MEMORY_THRESHOLD || '536870912'), // 512MB
      cpuUsage: parseFloat(process.env.PERFORMANCE_CPU_THRESHOLD || '0.8'),
      errorRate: parseFloat(process.env.PERFORMANCE_ERROR_RATE_THRESHOLD || '0.05'),
      throughput: parseInt(process.env.PERFORMANCE_THROUGHPUT_THRESHOLD || '100'),
    },
    sampling: {
      enabled: true,
      rate: 0.1,
      maxSamples: 10000,
    },
    profiling: {
      enabled: false,
      duration: 60000,
      interval: 300000,
      includeStackTrace: false,
    },
  },
  optimization: {
    lazyLoading: true,
    codesplitting: true,
    treeshaking: true,
    minification: process.env.NODE_ENV === 'production',
    imageOptimization: true,
    preloading: {
      enabled: true,
      strategies: ['dns-prefetch', 'preconnect', 'modulepreload'],
      resources: [],
    },
  },
  caching: {
    strategies: [
      {
        name: 'static-assets',
        type: 'browser',
        ttl: 31536000, // 1 year
        maxSize: 0,
        compression: true,
        patterns: ['*.js', '*.css', '*.png', '*.jpg', '*.svg'],
      },
      {
        name: 'api-responses',
        type: 'memory',
        ttl: 300, // 5 minutes
        maxSize: 100,
        compression: false,
        patterns: ['/api/*'],
      },
    ],
    levels: [
      { name: 'L1', priority: 1 },
      { name: 'L2', priority: 2, fallback: 'L1' },
    ],
    invalidation: {
      enabled: true,
      strategies: ['time-based', 'event-based'],
      tags: ['user', 'test', 'question'],
    },
  },
  compression: {
    enabled: true,
    algorithms: ['brotli', 'gzip'],
    level: 6,
    threshold: 1024,
    mimeTypes: ['text/html', 'text/css', 'text/javascript', 'application/json'],
  },
  bundling: {
    enabled: true,
    strategy: 'vite',
    splitting: {
      vendor: true,
      async: true,
      dynamic: true,
      chunks: [
        { name: 'vendor', test: 'node_modules', priority: 10 },
        { name: 'common', test: 'src/lib', priority: 5 },
      ],
    },
    optimization: {
      minimize: process.env.NODE_ENV === 'production',
      concatenate: true,
      dedupe: true,
      sideEffects: false,
    },
  },
  database: {
    indexing: {
      enabled: true,
      autoCreate: false,
      strategies: [
        { table: 'users', columns: ['email'], type: 'btree', unique: true },
        { table: 'tests', columns: ['createdAt'], type: 'btree', unique: false },
        { table: 'test_sessions', columns: ['userId', 'testId'], type: 'btree', unique: false },
      ],
    },
    querying: {
      enabled: true,
      explain: process.env.NODE_ENV === 'development',
      timeout: 30000,
      batchSize: 1000,
      pagination: {
        defaultLimit: 20,
        maxLimit: 100,
        cursorBased: true,
      },
    },
    connection: {
      pooling: {
        min: 2,
        max: 10,
        acquireTimeout: 30000,
        idleTimeout: 300000,
      },
      keepAlive: true,
      timeout: 30000,
    },
    caching: {
      enabled: true,
      queryCache: true,
      resultCache: true,
      ttl: 300,
    },
  },
  memory: {
    monitoring: true,
    gc: {
      enabled: true,
      strategy: 'balanced',
      interval: 60000,
    },
    limits: {
      heap: 1073741824, // 1GB
      rss: 2147483648, // 2GB
      external: 536870912, // 512MB
    },
    optimization: {
      objectPooling: false,
      stringInterning: false,
      bufferReuse: true,
    },
  },
  cpu: {
    monitoring: true,
    clustering: {
      enabled: process.env.NODE_ENV === 'production',
      workers: os.cpus().length,
      strategy: 'round-robin',
    },
    workers: {
      enabled: true,
      maxWorkers: os.cpus().length,
      taskQueue: {
        maxSize: 1000,
        timeout: 30000,
        priority: true,
      },
    },
    optimization: {
      scheduling: false,
      affinity: false,
      throttling: {
        enabled: true,
        threshold: 0.9,
        cooldown: 5000,
      },
    },
  },
}

// Export singleton instance
export const performanceManager = PerformanceManager.getInstance(defaultPerformanceConfig)

export default performanceManager
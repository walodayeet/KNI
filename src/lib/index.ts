/**
 * KNI Library - Comprehensive Utility Collection
 * 
 * This file serves as the main entry point for all utility libraries
 * and provides a centralized access point for the entire KNI system.
 */

// Core utilities
export {
  ConfigManager,
  configManager,
  config,
  Environments,
  ConfigUtils
} from './config'
export * from './logger'
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  handleError,
  asyncHandler,
  Logger,
  checkRateLimit
} from './errors'
export * from './validation'

// Database and data management
export * from './database'
export { prisma as dbPrisma, testDatabaseConnection, disconnectDatabase } from './db'
export * from './cache'
export * from './search'
export {
  BackupManager,
  backupManager,
  LocalStorageProvider,
  CompressionUtils,
  EncryptionUtils as BackupEncryptionUtils,
  backupConfig
} from './backup'
export type {
  BackupMetadata,
  BackupJob,
  RestoreJob,
  BackupType,
  BackupStatus,
  RestoreStatus
} from './backup'

// Authentication and security
export * from './auth'
export {
  securityHeaders,
  getClientIP,
  rateLimit,
  CSRFProtection,
  InputValidator,
  createSecurityMiddleware,
  EncryptionUtils as SecurityEncryptionUtils
} from './security'

// API and communication
export {
  createApiHandler,
  ApiUtils,
  handleCors,
  KniApiError,
  KniApiErrors
} from './api'
export type {
  ApiResponse,
  PaginatedResponse,
  RequestContext,
  ApiHandlerOptions
} from './api'
export * from './external-api'
export * from './webhooks'
export * from './realtime'

// File and content management
export * from './upload'
export * from './email'

// Workflow and automation
export * from './workflow'
export * from './queue'
// Notification services with explicit re-exports to avoid conflicts
export {
  NotificationService,
  notificationSchema,
  notificationTemplateSchema,
  notificationService
} from './notification'

export {
  NotificationType,
  NotificationChannel as NotificationsChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationManager,
  NotificationService as NotificationsService,
  notificationManager
} from './notifications'

export type {
  NotificationTemplate as NotificationsTemplate,
  NotificationData,
  NotificationPreferences as NotificationsPreferences,
  QueuedNotification
} from './notifications'

// Monitoring and analytics
export type {
  HealthCheck,
  SystemMetrics,
  ApplicationMetrics,
  PerformanceMetric,
  Alert
} from './monitoring'
export {
  HealthStatus,
  MetricType,
  AlertSeverity,
  RequestTracker as MonitoringPerformanceMonitor,
  MonitoringManager,
  monitoringManager,
  MetricsCollector,
  AlertManager,
  HealthChecks
} from './monitoring'
export * from './analytics'
export * from './performance'
export * from './reporting'

// Development and deployment
export * from './testing'
export * from './deployment'
export * from './feature-flags'

// Internationalization
export * from './i18n'

// Re-export commonly used types and interfaces
export type {
  // Config types
  ConfigSource,
  ConfigEnvironment,
  ConfigSchema,
  ConfigValidation,
  ConfigWatcher,
  ConfigAudit,
  ConfigMetrics
} from './config'

export type {
  // Logger types
  LogLevel,
  LogEntry,
  LoggerConfig,
} from './logger'

export type {
  // Database types
  DatabaseMetrics,
  QueryResult,
  TransactionOptions,
} from './database'

// API types are already exported above in the main export block

export type {
  // Auth types
  ExtendedUser,
  ExtendedSession,
  ExtendedJWT
} from './auth'

export type {
  // Workflow types
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
  WorkflowTrigger,
} from './workflow'

export type {
  // Notification types
  Notification,
  NotificationTemplate,
  NotificationChannel,
  NotificationPreferences,
} from './notification'

export type {
  // Upload types
  UploadConfig,
  FileMetadata,
  UploadResult,
  UploadOptions,
} from './upload'

// Utility classes and services (singleton instances)
import { db as DatabaseService } from './database'
import { CacheService } from './cache'
import { UploadService as FileUploadService } from './upload'
import { NotificationService } from './notification'
import { WorkflowEngine } from './workflow'
import { AnalyticsService } from './analytics'
import { monitoringManager as MonitoringService } from './monitoring'
import { searchEngine as SearchService } from './search'
import { QueueManager } from './queue'
import { EmailService } from './email'
import { webhookManager as WebhookService } from './webhooks'
import { realtimeManager as RealtimeService } from './realtime'
import { backupManager as BackupService } from './backup'
import { deploymentManager as DeploymentService } from './deployment'
import { featureFlagManager as FeatureFlagService } from './feature-flags'
import { TestSuite as TestingService } from './testing'
import { reportingEngine as ReportingService } from "./reporting"
import { performanceManager as PerformanceMonitor } from './performance'
import { i18n as I18nService } from './i18n'

// Create and export service instances
export const services = {
  // Core services
  database: DatabaseService,
  cache: CacheService,
  
  // File and content services
  upload: FileUploadService,
  email: EmailService,
  
  // Workflow and automation services
  notifications: NotificationService.getInstance(),
  workflows: WorkflowEngine.getInstance(),
  queue: QueueManager.getInstance(),
  
  // Communication services
  webhooks: WebhookService,
  realtime: RealtimeService,
  
  // Search and analytics services
  search: SearchService,
  analytics: AnalyticsService,
  
  // Monitoring and performance services
  monitoring: MonitoringService,
  performance: PerformanceMonitor,
  
  // Development and deployment services
  testing: TestingService,
  deployment: DeploymentService,
  backup: BackupService,
  
  // Feature management
  featureFlags: FeatureFlagService,
  
  // Internationalization
  i18n: I18nService,
  
  // Reporting
  reporting: ReportingService,
}

// Utility functions collection
export const utils = {
  // String utilities
  string: {
    slugify: (text: string): string => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    },
    
    truncate: (text: string, length: number, suffix = '...'): string => {
      if (text.length <= length) {
        return text
      }
      return text.substring(0, length - suffix.length) + suffix
    },
    
    capitalize: (text: string): string => {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    },
    
    camelCase: (text: string): string => {
      return text
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase()
        })
        .replace(/\s+/g, '')
    },
    
    kebabCase: (text: string): string => {
      return text
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase()
    },
    
    generateId: (length = 8): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      let result = ''
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    },
  },
  
  // Date utilities
  date: {
    formatDate: (date: Date, format = 'YYYY-MM-DD'): string => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      
      return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
    },
    
    addDays: (date: Date, days: number): Date => {
      const result = new Date(date)
      result.setDate(result.getDate() + days)
      return result
    },
    
    addHours: (date: Date, hours: number): Date => {
      const result = new Date(date)
      result.setHours(result.getHours() + hours)
      return result
    },
    
    isToday: (date: Date): boolean => {
      const today = new Date()
      return date.toDateString() === today.toDateString()
    },
    
    isYesterday: (date: Date): boolean => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return date.toDateString() === yesterday.toDateString()
    },
    
    getRelativeTime: (date: Date): string => {
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffSecs = Math.floor(diffMs / 1000)
      const diffMins = Math.floor(diffSecs / 60)
      const diffHours = Math.floor(diffMins / 60)
      const diffDays = Math.floor(diffHours / 24)
      
      if (diffSecs < 60) {
        return 'just now'
      }
      if (diffMins < 60) {
        return `${diffMins}m ago`
      }
      if (diffHours < 24) {
        return `${diffHours}h ago`
      }
      if (diffDays < 7) {
        return `${diffDays}d ago`
      }
      return date.toLocaleDateString()
    },
  },
  
  // Array utilities
  array: {
    chunk: <T>(array: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
      }
      return chunks
    },
    
    unique: <T>(array: T[]): T[] => {
      return [...new Set(array)]
    },
    
    groupBy: <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
      return array.reduce((groups, item) => {
        const group = String(item[key])
        groups[group] = groups[group] || []
        groups[group].push(item)
        return groups
      }, {} as Record<string, T[]>)
    },
    
    shuffle: <T>(array: T[]): T[] => {
      const shuffled = [...array]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffled[i]!
        shuffled[i] = shuffled[j]!
        shuffled[j] = temp
      }
      return shuffled
    },
    
    sample: <T>(array: T[], count = 1): T[] => {
      const shuffled = utils.array.shuffle(array)
      return shuffled.slice(0, count)
    },
  },
  
  // Object utilities
  object: {
    pick: <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
      const result = {} as Pick<T, K>
      keys.forEach(key => {
        if (key in obj) {
          result[key] = obj[key]
        }
      })
      return result
    },
    
    omit: <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
      const result = { ...obj }
      keys.forEach(key => {
        delete result[key]
      })
      return result
    },
    
    deepMerge: <T>(target: T, source: Partial<T>): T => {
      const result = { ...target }
      
      Object.keys(source).forEach(key => {
        const sourceValue = (source as any)[key]
        const targetValue = (result as any)[key]
        
        if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          (result as any)[key] = utils.object.deepMerge(targetValue || {}, sourceValue)
        } else {
          (result as any)[key] = sourceValue
        }
      })
      
      return result
    },
    
    isEmpty: (obj: any): boolean => {
      if (obj === null || obj === undefined) {return true}
      if (Array.isArray(obj) || typeof obj === 'string') {return obj.length === 0}
      return Object.keys(obj).length === 0
    },
    
    flatten: (obj: Record<string, any>, prefix = ''): Record<string, any> => {
      const flattened: Record<string, any> = {}
      
      Object.keys(obj).forEach(key => {
        const value = obj[key]
        const newKey = prefix ? `${prefix}.${key}` : key
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(flattened, utils.object.flatten(value, newKey))
        } else {
          flattened[newKey] = value
        }
      })
      
      return flattened
    },
  },
  
  // Number utilities
  number: {
    formatCurrency: (amount: number, currency = 'USD'): string => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount)
    },
    
    formatPercent: (value: number, decimals = 2): string => {
      return `${(value * 100).toFixed(decimals)}%`
    },
    
    clamp: (value: number, min: number, max: number): number => {
      return Math.min(Math.max(value, min), max)
    },
    
    random: (min: number, max: number): number => {
      return Math.floor(Math.random() * (max - min + 1)) + min
    },
    
    round: (value: number, decimals = 2): number => {
      return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
    },
  },
  
  // Validation utilities
  validation: {
    isEmail: (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    },
    
    isUrl: (url: string): boolean => {
      try {
        new URL(url)
        return true
      } catch {
        return false
      }
    },
    
    isUuid: (uuid: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(uuid)
    },
    
    isPhoneNumber: (phone: string): boolean => {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
      return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
    },
    
    isStrongPassword: (password: string): boolean => {
      // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
      return strongPasswordRegex.test(password)
    },
  },
  
  // File utilities
  file: {
    getExtension: (filename: string): string => {
      return filename.split('.').pop()?.toLowerCase() || ''
    },
    
    getMimeType: (filename: string): string => {
      const ext = utils.file.getExtension(filename)
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
      return mimeTypes[ext] || 'application/octet-stream'
    },
    
    formatSize: (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let size = bytes
      let unitIndex = 0
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`
    },
    
    isImage: (filename: string): boolean => {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
      return imageExtensions.includes(utils.file.getExtension(filename))
    },
    
    isDocument: (filename: string): boolean => {
      const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf']
      return documentExtensions.includes(utils.file.getExtension(filename))
    },
  },
  
  // Async utilities
  async: {
    delay: (ms: number): Promise<void> => {
      return new Promise(resolve => setTimeout(resolve, ms))
    },
    
    timeout: <T>(promise: Promise<T>, ms: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), ms)
        )
      ])
    },
    
    retry: async <T>(
      fn: () => Promise<T>,
      maxAttempts = 3,
      delay = 1000
    ): Promise<T> => {
      let lastError: Error | undefined
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn()
        } catch (error) {
          lastError = error as Error
          
          if (attempt === maxAttempts) {
            break
          }
          
          await utils.async.delay(delay * attempt)
        }
      }
      
      throw lastError || new Error('Retry failed')
    },
    
    parallel: async <T>(promises: Promise<T>[], concurrency = 5): Promise<T[]> => {
      const results: T[] = []
      
      for (let i = 0; i < promises.length; i += concurrency) {
        const batch = promises.slice(i, i + concurrency)
        const batchResults = await Promise.all(batch)
        results.push(...batchResults)
      }
      
      return results
    },
  },
}

// Health check function for all services
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: Record<string, { status: string; latency?: number; error?: string }>
  timestamp: string
}> => {
  const results: Record<string, { status: string; latency?: number; error?: string }> = {}
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  let healthyCount = 0
  let totalCount = 0
  
  // Check database
  try {
    const dbHealth = await services.database.healthCheck()
    results.database = {
      status: dbHealth.status,
      latency: dbHealth.latency,
    }
    if (dbHealth.status === 'healthy') {healthyCount++}
    totalCount++
  } catch (error) {
    results.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    totalCount++
  }
  
  // Check cache
  try {
    const start = performance.now()
    await services.cache.get('health-check')
    const latency = performance.now() - start
    results.cache = {
      status: 'healthy',
      latency: Math.round(latency),
    }
    healthyCount++
    totalCount++
  } catch (error) {
    results.cache = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    totalCount++
  }
  
  // Add more service health checks as needed
  
  // Determine overall status
  const healthyRatio = healthyCount / totalCount
  if (healthyRatio === 1) {
    overallStatus = 'healthy'
  } else if (healthyRatio >= 0.5) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'unhealthy'
  }
  
  return {
    status: overallStatus,
    services: results,
    timestamp: new Date().toISOString(),
  }
}

// Initialize all services
export const initializeServices = async (): Promise<void> => {
  try {
    // Initialize core services first
    // Database connection is established when DatabaseManager instance is created
    
    // Initialize other services
    // Most services are initialized on first use, but some may need explicit initialization
    
    // All services initialized successfully
  } catch (error) {
    // Failed to initialize services
    throw error
  }
}

// Graceful shutdown
export const shutdownServices = async (): Promise<void> => {
  try {
    // Shutdown services in reverse order
    await services.database.disconnect()
    
    // All services shut down gracefully
  } catch (error) {
    // Error during service shutdown
    throw error
  }
}

// Default export
const libExports = {
  services,
  utils,
  healthCheck,
  initializeServices,
  shutdownServices,
}

export default libExports
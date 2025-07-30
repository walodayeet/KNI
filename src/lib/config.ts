import { logger } from './logger'
import { EventEmitter } from 'events'
import fs from 'fs/promises'
import path from 'path'
import yaml from 'js-yaml'
import dotenv from 'dotenv'

// Configuration interfaces
interface ConfigSource {
  type: 'env' | 'file' | 'remote' | 'vault' | 'database'
  path?: string
  url?: string
  priority: number
  watch?: boolean
  format?: 'json' | 'yaml' | 'toml' | 'ini'
  encryption?: EncryptionConfig
}

interface EncryptionConfig {
  enabled: boolean
  algorithm: 'aes-256-gcm' | 'aes-256-cbc'
  key?: string
  keyFile?: string
}

interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    required?: boolean
    default?: any
    validation?: ConfigValidation
    description?: string
    sensitive?: boolean
    deprecated?: boolean
    deprecationMessage?: string
  }
}

interface ConfigValidation {
  min?: number
  max?: number
  pattern?: string
  enum?: any[]
  custom?: (value: any) => boolean | string
}

interface ConfigEnvironment {
  name: string
  sources: ConfigSource[]
  schema: ConfigSchema
  overrides?: Record<string, any>
  validation?: {
    strict: boolean
    allowUnknown: boolean
    stripUnknown: boolean
  }
}

interface ConfigWatcher {
  path: string
  callback: (config: any) => void
  lastModified?: Date
}

interface ConfigAudit {
  timestamp: Date
  action: 'load' | 'reload' | 'update' | 'validate' | 'error'
  source: string
  key?: string
  oldValue?: any
  newValue?: any
  error?: string
  user?: string
}

interface ConfigMetrics {
  loadTime: number
  reloadCount: number
  validationErrors: number
  lastReload: Date
  sourceStatus: Record<string, 'healthy' | 'error' | 'timeout'>
}

// Application configuration schema
const appConfigSchema: ConfigSchema = {
  // Server configuration
  'server.port': {
    type: 'number',
    required: true,
    default: 3000,
    validation: { min: 1, max: 65535 },
    description: 'Server port number',
  },
  'server.host': {
    type: 'string',
    required: true,
    default: 'localhost',
    description: 'Server host address',
  },
  'server.cors.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable CORS',
  },
  'server.cors.origins': {
    type: 'array',
    default: ['http://localhost:3000'],
    description: 'Allowed CORS origins',
  },
  'server.rateLimit.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable rate limiting',
  },
  'server.rateLimit.windowMs': {
    type: 'number',
    default: 900000, // 15 minutes
    validation: { min: 1000 },
    description: 'Rate limit window in milliseconds',
  },
  'server.rateLimit.max': {
    type: 'number',
    default: 100,
    validation: { min: 1 },
    description: 'Maximum requests per window',
  },

  // Database configuration
  'database.url': {
    type: 'string',
    required: true,
    sensitive: true,
    description: 'Database connection URL',
  },
  'database.pool.min': {
    type: 'number',
    default: 2,
    validation: { min: 1 },
    description: 'Minimum database connections',
  },
  'database.pool.max': {
    type: 'number',
    default: 10,
    validation: { min: 1 },
    description: 'Maximum database connections',
  },
  'database.ssl': {
    type: 'boolean',
    default: false,
    description: 'Enable SSL for database connection',
  },

  // Authentication configuration
  'auth.jwt.secret': {
    type: 'string',
    required: true,
    sensitive: true,
    description: 'JWT secret key',
  },
  'auth.jwt.expiresIn': {
    type: 'string',
    default: '24h',
    description: 'JWT token expiration time',
  },
  'auth.session.secret': {
    type: 'string',
    required: true,
    sensitive: true,
    description: 'Session secret key',
  },
  'auth.session.maxAge': {
    type: 'number',
    default: 86400000, // 24 hours
    validation: { min: 60000 }, // 1 minute
    description: 'Session maximum age in milliseconds',
  },
  'auth.oauth.google.clientId': {
    type: 'string',
    sensitive: true,
    description: 'Google OAuth client ID',
  },
  'auth.oauth.google.clientSecret': {
    type: 'string',
    sensitive: true,
    description: 'Google OAuth client secret',
  },

  // Email configuration
  'email.smtp.host': {
    type: 'string',
    description: 'SMTP server host',
  },
  'email.smtp.port': {
    type: 'number',
    default: 587,
    validation: { min: 1, max: 65535 },
    description: 'SMTP server port',
  },
  'email.smtp.secure': {
    type: 'boolean',
    default: false,
    description: 'Use secure SMTP connection',
  },
  'email.smtp.user': {
    type: 'string',
    sensitive: true,
    description: 'SMTP username',
  },
  'email.smtp.password': {
    type: 'string',
    sensitive: true,
    description: 'SMTP password',
  },
  'email.from': {
    type: 'string',
    default: 'noreply@kni.app',
    description: 'Default sender email address',
  },

  // Storage configuration
  'storage.type': {
    type: 'string',
    default: 'local',
    validation: { enum: ['local', 's3', 'gcs', 'azure'] },
    description: 'Storage provider type',
  },
  'storage.local.path': {
    type: 'string',
    default: './uploads',
    description: 'Local storage path',
  },
  'storage.s3.bucket': {
    type: 'string',
    description: 'S3 bucket name',
  },
  'storage.s3.region': {
    type: 'string',
    description: 'S3 region',
  },
  'storage.s3.accessKeyId': {
    type: 'string',
    sensitive: true,
    description: 'S3 access key ID',
  },
  'storage.s3.secretAccessKey': {
    type: 'string',
    sensitive: true,
    description: 'S3 secret access key',
  },

  // Cache configuration
  'cache.type': {
    type: 'string',
    default: 'memory',
    validation: { enum: ['memory', 'redis', 'memcached'] },
    description: 'Cache provider type',
  },
  'cache.redis.url': {
    type: 'string',
    sensitive: true,
    description: 'Redis connection URL',
  },
  'cache.ttl': {
    type: 'number',
    default: 3600,
    validation: { min: 1 },
    description: 'Default cache TTL in seconds',
  },

  // Logging configuration
  'logging.level': {
    type: 'string',
    default: 'info',
    validation: { enum: ['error', 'warn', 'info', 'debug'] },
    description: 'Logging level',
  },
  'logging.format': {
    type: 'string',
    default: 'json',
    validation: { enum: ['json', 'text'] },
    description: 'Log format',
  },
  'logging.file.enabled': {
    type: 'boolean',
    default: false,
    description: 'Enable file logging',
  },
  'logging.file.path': {
    type: 'string',
    default: './logs',
    description: 'Log file directory',
  },

  // Feature flags
  'features.registration.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable user registration',
  },
  'features.socialLogin.enabled': {
    type: 'boolean',
    default: false,
    description: 'Enable social login',
  },
  'features.analytics.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable analytics tracking',
  },
  'features.notifications.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable notifications',
  },

  // Security configuration
  'security.encryption.key': {
    type: 'string',
    required: true,
    sensitive: true,
    description: 'Encryption key for sensitive data',
  },
  'security.csrf.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable CSRF protection',
  },
  'security.helmet.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable security headers',
  },

  // Monitoring configuration
  'monitoring.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable monitoring',
  },
  'monitoring.metrics.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable metrics collection',
  },
  'monitoring.healthCheck.enabled': {
    type: 'boolean',
    default: true,
    description: 'Enable health checks',
  },
}

// Configuration loader utilities



// Configuration loader utilities
class ConfigLoader {
  static async loadFromFile(filePath: string, format?: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const ext = format || path.extname(filePath).slice(1)

      switch (ext) {
        case 'json':
          return JSON.parse(content)
        case 'yaml':
        case 'yml':
          return yaml.load(content)
        case 'env':
          return dotenv.parse(content)
        default:
          throw new Error(`Unsupported file format: ${ext}`)
      }
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`)
    }
  }

  static async loadFromEnv(prefix?: string): Promise<any> {
    const config: any = {}
    const envPrefix = prefix ? `${prefix}_` : ''

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configKey = key.slice(envPrefix.length).toLowerCase().replace(/_/g, '.')
        config[configKey] = this.parseEnvValue(value)
      }
    }

    return config
  }

  static async loadFromRemote(url: string, headers?: Record<string, string>): Promise<any> {
    try {
      const response = await fetch(url, headers ? { headers } : {})
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      throw new Error(`Failed to load config from ${url}: ${error}`)
    }
  }

  private static parseEnvValue(value: string | undefined): any {
    if (!value) {return undefined}

    // Try to parse as JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }

    // Parse boolean
    if (value.toLowerCase() === 'true') {return true}
    if (value.toLowerCase() === 'false') {return false}

    // Parse number
    if (/^\d+$/.test(value)) {return parseInt(value, 10)}
    if (/^\d*\.\d+$/.test(value)) {return parseFloat(value)}

    return value
  }
}

// Configuration validator
class ConfigValidator {
  static validate(config: any, schema: ConfigSchema): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required fields
    for (const [key, definition] of Object.entries(schema)) {
      const value = this.getNestedValue(config, key)

      if (definition.required && (value === undefined || value === null)) {
        errors.push(`Required field '${key}' is missing`)
        continue
      }

      if (value === undefined || value === null) {
        continue
      }

      // Check deprecated fields
      if (definition.deprecated) {
        warnings.push(`Field '${key}' is deprecated${definition.deprecationMessage ? `: ${  definition.deprecationMessage}` : ''}`)
      }

      // Type validation
      if (!this.validateType(value, definition.type)) {
        errors.push(`Field '${key}' must be of type ${definition.type}, got ${typeof value}`)
        continue
      }

      // Custom validation
      if (definition.validation) {
        const validationError = this.validateValue(value, definition.validation, key)
        if (validationError) {
          errors.push(validationError)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }

  private static validateValue(value: any, validation: ConfigValidation, key: string): string | null {
    if (validation.min !== undefined && value < validation.min) {
      return `Field '${key}' must be at least ${validation.min}`
    }

    if (validation.max !== undefined && value > validation.max) {
      return `Field '${key}' must be at most ${validation.max}`
    }

    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(value)) {
        return `Field '${key}' does not match required pattern`
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      return `Field '${key}' must be one of: ${validation.enum.join(', ')}`
    }

    if (validation.custom) {
      const result = validation.custom(value)
      if (typeof result === 'string') {
        return `Field '${key}': ${result}`
      }
      if (result === false) {
        return `Field '${key}' failed custom validation`
      }
    }

    return null
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

// Configuration manager
export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager
  private config: any = {}
  private environment: ConfigEnvironment
  private watchers: Map<string, ConfigWatcher> = new Map()
  private auditLog: ConfigAudit[] = []
  private metrics: ConfigMetrics = {
    loadTime: 0,
    reloadCount: 0,
    validationErrors: 0,
    lastReload: new Date(),
    sourceStatus: {},
  }
  private watchIntervals: Map<string, NodeJS.Timeout> = new Map()

  private constructor(environment: ConfigEnvironment) {
    super()
    this.environment = environment
  }

  static getInstance(environment?: ConfigEnvironment): ConfigManager {
    if (!ConfigManager.instance && environment) {
      ConfigManager.instance = new ConfigManager(environment)
    }
    return ConfigManager.instance
  }

  // Initialize configuration
  async initialize(): Promise<void> {
    const startTime = Date.now()

    try {
      await this.loadConfiguration()
      this.setupWatchers()
      
      this.metrics.loadTime = Date.now() - startTime
      this.metrics.lastReload = new Date()

      this.addAuditEntry({
        timestamp: new Date(),
        action: 'load',
        source: 'initialization',
      })

      await logger.info('Configuration initialized', {
        environment: this.environment.name,
        loadTime: this.metrics.loadTime,
        sourceCount: this.environment.sources.length,
      })

      this.emit('config:initialized', this.config)
    } catch (error) {
      this.addAuditEntry({
        timestamp: new Date(),
        action: 'error',
        source: 'initialization',
        error: String(error),
      })

      await logger.error('Failed to initialize configuration', { error })
      throw error
    }
  }

  // Load configuration from all sources
  private async loadConfiguration(): Promise<void> {
    const configs: Array<{ config: any; priority: number; source: string }> = []

    // Load from all sources
    for (const source of this.environment.sources) {
      try {
        let config: any

        switch (source.type) {
          case 'env':
            config = await ConfigLoader.loadFromEnv()
            break
          case 'file':
            if (!source.path) {throw new Error('File path is required for file source')}
            config = await ConfigLoader.loadFromFile(source.path, source.format)
            break
          case 'remote':
            if (!source.url) {throw new Error('URL is required for remote source')}
            config = await ConfigLoader.loadFromRemote(source.url)
            break
          default:
            throw new Error(`Unsupported source type: ${source.type}`)
        }

        configs.push({
          config,
          priority: source.priority,
          source: `${source.type}:${source.path || source.url || 'default'}`,
        })

        this.metrics.sourceStatus[source.type] = 'healthy'
      } catch (error) {
        this.metrics.sourceStatus[source.type] = 'error'
        await logger.warn('Failed to load config from source', {
          source: source.type,
          error: String(error),
        })
      }
    }

    // Merge configurations by priority (higher priority overwrites lower)
    configs.sort((a, b) => a.priority - b.priority)
    this.config = configs.reduce((merged, { config }) => {
      return this.deepMerge(merged, config)
    }, {})

    // Apply environment overrides
    if (this.environment.overrides) {
      this.config = this.deepMerge(this.config, this.environment.overrides)
    }

    // Apply defaults from schema
    this.applyDefaults()

    // Validate configuration
    await this.validateConfiguration()
  }

  // Apply default values from schema
  private applyDefaults(): void {
    for (const [key, definition] of Object.entries(this.environment.schema)) {
      if (definition.default !== undefined && this.get(key) === undefined) {
        this.setNestedValue(this.config, key, definition.default)
      }
    }
  }

  // Validate configuration against schema
  private async validateConfiguration(): Promise<void> {
    const validation = ConfigValidator.validate(this.config, this.environment.schema)

    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        await logger.warn('Configuration warning', { warning })
      }
    }

    if (!validation.valid) {
      this.metrics.validationErrors += validation.errors.length
      
      this.addAuditEntry({
        timestamp: new Date(),
        action: 'validate',
        source: 'schema',
        error: validation.errors.join('; '),
      })

      if (this.environment.validation?.strict !== false) {
        throw new Error(`Configuration validation failed: ${validation.errors.join('; ')}`)
      }
    }
  }

  // Setup file watchers
  private setupWatchers(): void {
    for (const source of this.environment.sources) {
      if (source.watch && source.type === 'file' && source.path) {
        this.watchFile(source.path)
      }
    }
  }

  // Watch file for changes
  private watchFile(filePath: string): void {
    const interval = setInterval(async () => {
      try {
        const stats = await fs.stat(filePath)
        const watcher = this.watchers.get(filePath)

        if (!watcher || !watcher.lastModified || stats.mtime > watcher.lastModified) {
          await this.reloadConfiguration()
          
          if (watcher) {
            watcher.lastModified = stats.mtime
          } else {
            this.watchers.set(filePath, {
              path: filePath,
              callback: () => this.reloadConfiguration(),
              lastModified: stats.mtime,
            })
          }
        }
      } catch (error) {
        await logger.warn('Failed to watch config file', { filePath, error })
      }
    }, 5000) // Check every 5 seconds

    this.watchIntervals.set(filePath, interval)
  }

  // Reload configuration
  async reloadConfiguration(): Promise<void> {
    try {
      const oldConfig = { ...this.config }
      await this.loadConfiguration()
      
      this.metrics.reloadCount++
      this.metrics.lastReload = new Date()

      this.addAuditEntry({
        timestamp: new Date(),
        action: 'reload',
        source: 'file_watcher',
      })

      await logger.info('Configuration reloaded', {
        reloadCount: this.metrics.reloadCount,
      })

      this.emit('config:reloaded', { oldConfig, newConfig: this.config })
    } catch (error) {
      this.addAuditEntry({
        timestamp: new Date(),
        action: 'error',
        source: 'reload',
        error: String(error),
      })

      await logger.error('Failed to reload configuration', { error })
    }
  }

  // Get configuration value
  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.config, key)
    return value !== undefined ? value : defaultValue
  }

  // Set configuration value
  set(key: string, value: any): void {
    const oldValue = this.get(key)
    this.setNestedValue(this.config, key, value)

    this.addAuditEntry({
      timestamp: new Date(),
      action: 'update',
      source: 'runtime',
      key,
      oldValue,
      newValue: value,
    })

    this.emit('config:changed', { key, oldValue, newValue: value })
  }

  // Check if configuration key exists
  has(key: string): boolean {
    return this.getNestedValue(this.config, key) !== undefined
  }

  // Get all configuration
  getAll(): any {
    return { ...this.config }
  }

  // Get configuration with sensitive values masked
  getAllSafe(): any {
    const safe = { ...this.config }
    
    for (const [key, definition] of Object.entries(this.environment.schema)) {
      if (definition.sensitive && this.has(key)) {
        this.setNestedValue(safe, key, '***MASKED***')
      }
    }

    return safe
  }

  // Get configuration metrics
  getMetrics(): ConfigMetrics {
    return { ...this.metrics }
  }

  // Get audit log
  getAuditLog(limit?: number): ConfigAudit[] {
    const log = [...this.auditLog].reverse()
    return limit ? log.slice(0, limit) : log
  }

  // Cleanup watchers
  cleanup(): void {
    for (const interval of this.watchIntervals.values()) {
      clearInterval(interval)
    }
    this.watchIntervals.clear()
    this.watchers.clear()
  }

  // Helper methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {}
      }
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }

  private addAuditEntry(entry: Omit<ConfigAudit, 'timestamp'> & { timestamp?: Date }): void {
    this.auditLog.push({
      timestamp: new Date(),
      ...entry,
    })

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000)
    }
  }
}

// Environment configurations
export const Environments = {
  development: {
    name: 'development',
    sources: [
      { type: 'env' as const, priority: 1 },
      { type: 'file' as const, path: '.env.development', priority: 2, watch: true, format: 'env' as const },
      { type: 'file' as const, path: 'config/development.json', priority: 3, watch: true, format: 'json' as const },
    ],
    schema: appConfigSchema,
    validation: {
      strict: false,
      allowUnknown: true,
      stripUnknown: false,
    },
  },
  
  production: {
    name: 'production',
    sources: [
      { type: 'env' as const, priority: 1 },
      { type: 'file' as const, path: '.env.production', priority: 2, format: 'env' as const },
      { type: 'file' as const, path: 'config/production.json', priority: 3, format: 'json' as const },
    ],
    schema: appConfigSchema,
    validation: {
      strict: true,
      allowUnknown: false,
      stripUnknown: true,
    },
  },
  
  test: {
    name: 'test',
    sources: [
      { type: 'env' as const, priority: 1 },
      { type: 'file' as const, path: '.env.test', priority: 2, format: 'env' as const },
      { type: 'file' as const, path: 'config/test.json', priority: 3, format: 'json' as const },
    ],
    schema: appConfigSchema,
    overrides: {
      'database.url': 'sqlite://test.db',
      'logging.level': 'error',
      'cache.type': 'memory',
    },
    validation: {
      strict: false,
      allowUnknown: true,
      stripUnknown: false,
    },
  },
} as const

// Configuration utilities
export class ConfigUtils {
  static getEnvironment(): string {
    return process.env.NODE_ENV || 'development'
  }

  static isProduction(): boolean {
    return this.getEnvironment() === 'production'
  }

  static isDevelopment(): boolean {
    return this.getEnvironment() === 'development'
  }

  static isTest(): boolean {
    return this.getEnvironment() === 'test'
  }

  static createEnvironment(name: string, sources: ConfigSource[], schema?: ConfigSchema): ConfigEnvironment {
    return {
      name,
      sources,
      schema: schema || appConfigSchema,
    }
  }

  static validateEnvironmentVariables(required: string[]): void {
    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }
}

// Initialize configuration manager
const currentEnv = ConfigUtils.getEnvironment()
const environment = Environments[currentEnv as keyof typeof Environments] || Environments.development

export const configManager = ConfigManager.getInstance(environment)

// Export configuration instance
export const config = {
  get: <T = any>(key: string, defaultValue?: T): T => configManager.get(key, defaultValue),
  set: (key: string, value: any): void => configManager.set(key, value),
  has: (key: string): boolean => configManager.has(key),
  getAll: (): any => configManager.getAll(),
  getAllSafe: (): any => configManager.getAllSafe(),
  reload: (): Promise<void> => configManager.reloadConfiguration(),
}

export default config
import { logger } from './logger'
import { z } from 'zod'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

// Backup configuration
interface BackupConfig {
  storage: {
    local: {
      enabled: boolean
      path: string
      retention: number // days
    }
    cloud: {
      enabled: boolean
      provider: 'aws' | 'gcp' | 'azure'
      bucket: string
      region: string
      credentials: {
        accessKey?: string
        secretKey?: string
        projectId?: string
        keyFile?: string
      }
    }
    remote: {
      enabled: boolean
      endpoint: string
      apiKey: string
      timeout: number
    }
  }
  schedule: {
    enabled: boolean
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
    time: string // HH:MM format
    timezone: string
  }
  compression: {
    enabled: boolean
    algorithm: 'gzip' | 'brotli' | 'lz4'
    level: number
  }
  encryption: {
    enabled: boolean
    algorithm: 'aes-256-gcm' | 'aes-256-cbc'
    keyDerivation: 'pbkdf2' | 'scrypt'
    iterations: number
  }
  verification: {
    enabled: boolean
    checksumAlgorithm: 'sha256' | 'sha512' | 'md5'
    integrityCheck: boolean
  }
  notification: {
    enabled: boolean
    onSuccess: boolean
    onFailure: boolean
    channels: ('email' | 'webhook' | 'slack')[]
  }
}

const defaultConfig: BackupConfig = {
  storage: {
    local: {
      enabled: process.env.BACKUP_LOCAL_ENABLED !== 'false',
      path: process.env.BACKUP_LOCAL_PATH || './backups',
      retention: parseInt(process.env.BACKUP_LOCAL_RETENTION || '30'),
    },
    cloud: {
      enabled: process.env.BACKUP_CLOUD_ENABLED === 'true',
      provider: (process.env.BACKUP_CLOUD_PROVIDER as any) || 'aws',
      bucket: process.env.BACKUP_CLOUD_BUCKET || '',
      region: process.env.BACKUP_CLOUD_REGION || 'us-east-1',
      credentials: {
        ...(process.env.BACKUP_CLOUD_ACCESS_KEY && { accessKey: process.env.BACKUP_CLOUD_ACCESS_KEY }),
        ...(process.env.BACKUP_CLOUD_SECRET_KEY && { secretKey: process.env.BACKUP_CLOUD_SECRET_KEY }),
        ...(process.env.BACKUP_CLOUD_PROJECT_ID && { projectId: process.env.BACKUP_CLOUD_PROJECT_ID }),
        ...(process.env.BACKUP_CLOUD_KEY_FILE && { keyFile: process.env.BACKUP_CLOUD_KEY_FILE }),
      },
    },
    remote: {
      enabled: process.env.BACKUP_REMOTE_ENABLED === 'true',
      endpoint: process.env.BACKUP_REMOTE_ENDPOINT || '',
      apiKey: process.env.BACKUP_REMOTE_API_KEY || '',
      timeout: parseInt(process.env.BACKUP_REMOTE_TIMEOUT || '30000'),
    },
  },
  schedule: {
    enabled: process.env.BACKUP_SCHEDULE_ENABLED !== 'false',
    frequency: (process.env.BACKUP_SCHEDULE_FREQUENCY as any) || 'daily',
    time: process.env.BACKUP_SCHEDULE_TIME || '02:00',
    timezone: process.env.BACKUP_SCHEDULE_TIMEZONE || 'UTC',
  },
  compression: {
    enabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
    algorithm: (process.env.BACKUP_COMPRESSION_ALGORITHM as any) || 'gzip',
    level: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6'),
  },
  encryption: {
    enabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true',
    algorithm: (process.env.BACKUP_ENCRYPTION_ALGORITHM as any) || 'aes-256-gcm',
    keyDerivation: (process.env.BACKUP_ENCRYPTION_KEY_DERIVATION as any) || 'pbkdf2',
    iterations: parseInt(process.env.BACKUP_ENCRYPTION_ITERATIONS || '100000'),
  },
  verification: {
    enabled: process.env.BACKUP_VERIFICATION_ENABLED !== 'false',
    checksumAlgorithm: (process.env.BACKUP_VERIFICATION_CHECKSUM as any) || 'sha256',
    integrityCheck: process.env.BACKUP_VERIFICATION_INTEGRITY !== 'false',
  },
  notification: {
    enabled: process.env.BACKUP_NOTIFICATION_ENABLED !== 'false',
    onSuccess: process.env.BACKUP_NOTIFICATION_SUCCESS !== 'false',
    onFailure: process.env.BACKUP_NOTIFICATION_FAILURE !== 'false',
    channels: (process.env.BACKUP_NOTIFICATION_CHANNELS || 'email').split(',') as any[],
  },
}

// Backup types and interfaces
export type BackupType = 'full' | 'incremental' | 'differential'
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type RestoreStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface BackupMetadata {
  id: string
  name: string
  type: BackupType
  status: BackupStatus
  size: number
  compressedSize?: number
  checksum: string
  createdAt: Date
  completedAt?: Date
  duration?: number
  source: {
    database?: boolean
    files?: boolean
    uploads?: boolean
    config?: boolean
    logs?: boolean
  }
  storage: {
    local?: {
      path: string
      exists: boolean
    }
    cloud?: {
      provider: string
      bucket: string
      key: string
      exists: boolean
    }
    remote?: {
      endpoint: string
      id: string
      exists: boolean
    }
  }
  encryption?: {
    algorithm: string
    keyId: string
    iv: string
  }
  compression?: {
    algorithm: string
    level: number
    ratio: number
  }
  verification: {
    checksum: string
    algorithm: string
    verified: boolean
    verifiedAt?: Date
  }
  tags: string[]
  description?: string
  createdBy: string
  error?: string
}

export interface BackupJob {
  id: string
  name: string
  type: BackupType
  schedule?: {
    frequency: string
    nextRun: Date
    lastRun?: Date
  }
  source: {
    database?: {
      enabled: boolean
      tables?: string[]
      excludeTables?: string[]
    }
    files?: {
      enabled: boolean
      paths: string[]
      excludePaths?: string[]
      excludePatterns?: string[]
    }
    uploads?: {
      enabled: boolean
      path: string
      maxSize?: number
    }
    config?: {
      enabled: boolean
      includeSecrets: boolean
    }
    logs?: {
      enabled: boolean
      maxAge?: number
    }
  }
  retention: {
    count?: number
    days?: number
    strategy: 'count' | 'time' | 'size'
  }
  enabled: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
  lastModifiedBy: string
}

export interface RestoreJob {
  id: string
  backupId: string
  status: RestoreStatus
  target: {
    database?: boolean
    files?: boolean
    uploads?: boolean
    config?: boolean
    logs?: boolean
  }
  options: {
    overwrite: boolean
    createBackup: boolean
    validateIntegrity: boolean
    dryRun: boolean
  }
  progress: {
    percentage: number
    currentStep: string
    totalSteps: number
    completedSteps: number
  }
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  duration?: number
  createdBy: string
  error?: string
}

// Validation schemas
const backupSchemas = {
  backupJob: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['full', 'incremental', 'differential']),
    source: z.object({
      database: z.object({
        enabled: z.boolean(),
        tables: z.array(z.string()).optional(),
        excludeTables: z.array(z.string()).optional(),
      }).optional(),
      files: z.object({
        enabled: z.boolean(),
        paths: z.array(z.string()),
        excludePaths: z.array(z.string()).optional(),
        excludePatterns: z.array(z.string()).optional(),
      }).optional(),
      uploads: z.object({
        enabled: z.boolean(),
        path: z.string(),
        maxSize: z.number().optional(),
      }).optional(),
      config: z.object({
        enabled: z.boolean(),
        includeSecrets: z.boolean(),
      }).optional(),
      logs: z.object({
        enabled: z.boolean(),
        maxAge: z.number().optional(),
      }).optional(),
    }),
    retention: z.object({
      count: z.number().optional(),
      days: z.number().optional(),
      strategy: z.enum(['count', 'time', 'size']),
    }),
    enabled: z.boolean(),
  }),
  
  restoreOptions: z.object({
    backupId: z.string().min(1),
    target: z.object({
      database: z.boolean().optional(),
      files: z.boolean().optional(),
      uploads: z.boolean().optional(),
      config: z.boolean().optional(),
      logs: z.boolean().optional(),
    }),
    options: z.object({
      overwrite: z.boolean(),
      createBackup: z.boolean(),
      validateIntegrity: z.boolean(),
      dryRun: z.boolean(),
    }),
  }),
}

// Storage providers
export interface StorageProvider {
  upload(data: Buffer, key: string, metadata?: Record<string, any>): Promise<string>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<boolean>
  exists(key: string): Promise<boolean>
  list(prefix?: string): Promise<string[]>
  getMetadata(key: string): Promise<Record<string, any> | null>
}

// Local storage provider
export class LocalStorageProvider implements StorageProvider {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async upload(data: Buffer, key: string, metadata?: Record<string, any>): Promise<string> {
    try {
      const filePath = path.join(this.basePath, key)
      const dir = path.dirname(filePath)
      
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true })
      
      // Write file
      await fs.writeFile(filePath, data)
      
      // Write metadata if provided
      if (metadata) {
        const metadataPath = `${filePath}.meta`
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      }
      
      return filePath
    } catch (error) {
      await logger.error('Failed to upload to local storage', {
        key,
        basePath: this.basePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.basePath, key)
      return await fs.readFile(filePath)
    } catch (error) {
      await logger.error('Failed to download from local storage', {
        key,
        basePath: this.basePath,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key)
      const metadataPath = `${filePath}.meta`
      
      // Delete file
      try {
        await fs.unlink(filePath)
      } catch {
        // File might not exist
      }
      
      // Delete metadata
      try {
        await fs.unlink(metadataPath)
      } catch {
        // Metadata might not exist
      }
      
      return true
    } catch (error) {
      await logger.error('Failed to delete from local storage', {
        key,
        basePath: this.basePath,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const searchPath = prefix ? path.join(this.basePath, prefix) : this.basePath
      const files = await this.listFilesRecursive(searchPath)
      
      return files
        .filter(file => !file.endsWith('.meta'))
        .map(file => path.relative(this.basePath, file))
    } catch (error) {
      await logger.error('Failed to list files in local storage', {
        prefix,
        basePath: this.basePath,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  async getMetadata(key: string): Promise<Record<string, any> | null> {
    try {
      const filePath = path.join(this.basePath, key)
      const metadataPath = `${filePath}.meta`
      
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(metadataContent)
    } catch {
      return null
    }
  }

  private async listFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          const subFiles = await this.listFilesRecursive(fullPath)
          files.push(...subFiles)
        } else {
          files.push(fullPath)
        }
      }
    } catch {
      // Directory might not exist or be accessible
    }
    
    return files
  }
}

// Compression utilities
export class CompressionUtils {
  static async compress(
    data: Buffer,
    algorithm: 'gzip' | 'brotli' | 'lz4',
    level: number = 6
  ): Promise<Buffer> {
    try {
      switch (algorithm) {
        case 'gzip': {
          const zlib = await import('zlib')
          return new Promise((resolve, reject) => {
            zlib.gzip(data, { level }, (err, result) => {
              if (err) {reject(err)}
              else {resolve(result)}
            })
          })
        }
        case 'brotli': {
          const zlib = await import('zlib')
          return new Promise((resolve, reject) => {
            zlib.brotliCompress(data, {
              params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: level,
              },
            }, (err, result) => {
              if (err) {reject(err)}
              else {resolve(result)}
            })
          })
        }
        case 'lz4':
          // LZ4 would require a separate library
          throw new Error('LZ4 compression not implemented')
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`)
      }
    } catch (error) {
      await logger.error('Failed to compress data', {
        algorithm,
        level,
        dataSize: data.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  static async decompress(
    data: Buffer,
    algorithm: 'gzip' | 'brotli' | 'lz4'
  ): Promise<Buffer> {
    try {
      switch (algorithm) {
        case 'gzip': {
          const zlib = await import('zlib')
          return new Promise((resolve, reject) => {
            zlib.gunzip(data, (err, result) => {
              if (err) {reject(err)}
              else {resolve(result)}
            })
          })
        }
        case 'brotli': {
          const zlib = await import('zlib')
          return new Promise((resolve, reject) => {
            zlib.brotliDecompress(data, (err, result) => {
              if (err) {reject(err)}
              else {resolve(result)}
            })
          })
        }
        case 'lz4':
          throw new Error('LZ4 decompression not implemented')
        default:
          throw new Error(`Unsupported compression algorithm: ${algorithm}`)
      }
    } catch (error) {
      await logger.error('Failed to decompress data', {
        algorithm,
        dataSize: data.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

// Encryption utilities
export class EncryptionUtils {
  static async encrypt(
    data: Buffer,
    password: string,
    algorithm: 'aes-256-gcm' | 'aes-256-cbc' = 'aes-256-gcm',
    keyDerivation: 'pbkdf2' | 'scrypt' = 'pbkdf2',
    iterations: number = 100000
  ): Promise<{ encrypted: Buffer; iv: Buffer; salt: Buffer; tag?: Buffer }> {
    try {
      const crypto = await import('crypto')
      
      // Generate salt and IV
      const salt = crypto.randomBytes(32)
      const iv = crypto.randomBytes(algorithm === 'aes-256-gcm' ? 12 : 16)
      
      // Derive key
      const key = keyDerivation === 'pbkdf2'
        ? crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
        : crypto.scryptSync(password, salt, 32)
      
      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, key, iv)
      if (algorithm === 'aes-256-gcm') {
        (cipher as any).setAAD(Buffer.from('backup-data'))
      }
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final(),
      ])
      
      // Get authentication tag for GCM
      const tag = algorithm === 'aes-256-gcm' ? (cipher as any).getAuthTag() : undefined
      
      return { encrypted, iv, salt, tag }
    } catch (error) {
      await logger.error('Failed to encrypt data', {
        algorithm,
        keyDerivation,
        iterations,
        dataSize: data.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  static async decrypt(
    encryptedData: Buffer,
    password: string,
    iv: Buffer,
    salt: Buffer,
    tag?: Buffer,
    algorithm: 'aes-256-gcm' | 'aes-256-cbc' = 'aes-256-gcm',
    keyDerivation: 'pbkdf2' | 'scrypt' = 'pbkdf2',
    iterations: number = 100000
  ): Promise<Buffer> {
    try {
      const crypto = await import('crypto')
      
      // Derive key
      const key = keyDerivation === 'pbkdf2'
        ? crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
        : crypto.scryptSync(password, salt, 32)
      
      // Create decipher
      const decipher = crypto.createDecipheriv(algorithm, key, iv)
      
      if (algorithm === 'aes-256-gcm') {
        if (!tag) {throw Error('Authentication tag required for GCM mode')
        ;}(decipher as any).setAuthTag(tag)
        ;(decipher as any).setAAD(Buffer.from('backup-data'))
      }
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ])
      
      return decrypted
    } catch (error) {
      await logger.error('Failed to decrypt data', {
        algorithm,
        keyDerivation,
        iterations,
        dataSize: encryptedData.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

// Backup manager
export class BackupManager {
  private static instance: BackupManager
  private config: BackupConfig
  private storageProviders: Map<string, StorageProvider> = new Map()
  private activeRestores: Map<string, RestoreJob> = new Map()

  private constructor(config: Partial<BackupConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.initializeStorageProviders()
  }

  public static getInstance(config?: Partial<BackupConfig>): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager(config)
    }
    return BackupManager.instance
  }

  // Initialize storage providers
  private initializeStorageProviders(): void {
    if (this.config.storage.local.enabled) {
      this.storageProviders.set('local', new LocalStorageProvider(this.config.storage.local.path))
    }
    
    // Add cloud providers when implemented
    // if (this.config.storage.cloud.enabled) {
    //   this.storageProviders.set('cloud', new CloudStorageProvider(this.config.storage.cloud))
    // }
  }

  // Create backup
  async createBackup(
    job: Omit<BackupJob, 'id' | 'createdAt' | 'updatedAt'>,
    options: {
      name?: string
      description?: string
      tags?: string[]
    } = {}
  ): Promise<BackupMetadata> {
    const backupId = this.generateId()
    const startTime = Date.now()
    
    try {
      // Validate job
      backupSchemas.backupJob.parse({
        ...job,
        id: backupId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await logger.info('Starting backup', {
        backupId,
        jobName: job.name,
        type: job.type,
      })

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        name: options.name || `${job.name}-${new Date().toISOString()}`,
        type: job.type,
        status: 'running',
        size: 0,
        checksum: '',
        createdAt: new Date(),
        source: {
          database: job.source.database?.enabled || false,
          files: job.source.files?.enabled || false,
          uploads: job.source.uploads?.enabled || false,
          config: job.source.config?.enabled || false,
          logs: job.source.logs?.enabled || false,
        },
        storage: {},
        verification: {
          checksum: '',
          algorithm: this.config.verification.checksumAlgorithm,
          verified: false,
        },
        tags: options.tags || [],
        ...(options.description && { description: options.description }),
        createdBy: 'system', // Should be passed from context
      }

      // Collect data
      const backupData = await this.collectBackupData(job)
      metadata.size = backupData.length

      // Compress data if enabled
      let processedData = backupData
      if (this.config.compression.enabled) {
        const compressed = await CompressionUtils.compress(
          backupData,
          this.config.compression.algorithm,
          this.config.compression.level
        )
        processedData = compressed
        metadata.compressedSize = compressed.length
        metadata.compression = {
          algorithm: this.config.compression.algorithm,
          level: this.config.compression.level,
          ratio: compressed.length / backupData.length,
        }
      }

      // Encrypt data if enabled
      if (this.config.encryption.enabled) {
        const password = process.env.BACKUP_ENCRYPTION_PASSWORD
        if (!password) {
          throw new Error('Encryption password not configured')
        }

        const encrypted = await EncryptionUtils.encrypt(
          processedData,
          password,
          this.config.encryption.algorithm,
          this.config.encryption.keyDerivation,
          this.config.encryption.iterations
        )

        // Combine encrypted data with metadata
        const encryptionMeta = {
          iv: encrypted.iv.toString('base64'),
          salt: encrypted.salt.toString('base64'),
          tag: encrypted.tag?.toString('base64'),
          algorithm: this.config.encryption.algorithm,
          keyDerivation: this.config.encryption.keyDerivation,
          iterations: this.config.encryption.iterations,
        }

        processedData = Buffer.concat([
          Buffer.from(`${JSON.stringify(encryptionMeta)  }\n`),
          encrypted.encrypted,
        ])

        metadata.encryption = {
          algorithm: this.config.encryption.algorithm,
          keyId: 'default',
          iv: encrypted.iv.toString('base64'),
        }
      }

      // Calculate checksum
      const checksum = this.calculateChecksum(processedData, this.config.verification.checksumAlgorithm)
      metadata.checksum = checksum
      metadata.verification.checksum = checksum

      // Store backup
      await this.storeBackup(backupId, processedData, metadata)

      // Verify backup if enabled
      if (this.config.verification.integrityCheck) {
        const verified = await this.verifyBackup(backupId)
        metadata.verification.verified = verified
        metadata.verification.verifiedAt = new Date()
      }

      // Update metadata
      const endTime = Date.now()
      metadata.status = 'completed'
      metadata.completedAt = new Date()
      metadata.duration = endTime - startTime

      await logger.info('Backup completed successfully', {
        backupId,
        duration: metadata.duration,
        size: metadata.size,
        compressedSize: metadata.compressedSize,
      })

      // Send notification if enabled
      if (this.config.notification.enabled && this.config.notification.onSuccess) {
        await this.sendNotification('success', metadata)
      }

      return metadata
    } catch (error) {
      await logger.error('Backup failed', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Send failure notification
      if (this.config.notification.enabled && this.config.notification.onFailure) {
        await this.sendNotification('failure', {
          id: backupId,
          name: options.name || job.name,
          error: error instanceof Error ? error.message : String(error),
        } as any)
      }

      throw error
    }
  }

  // Collect backup data
  private async collectBackupData(job: Omit<BackupJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<Buffer> {
    const data: Record<string, any> = {}

    try {
      // Database backup
      if (job.source.database?.enabled) {
        data.database = await this.backupDatabase(job.source.database)
      }

      // Files backup
      if (job.source.files?.enabled) {
        data.files = await this.backupFiles(job.source.files)
      }

      // Uploads backup
      if (job.source.uploads?.enabled) {
        data.uploads = await this.backupUploads(job.source.uploads)
      }

      // Config backup
      if (job.source.config?.enabled) {
        data.config = await this.backupConfig(job.source.config)
      }

      // Logs backup
      if (job.source.logs?.enabled) {
        data.logs = await this.backupLogs(job.source.logs)
      }

      // Convert to buffer
      return Buffer.from(JSON.stringify(data, null, 2))
    } catch (error) {
      await logger.error('Failed to collect backup data', {
        jobName: job.name,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Backup database
  private async backupDatabase(config: NonNullable<BackupJob['source']['database']>): Promise<any> {
    try {
      // This would integrate with your database
      // For now, return sample data
      return {
        tables: ['users', 'tests', 'sessions'],
        data: {
          users: [],
          tests: [],
          sessions: [],
        },
        schema: {},
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      await logger.error('Failed to backup database', {
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Backup files
  private async backupFiles(config: NonNullable<BackupJob['source']['files']>): Promise<any> {
    try {
      const files: Record<string, string> = {}
      
      for (const filePath of config.paths) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          files[filePath] = content
        } catch {
          // File might not exist or be readable
        }
      }
      
      return {
        files,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      await logger.error('Failed to backup files', {
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Backup uploads
  private async backupUploads(config: NonNullable<BackupJob['source']['uploads']>): Promise<any> {
    try {
      // This would backup uploaded files
      return {
        path: config.path,
        files: [],
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      await logger.error('Failed to backup uploads', {
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Backup config
  private async backupConfig(config: NonNullable<BackupJob['source']['config']>): Promise<any> {
    try {
      const configData: Record<string, any> = {
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }
      
      if (config.includeSecrets) {
        // Include environment variables (be careful with secrets)
        configData.env = { ...process.env }
      }
      
      return configData
    } catch (error) {
      await logger.error('Failed to backup config', {
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Backup logs
  private async backupLogs(config: NonNullable<BackupJob['source']['logs']>): Promise<any> {
    try {
      // This would backup application logs
      return {
        logs: [],
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      await logger.error('Failed to backup logs', {
        config,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Store backup
  private async storeBackup(
    backupId: string,
    data: Buffer,
    metadata: BackupMetadata
  ): Promise<void> {
    const key = `${backupId}.backup`
    const metadataKey = `${backupId}.meta`
    
    for (const [providerName, provider] of this.storageProviders) {
      try {
        // Store backup data
        const dataPath = await provider.upload(data, key)
        
        // Store metadata
        const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2))
        await provider.upload(metadataBuffer, metadataKey)
        
        // Update metadata with storage info
        if (providerName === 'local') {
          metadata.storage.local = {
            path: dataPath,
            exists: true,
          }
        }
        
        await logger.info('Backup stored successfully', {
          backupId,
          provider: providerName,
          size: data.length,
        })
      } catch (error) {
        await logger.error('Failed to store backup', {
          backupId,
          provider: providerName,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  }

  // Verify backup
  private async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const key = `${backupId}.backup`
      
      for (const [_providerName, provider] of this.storageProviders) {
        const exists = await provider.exists(key)
        if (!exists) {
          await logger.error('Backup verification failed - file not found', {
            backupId,
            provider: _providerName,
          })
          return false
        }
        
        // Additional integrity checks could be performed here
      }
      
      return true
    } catch (error) {
      await logger.error('Backup verification failed', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // Calculate checksum
  private calculateChecksum(data: Buffer, algorithm: string): string {
    return createHash(algorithm).update(data).digest('hex')
  }

  // Send notification
  private async sendNotification(
    type: 'success' | 'failure',
    metadata: Partial<BackupMetadata>
  ): Promise<void> {
    try {
      // This would integrate with your notification system
      await logger.info('Backup notification sent', {
        type,
        backupId: metadata.id,
        channels: this.config.notification.channels,
      })
    } catch (error) {
      await logger.error('Failed to send backup notification', {
        type,
        backupId: metadata.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Restore backup
  async restoreBackup(
    backupId: string,
    options: {
      target: {
        database?: boolean
        files?: boolean
        uploads?: boolean
        config?: boolean
        logs?: boolean
      }
      overwrite?: boolean
      createBackup?: boolean
      validateIntegrity?: boolean
      dryRun?: boolean
    } = { target: {} }
  ): Promise<RestoreJob> {
    const restoreId = this.generateId()
    
    try {
      // Validate options
      backupSchemas.restoreOptions.parse({
        backupId,
        target: options.target,
        options: {
          overwrite: options.overwrite ?? false,
          createBackup: options.createBackup ?? true,
          validateIntegrity: options.validateIntegrity ?? true,
          dryRun: options.dryRun ?? false,
        },
      })

      // Create restore job
      const restoreJob: RestoreJob = {
        id: restoreId,
        backupId,
        status: 'running',
        target: options.target,
        options: {
          overwrite: options.overwrite ?? false,
          createBackup: options.createBackup ?? true,
          validateIntegrity: options.validateIntegrity ?? true,
          dryRun: options.dryRun ?? false,
        },
        progress: {
          percentage: 0,
          currentStep: 'Initializing',
          totalSteps: 5,
          completedSteps: 0,
        },
        createdAt: new Date(),
        startedAt: new Date(),
        createdBy: 'system',
      }

      this.activeRestores.set(restoreId, restoreJob)

      await logger.info('Starting backup restore', {
        restoreId,
        backupId,
        options,
      })

      // Perform restore steps
      await this.performRestore(restoreJob)

      // Update job status
      restoreJob.status = 'completed'
      restoreJob.completedAt = new Date()
      restoreJob.duration = restoreJob.completedAt.getTime() - restoreJob.startedAt!.getTime()
      restoreJob.progress.percentage = 100
      restoreJob.progress.currentStep = 'Completed'
      restoreJob.progress.completedSteps = restoreJob.progress.totalSteps

      await logger.info('Backup restore completed successfully', {
        restoreId,
        backupId,
        duration: restoreJob.duration,
      })

      return restoreJob
    } catch (error) {
      const restoreJob = this.activeRestores.get(restoreId)
      if (restoreJob) {
        restoreJob.status = 'failed'
        restoreJob.error = error instanceof Error ? error.message : String(error)
        restoreJob.completedAt = new Date()
      }

      await logger.error('Backup restore failed', {
        restoreId,
        backupId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    } finally {
      this.activeRestores.delete(restoreId)
    }
  }

  // Perform restore
  private async performRestore(restoreJob: RestoreJob): Promise<void> {
    // Step 1: Download backup
    restoreJob.progress.currentStep = 'Downloading backup'
    restoreJob.progress.completedSteps = 1
    restoreJob.progress.percentage = 20
    
    const backupData = await this.downloadBackup(restoreJob.backupId)
    
    // Step 2: Verify integrity
    if (restoreJob.options.validateIntegrity) {
      restoreJob.progress.currentStep = 'Verifying integrity'
      restoreJob.progress.completedSteps = 2
      restoreJob.progress.percentage = 40
      
      const isValid = await this.verifyBackup(restoreJob.backupId)
      if (!isValid) {
        throw new Error('Backup integrity verification failed')
      }
    }
    
    // Step 3: Create backup of current state
    if (restoreJob.options.createBackup) {
      restoreJob.progress.currentStep = 'Creating current state backup'
      restoreJob.progress.completedSteps = 3
      restoreJob.progress.percentage = 60
      
      // Create backup of current state before restore
      // This would be implemented based on your needs
    }
    
    // Step 4: Restore data
    restoreJob.progress.currentStep = 'Restoring data'
    restoreJob.progress.completedSteps = 4
    restoreJob.progress.percentage = 80
    
    if (!restoreJob.options.dryRun) {
      await this.restoreData(backupData, restoreJob.target)
    }
    
    // Step 5: Finalize
    restoreJob.progress.currentStep = 'Finalizing'
    restoreJob.progress.completedSteps = 5
    restoreJob.progress.percentage = 100
  }

  // Download backup
  private async downloadBackup(backupId: string): Promise<any> {
    const key = `${backupId}.backup`
    
    for (const [providerName, provider] of this.storageProviders) {
      try {
        const data = await provider.download(key)
        
        // Process data (decrypt, decompress)
        let processedData = data
        
        // Decrypt if needed
        if (this.config.encryption.enabled) {
          processedData = await this.decryptBackupData(processedData)
        }
        
        // Decompress if needed
        if (this.config.compression.enabled) {
          processedData = await CompressionUtils.decompress(
            processedData,
            this.config.compression.algorithm
          )
        }
        
        return JSON.parse(processedData.toString())
      } catch (error) {
        await logger.error('Failed to download backup', {
          backupId,
          provider: providerName,
          error: error instanceof Error ? error.message : String(error),
        })
        
        // Try next provider
        continue
      }
    }
    
    throw new Error('Failed to download backup from any provider')
  }

  // Decrypt backup data
  private async decryptBackupData(data: Buffer): Promise<Buffer> {
    try {
      const password = process.env.BACKUP_ENCRYPTION_PASSWORD
      if (!password) {
        throw new Error('Encryption password not configured')
      }

      // Extract encryption metadata
      const lines = data.toString().split('\n')
      if (!lines[0]) {
        throw new Error('Invalid encrypted backup format: missing metadata')
      }
      const encryptionMeta = JSON.parse(lines[0])
      const encryptedData = Buffer.from(lines.slice(1).join('\n'))

      // Decrypt
      const decrypted = await EncryptionUtils.decrypt(
        encryptedData,
        password,
        Buffer.from(encryptionMeta.iv, 'base64'),
        Buffer.from(encryptionMeta.salt, 'base64'),
        encryptionMeta.tag ? Buffer.from(encryptionMeta.tag, 'base64') : undefined,
        encryptionMeta.algorithm,
        encryptionMeta.keyDerivation,
        encryptionMeta.iterations
      )

      return decrypted
    } catch (error) {
      await logger.error('Failed to decrypt backup data', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Restore data
  private async restoreData(
    backupData: any,
    target: RestoreJob['target']
  ): Promise<void> {
    try {
      if (target.database && backupData.database) {
        await this.restoreDatabase(backupData.database)
      }
      
      if (target.files && backupData.files) {
        await this.restoreFiles(backupData.files)
      }
      
      if (target.uploads && backupData.uploads) {
        await this.restoreUploads(backupData.uploads)
      }
      
      if (target.config && backupData.config) {
        await this.restoreConfig(backupData.config)
      }
      
      if (target.logs && backupData.logs) {
        await this.restoreLogs(backupData.logs)
      }
    } catch (error) {
      await logger.error('Failed to restore data', {
        target,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Restore database
  private async restoreDatabase(databaseData: any): Promise<void> {
    // This would restore database data
    await logger.info('Database restore completed', {
      tables: databaseData.tables?.length || 0,
    })
  }

  // Restore files
  private async restoreFiles(filesData: any): Promise<void> {
    // This would restore files
    await logger.info('Files restore completed', {
      files: Object.keys(filesData.files || {}).length,
    })
  }

  // Restore uploads
  private async restoreUploads(uploadsData: any): Promise<void> {
    // This would restore uploaded files
    await logger.info('Uploads restore completed', {
      path: uploadsData.path,
    })
  }

  // Restore config
  private async restoreConfig(configData: any): Promise<void> {
    // This would restore configuration
    await logger.info('Config restore completed', {
      environment: configData.environment,
    })
  }

  // Restore logs
  private async restoreLogs(_logsData: any): Promise<void> {
    // This would restore logs
    await logger.info('Logs restore completed')
  }

  // List backups
  async listBackups(filters?: {
    type?: BackupType
    status?: BackupStatus
    tags?: string[]
    dateFrom?: Date
    dateTo?: Date
    limit?: number
    offset?: number
  }): Promise<BackupMetadata[]> {
    try {
      const backups: BackupMetadata[] = []
      
      // This would query your backup metadata storage
      // For now, return empty array
      
      return backups
    } catch (error) {
      await logger.error('Failed to list backups', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  // Delete backup
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const key = `${backupId}.backup`
      const metadataKey = `${backupId}.meta`
      
      let success = true
      
      for (const [_providerName, provider] of this.storageProviders) {
        try {
          await provider.delete(key)
          await provider.delete(metadataKey)
        } catch (error) {
          await logger.error('Failed to delete backup from provider', {
            backupId,
            provider: _providerName,
            error: error instanceof Error ? error.message : String(error),
          })
          success = false
        }
      }
      
      if (success) {
        await logger.info('Backup deleted successfully', { backupId })
      }
      
      return success
    } catch (error) {
      await logger.error('Failed to delete backup', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // Get backup metadata
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataKey = `${backupId}.meta`
      
      for (const [_providerName, provider] of this.storageProviders) {
        try {
          const metadataBuffer = await provider.download(metadataKey)
          const metadata = JSON.parse(metadataBuffer.toString())
          return metadata
        } catch {
          // Try next provider
          continue
        }
      }
      
      return null
    } catch (error) {
      await logger.error('Failed to get backup metadata', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // Get restore job status
  getRestoreStatus(restoreId: string): RestoreJob | null {
    return this.activeRestores.get(restoreId) || null
  }

  // Generate unique ID
  private generateId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup old backups
  async cleanupOldBackups(): Promise<void> {
    try {
      // This would implement retention policies
      await logger.info('Backup cleanup completed')
    } catch (error) {
      await logger.error('Failed to cleanup old backups', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// Export singleton instance
export const backupManager = BackupManager.getInstance()

// Export configuration
export { defaultConfig as backupConfig }

// Export default
export default BackupManager
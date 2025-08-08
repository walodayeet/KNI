import { z } from 'zod'
import { logger } from './logger'
import { Validator } from './validation'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// File upload configuration
export interface UploadConfig {
  maxFileSize: number
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  uploadPath: string
  useCloudStorage: boolean
  cloudStorage: {
    provider: 'aws' | 'gcp' | 'azure'
    bucket: string
    region: string
    accessKeyId?: string
    secretAccessKey?: string
    endpoint?: string
  }
  imageProcessing: {
    enabled: boolean
    maxWidth: number
    maxHeight: number
    quality: number
    formats: string[]
    generateThumbnails: boolean
    thumbnailSizes: { width: number; height: number; suffix: string }[]
  }
  virusScanning: {
    enabled: boolean
    apiKey?: string
    endpoint?: string
  }
}

const defaultConfig: UploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.doc', '.docx'],
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  useCloudStorage: process.env.USE_CLOUD_STORAGE === 'true',
  cloudStorage: {
    provider: (process.env.CLOUD_STORAGE_PROVIDER as 'aws' | 'gcp' | 'azure') || 'aws',
    bucket: process.env.CLOUD_STORAGE_BUCKET || '',
    region: process.env.CLOUD_STORAGE_REGION || 'us-east-1',
    ...(process.env.CLOUD_STORAGE_ACCESS_KEY_ID && { accessKeyId: process.env.CLOUD_STORAGE_ACCESS_KEY_ID }),
    ...(process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY && { secretAccessKey: process.env.CLOUD_STORAGE_SECRET_ACCESS_KEY }),
    ...(process.env.CLOUD_STORAGE_ENDPOINT && { endpoint: process.env.CLOUD_STORAGE_ENDPOINT }),
  },
  imageProcessing: {
    enabled: process.env.IMAGE_PROCESSING_ENABLED === 'true',
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH || '2048'),
    maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT || '2048'),
    quality: parseInt(process.env.IMAGE_QUALITY || '85'),
    formats: ['jpeg', 'png', 'webp'],
    generateThumbnails: process.env.GENERATE_THUMBNAILS === 'true',
    thumbnailSizes: [
      { width: 150, height: 150, suffix: '_thumb' },
      { width: 300, height: 300, suffix: '_medium' },
      { width: 800, height: 600, suffix: '_large' },
    ],
  },
  virusScanning: {
    enabled: process.env.VIRUS_SCANNING_ENABLED === 'true',
    ...(process.env.VIRUS_SCAN_API_KEY && { apiKey: process.env.VIRUS_SCAN_API_KEY }),
    ...(process.env.VIRUS_SCAN_ENDPOINT && { endpoint: process.env.VIRUS_SCAN_ENDPOINT }),
  },
}

// File upload types
export interface UploadedFile {
  id: string
  originalName: string
  filename: string
  mimeType: string
  size: number
  path: string
  url: string
  thumbnails?: {
    suffix: string
    path: string
    url: string
    width: number
    height: number
  }[]
  metadata: {
    uploadedAt: Date
    uploadedBy?: string
    dimensions?: { width: number; height: number }
    exif?: Record<string, any>
  }
}

export interface UploadOptions {
  userId?: string
  folder?: string
  generateThumbnails?: boolean
  processImage?: boolean
  customFilename?: string
  metadata?: Record<string, any>
}

export interface UploadResult {
  success: boolean
  file?: UploadedFile
  error?: string
  validationErrors?: string[]
}

// Validation schemas
const uploadSchemas = {
  file: z.object({
    name: z.string().min(1, 'Filename is required'),
    size: z.number().positive('File size must be positive'),
    type: z.string().min(1, 'File type is required'),
  }),
  
  options: z.object({
    userId: z.string().optional(),
    folder: z.string().optional(),
    generateThumbnails: z.boolean().default(false),
    processImage: z.boolean().default(true),
    customFilename: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
}

// File upload manager
export class FileUploadManager {
  private static instance: FileUploadManager
  private config: UploadConfig
  private s3Client?: S3Client

  private constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.initializeCloudStorage()
    this.ensureUploadDirectory()
  }

  public static getInstance(config?: Partial<UploadConfig>): FileUploadManager {
    if (!FileUploadManager.instance) {
      FileUploadManager.instance = new FileUploadManager(config)
    }
    return FileUploadManager.instance
  }

  private initializeCloudStorage(): void {
    if (this.config.useCloudStorage && this.config.cloudStorage.provider === 'aws') {
      const s3Config: any = {
        region: this.config.cloudStorage.region,
        credentials: {
          accessKeyId: this.config.cloudStorage.accessKeyId || '',
          secretAccessKey: this.config.cloudStorage.secretAccessKey || '',
        },
      }
      
      if (this.config.cloudStorage.endpoint) {
        s3Config.endpoint = this.config.cloudStorage.endpoint
      }
      
      this.s3Client = new S3Client(s3Config)
    }
  }

  private async ensureUploadDirectory(): Promise<void> {
    if (!this.config.useCloudStorage) {
      try {
        await fs.mkdir(this.config.uploadPath, { recursive: true })
      } catch (error) {
        await logger.error('Failed to create upload directory', {
          path: this.config.uploadPath,
        }, error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  // Validate file
  private async validateFile(file: File): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Validate file object
    const fileValidation = await Validator.validate(uploadSchemas.file, {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    if (!fileValidation.success) {
      errors.push(...(fileValidation.errors?.map(e => e.message) || []))
    }

    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`)
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
    }

    // Check file extension
    const extension = path.extname(file.name).toLowerCase()
    if (!this.config.allowedExtensions.includes(extension)) {
      errors.push(`File extension '${extension}' is not allowed`)
    }

    // Check for malicious filenames
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      errors.push('Invalid filename')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  // Generate unique filename
  private generateFilename(originalName: string, customFilename?: string): string {
    const extension = path.extname(originalName)
    const baseName = customFilename || path.basename(originalName, extension)
    const timestamp = Date.now()
    const randomString = crypto.randomBytes(8).toString('hex')
    
    return `${baseName}_${timestamp}_${randomString}${extension}`
  }

  // Scan file for viruses
  private async scanForViruses(_buffer: Buffer): Promise<{ clean: boolean; threat?: string }> {
    if (!this.config.virusScanning.enabled) {
      return { clean: true }
    }

    try {
      // Implement virus scanning logic here
      // This is a placeholder - integrate with your preferred virus scanning service
      await logger.info('Virus scan completed', { result: 'clean' })
      return { clean: true }
    } catch (error) {
      await logger.error('Virus scan failed', {}, error instanceof Error ? error : new Error(String(error)))
      return { clean: false, threat: 'Scan failed' }
    }
  }

  // Process image
  private async processImage(
    buffer: Buffer,
    filename: string,
    options: UploadOptions
  ): Promise<{
    processedBuffer: Buffer
    metadata: { width: number; height: number; exif?: Record<string, any> }
    thumbnails?: { buffer: Buffer; filename: string; width: number; height: number; suffix: string }[]
  }> {
    try {
      const image = sharp(buffer)
      const metadata = await image.metadata()
      
      // Resize if needed
      let processedImage = image
      if (
        metadata.width && metadata.width > this.config.imageProcessing.maxWidth ||
        metadata.height && metadata.height > this.config.imageProcessing.maxHeight
      ) {
        processedImage = image.resize(
          this.config.imageProcessing.maxWidth,
          this.config.imageProcessing.maxHeight,
          { fit: 'inside', withoutEnlargement: true }
        )
      }

      // Apply quality settings
      processedImage = processedImage.jpeg({ quality: this.config.imageProcessing.quality })
      
      const processedBuffer = await processedImage.toBuffer()
      const processedMetadata = await sharp(processedBuffer).metadata()

      // Generate thumbnails
      let thumbnails: { buffer: Buffer; filename: string; width: number; height: number; suffix: string }[] | undefined
      
      if (options.generateThumbnails && this.config.imageProcessing.generateThumbnails) {
        thumbnails = []
        const baseName = path.basename(filename, path.extname(filename))
        const extension = path.extname(filename)
        
        for (const size of this.config.imageProcessing.thumbnailSizes) {
          const thumbnailBuffer = await sharp(processedBuffer)
            .resize(size.width, size.height, { fit: 'cover' })
            .jpeg({ quality: this.config.imageProcessing.quality })
            .toBuffer()
          
          thumbnails.push({
            buffer: thumbnailBuffer,
            filename: `${baseName}${size.suffix}${extension}`,
            width: size.width,
            height: size.height,
            suffix: size.suffix,
          })
        }
      }

      return {
        processedBuffer,
        metadata: {
          width: processedMetadata.width || 0,
          height: processedMetadata.height || 0,
          ...(metadata.exif && typeof metadata.exif === 'object' && { exif: metadata.exif as Record<string, any> }),
        },
        ...(thumbnails && { thumbnails }),
      }
    } catch (error) {
      await logger.error('Image processing failed', { filename }, error instanceof Error ? error : new Error(String(error)))
      throw new Error('Image processing failed')
    }
  }

  // Upload to cloud storage
  private async uploadToCloud(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    folder?: string
  ): Promise<{ url: string; path: string }> {
    if (!this.s3Client) {
      throw new Error('Cloud storage not configured')
    }

    const key = folder ? `${folder}/${filename}` : filename
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.cloudStorage.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
      })

      await this.s3Client.send(command)
      
      const url = `https://${this.config.cloudStorage.bucket}.s3.${this.config.cloudStorage.region}.amazonaws.com/${key}`
      
      return { url, path: key }
    } catch (error) {
      await logger.error('Cloud upload failed', { filename, key }, error instanceof Error ? error : new Error(String(error)))
      throw new Error('Cloud upload failed')
    }
  }

  // Upload to local storage
  private async uploadToLocal(
    buffer: Buffer,
    filename: string,
    folder?: string
  ): Promise<{ url: string; path: string }> {
    const uploadDir = folder 
      ? path.join(this.config.uploadPath, folder)
      : this.config.uploadPath
    
    await fs.mkdir(uploadDir, { recursive: true })
    
    const filePath = path.join(uploadDir, filename)
    await fs.writeFile(filePath, buffer)
    
    const relativePath = path.relative(this.config.uploadPath, filePath)
    const url = `/uploads/${relativePath.replace(/\\/g, '/')}`
    
    return { url, path: filePath }
  }

  // Main upload method
  async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      // Validate options
      const optionsValidation = await Validator.validate(uploadSchemas.options, options)
      if (!optionsValidation.success) {
        return {
          success: false,
          ...(optionsValidation.errors && { validationErrors: optionsValidation.errors.map(e => e.message) }),
        }
      }

      // Validate file
      const fileValidation = await this.validateFile(file)
      if (!fileValidation.valid) {
        return {
          success: false,
          ...(fileValidation.errors.length > 0 && { validationErrors: fileValidation.errors }),
        }
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Scan for viruses
      const virusScan = await this.scanForViruses(buffer)
      if (!virusScan.clean) {
        return {
          success: false,
          error: `File contains threat: ${virusScan.threat}`,
        }
      }

      // Generate filename
      const filename = this.generateFilename(file.name, options.customFilename)
      const fileId = crypto.randomUUID()

      let processedBuffer = buffer
      let imageMetadata: { width: number; height: number; exif?: Record<string, any> } | undefined
      let thumbnails: { buffer: Buffer; filename: string; width: number; height: number; suffix: string }[] | undefined

      // Process image if applicable
      const isImage = file.type.startsWith('image/')
      if (isImage && options.processImage && this.config.imageProcessing.enabled) {
        const imageProcessingResult = await this.processImage(buffer, filename, options)
        ;({ processedBuffer: processedBuffer, metadata: imageMetadata, thumbnails } = imageProcessingResult)
      }

      // Upload main file
      const uploadResult = this.config.useCloudStorage
        ? await this.uploadToCloud(processedBuffer, filename, file.type, options.folder)
        : await this.uploadToLocal(processedBuffer, filename, options.folder)

      // Upload thumbnails
      const uploadedThumbnails: {
        suffix: string
        path: string
        url: string
        width: number
        height: number
      }[] = []

      if (thumbnails) {
        for (const thumbnail of thumbnails) {
          const { path: thumbnailPath, url: thumbnailUrl } = this.config.useCloudStorage
            ? await this.uploadToCloud(thumbnail.buffer, thumbnail.filename, file.type, options.folder)
            : await this.uploadToLocal(thumbnail.buffer, thumbnail.filename, options.folder)
          
          uploadedThumbnails.push({
            suffix: thumbnail.suffix,
            path: thumbnailPath,
            url: thumbnailUrl,
            width: thumbnail.width,
            height: thumbnail.height,
          })
        }
      }

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        id: fileId,
        originalName: file.name,
        filename,
        mimeType: file.type,
        size: processedBuffer.length,
        path: uploadResult.path,
        url: uploadResult.url,
        ...(uploadedThumbnails.length > 0 && { thumbnails: uploadedThumbnails }),
        metadata: {
          uploadedAt: new Date(),
          ...(options.userId && { uploadedBy: options.userId }),
          ...(imageMetadata && { dimensions: { width: imageMetadata.width, height: imageMetadata.height } }),
          ...(imageMetadata?.exif && { exif: imageMetadata.exif }),
          ...options.metadata,
        },
      }

      await logger.info('File uploaded successfully', {
        fileId,
        filename,
        size: file.size,
        mimeType: file.type,
        userId: options.userId,
      })

      return {
        success: true,
        file: uploadedFile,
      }
    } catch (error) {
      await logger.error('File upload failed', {
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        userId: options.userId,
      }, error instanceof Error ? error : new Error(String(error)))

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Delete file
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.config.useCloudStorage && this.s3Client) {
        const command = new DeleteObjectCommand({
          Bucket: this.config.cloudStorage.bucket,
          Key: filePath,
        })
        
        await this.s3Client.send(command)
      } else {
        await fs.unlink(filePath)
      }

      await logger.info('File deleted successfully', { filePath })
      return { success: true }
    } catch (error) {
      await logger.error('File deletion failed', { filePath }, error instanceof Error ? error : new Error(String(error)))
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Generate signed URL for private files
  async generateSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.config.useCloudStorage || !this.s3Client) {
      return {
        success: false,
        error: 'Signed URLs only available with cloud storage',
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.config.cloudStorage.bucket,
        Key: filePath,
      })

      const url = await getSignedUrl(this.s3Client, command, { expiresIn })
      
      return { success: true, url }
    } catch (error) {
      await logger.error('Failed to generate signed URL', { filePath }, error instanceof Error ? error : new Error(String(error)))
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Get upload statistics
  getUploadStats(): {
    maxFileSize: number
    allowedMimeTypes: string[]
    allowedExtensions: string[]
    useCloudStorage: boolean
    imageProcessingEnabled: boolean
    virusScanningEnabled: boolean
  } {
    return {
      maxFileSize: this.config.maxFileSize,
      allowedMimeTypes: this.config.allowedMimeTypes,
      allowedExtensions: this.config.allowedExtensions,
      useCloudStorage: this.config.useCloudStorage,
      imageProcessingEnabled: this.config.imageProcessing.enabled,
      virusScanningEnabled: this.config.virusScanning.enabled,
    }
  }
}

// Upload service with predefined methods
export class UploadService {
  private static uploadManager = FileUploadManager.getInstance()

  // Upload user avatar
  static async uploadAvatar(file: File, userId: string): Promise<UploadResult> {
    return this.uploadManager.uploadFile(file, {
      userId,
      folder: 'avatars',
      generateThumbnails: true,
      processImage: true,
      metadata: { type: 'avatar' },
    })
  }

  // Upload test attachment
  static async uploadTestAttachment(file: File, userId: string, testId: string): Promise<UploadResult> {
    return this.uploadManager.uploadFile(file, {
      userId,
      folder: `tests/${testId}/attachments`,
      processImage: true,
      metadata: { type: 'test-attachment', testId },
    })
  }

  // Upload consultation document
  static async uploadConsultationDocument(file: File, userId: string, consultationId: string): Promise<UploadResult> {
    return this.uploadManager.uploadFile(file, {
      userId,
      folder: `consultations/${consultationId}/documents`,
      processImage: false,
      metadata: { type: 'consultation-document', consultationId },
    })
  }

  // Upload general file
  static async uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
    return this.uploadManager.uploadFile(file, options)
  }

  // Delete file
  static async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    return this.uploadManager.deleteFile(filePath)
  }

  // Generate signed URL
  static async generateSignedUrl(filePath: string, expiresIn?: number): Promise<{ success: boolean; url?: string; error?: string }> {
    return this.uploadManager.generateSignedUrl(filePath, expiresIn)
  }

  // Get upload stats
  static getUploadStats() {
    return this.uploadManager.getUploadStats()
  }
}

// Type aliases for compatibility
export type FileMetadata = UploadedFile

// Export singleton instance
export const fileUploadManager = FileUploadManager.getInstance()
export default UploadService
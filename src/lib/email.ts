import nodemailer from 'nodemailer'
import { logger } from './logger'
import { Validator } from './validation'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import handlebars from 'handlebars'

// Email configuration
interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    name: string
    address: string
  }
  replyTo?: string
  maxRetries: number
  retryDelay: number
}

const defaultConfig: EmailConfig = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'KNI Platform',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@kni.com',
  },
  replyTo: process.env.EMAIL_REPLY_TO,
  maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
}

// Email types
export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
  cid?: string
}

export interface EmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  priority?: 'high' | 'normal' | 'low'
  replyTo?: string
  headers?: Record<string, string>
}

export interface EmailTemplate {
  name: string
  subject: string
  html: string
  text?: string
  variables: string[]
}

// Email validation schemas
const emailSchemas = {
  address: z.string().email('Invalid email address'),
  
  options: z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
    subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
    text: z.string().optional(),
    html: z.string().optional(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    replyTo: z.string().email().optional(),
  }).refine(
    (data) => data.text || data.html,
    { message: 'Either text or html content is required' }
  ),
}

// Email queue item
interface EmailQueueItem {
  id: string
  options: EmailOptions
  template?: {
    name: string
    variables: Record<string, any>
  }
  attempts: number
  maxAttempts: number
  scheduledAt: Date
  createdAt: Date
}

// Email manager class
export class EmailManager {
  private static instance: EmailManager
  private transporter: nodemailer.Transporter
  private config: EmailConfig
  private templates: Map<string, EmailTemplate> = new Map()
  private queue: EmailQueueItem[] = []
  private isProcessing = false
  private templateCache: Map<string, { compiled: handlebars.TemplateDelegate; lastModified: number }> = new Map()

  private constructor(config: Partial<EmailConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.createTransporter()
    this.loadTemplates()
    this.startQueueProcessor()
  }

  public static getInstance(config?: Partial<EmailConfig>): EmailManager {
    if (!EmailManager.instance) {
      EmailManager.instance = new EmailManager(config)
    }
    return EmailManager.instance
  }

  private createTransporter(): void {
    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    })

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('SMTP connection failed', {}, error)
      } else {
        logger.info('SMTP connection established')
      }
    })
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templatesDir = path.join(process.cwd(), 'src', 'templates', 'email')
      const templateFiles = await fs.readdir(templatesDir)
      
      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const templatePath = path.join(templatesDir, file)
          const templateData = await fs.readFile(templatePath, 'utf-8')
          const template: EmailTemplate = JSON.parse(templateData)
          
          this.templates.set(template.name, template)
          await logger.debug(`Loaded email template: ${template.name}`)
        }
      }
    } catch (error) {
      await logger.warn('Failed to load email templates', {}, error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async compileTemplate(
    templateName: string,
    variables: Record<string, any>
  ): Promise<{ subject: string; html: string; text?: string }> {
    const template = this.templates.get(templateName)
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`)
    }

    // Check if template is cached and up to date
    const cacheKey = templateName
    const cached = this.templateCache.get(cacheKey)
    
    let compiledTemplate: handlebars.TemplateDelegate
    
    if (cached) {
      compiledTemplate = cached.compiled
    } else {
      compiledTemplate = handlebars.compile(template.html)
      this.templateCache.set(cacheKey, {
        compiled: compiledTemplate,
        lastModified: Date.now(),
      })
    }

    // Validate required variables
    const missingVariables = template.variables.filter(
      (variable) => !(variable in variables)
    )
    
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing template variables: ${missingVariables.join(', ')}`
      )
    }

    // Compile templates
    const subjectTemplate = handlebars.compile(template.subject)
    const textTemplate = template.text ? handlebars.compile(template.text) : null

    return {
      subject: subjectTemplate(variables),
      html: compiledTemplate(variables),
      text: textTemplate ? textTemplate(variables) : undefined,
    }
  }

  // Send email immediately
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Validate email options
      const validation = await Validator.validate(emailSchemas.options, options)
      if (!validation.success) {
        throw new Error(`Invalid email options: ${validation.errors?.map(e => e.message).join(', ')}`)
      }

      const mailOptions = {
        from: `${this.config.from.name} <${this.config.from.address}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        priority: options.priority || 'normal',
        replyTo: options.replyTo || this.config.replyTo,
        headers: options.headers,
      }

      const result = await this.transporter.sendMail(mailOptions)
      
      await logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId,
      })

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      await logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : new Error(String(error)))

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Send email using template
  async sendTemplateEmail(
    templateName: string,
    to: string | string[],
    variables: Record<string, any>,
    options: Partial<EmailOptions> = {}
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const compiled = await this.compileTemplate(templateName, variables)
      
      const emailOptions: EmailOptions = {
        to,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        ...options,
      }

      return this.sendEmail(emailOptions)
    } catch (error) {
      await logger.error('Failed to send template email', {
        templateName,
        to,
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : new Error(String(error)))

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Queue email for later sending
  async queueEmail(
    options: EmailOptions,
    scheduledAt: Date = new Date(),
    maxAttempts: number = this.config.maxRetries
  ): Promise<string> {
    const queueItem: EmailQueueItem = {
      id: crypto.randomUUID(),
      options,
      attempts: 0,
      maxAttempts,
      scheduledAt,
      createdAt: new Date(),
    }

    this.queue.push(queueItem)
    
    await logger.info('Email queued', {
      id: queueItem.id,
      to: options.to,
      subject: options.subject,
      scheduledAt,
    })

    return queueItem.id
  }

  // Queue template email
  async queueTemplateEmail(
    templateName: string,
    to: string | string[],
    variables: Record<string, any>,
    scheduledAt: Date = new Date(),
    options: Partial<EmailOptions> = {}
  ): Promise<string> {
    const queueItem: EmailQueueItem = {
      id: crypto.randomUUID(),
      options: {
        to,
        subject: '', // Will be compiled when processing
        ...options,
      },
      template: {
        name: templateName,
        variables,
      },
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      scheduledAt,
      createdAt: new Date(),
    }

    this.queue.push(queueItem)
    
    await logger.info('Template email queued', {
      id: queueItem.id,
      templateName,
      to,
      scheduledAt,
    })

    return queueItem.id
  }

  // Process email queue
  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessing) return
    
    this.isProcessing = true
    
    const processQueue = async () => {
      try {
        const now = new Date()
        const itemsToProcess = this.queue.filter(
          (item) => item.scheduledAt <= now && item.attempts < item.maxAttempts
        )

        for (const item of itemsToProcess) {
          try {
            let result: { success: boolean; messageId?: string; error?: string }

            if (item.template) {
              result = await this.sendTemplateEmail(
                item.template.name,
                item.options.to,
                item.template.variables,
                item.options
              )
            } else {
              result = await this.sendEmail(item.options)
            }

            if (result.success) {
              // Remove from queue
              this.queue = this.queue.filter((queueItem) => queueItem.id !== item.id)
              
              await logger.info('Queued email processed successfully', {
                id: item.id,
                messageId: result.messageId,
              })
            } else {
              // Increment attempts
              item.attempts++
              
              if (item.attempts >= item.maxAttempts) {
                // Remove failed item
                this.queue = this.queue.filter((queueItem) => queueItem.id !== item.id)
                
                await logger.error('Queued email failed permanently', {
                  id: item.id,
                  attempts: item.attempts,
                  error: result.error,
                })
              } else {
                // Reschedule
                item.scheduledAt = new Date(Date.now() + this.config.retryDelay * item.attempts)
                
                await logger.warn('Queued email failed, retrying', {
                  id: item.id,
                  attempts: item.attempts,
                  nextAttempt: item.scheduledAt,
                  error: result.error,
                })
              }
            }
          } catch (error) {
            await logger.error('Error processing queued email', {
              id: item.id,
              error: error instanceof Error ? error.message : String(error),
            }, error instanceof Error ? error : new Error(String(error)))
          }
        }
      } catch (error) {
        await logger.error('Error in email queue processor', {}, error instanceof Error ? error : new Error(String(error)))
      }

      // Schedule next processing
      setTimeout(processQueue, 30000) // Process every 30 seconds
    }

    // Start processing
    processQueue()
  }

  // Get queue status
  getQueueStatus(): {
    total: number
    pending: number
    failed: number
    scheduled: number
  } {
    const now = new Date()
    
    return {
      total: this.queue.length,
      pending: this.queue.filter((item) => item.scheduledAt <= now && item.attempts < item.maxAttempts).length,
      failed: this.queue.filter((item) => item.attempts >= item.maxAttempts).length,
      scheduled: this.queue.filter((item) => item.scheduledAt > now).length,
    }
  }

  // Clear failed items from queue
  clearFailedItems(): number {
    const beforeCount = this.queue.length
    this.queue = this.queue.filter((item) => item.attempts < item.maxAttempts)
    const removedCount = beforeCount - this.queue.length
    
    logger.info('Cleared failed email queue items', { count: removedCount })
    return removedCount
  }

  // Test email configuration
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.verify()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Get available templates
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys())
  }

  // Get template details
  getTemplate(name: string): EmailTemplate | undefined {
    return this.templates.get(name)
  }
}

// Predefined email functions
export class EmailService {
  private static emailManager = EmailManager.getInstance()

  // Welcome email
  static async sendWelcomeEmail(
    to: string,
    variables: {
      name: string
      verificationUrl: string
    }
  ) {
    return this.emailManager.sendTemplateEmail('welcome', to, variables)
  }

  // Email verification
  static async sendVerificationEmail(
    to: string,
    variables: {
      name: string
      verificationUrl: string
    }
  ) {
    return this.emailManager.sendTemplateEmail('email-verification', to, variables)
  }

  // Password reset
  static async sendPasswordResetEmail(
    to: string,
    variables: {
      name: string
      resetUrl: string
      expiresIn: string
    }
  ) {
    return this.emailManager.sendTemplateEmail('password-reset', to, variables)
  }

  // Test invitation
  static async sendTestInvitationEmail(
    to: string,
    variables: {
      studentName: string
      testTitle: string
      testUrl: string
      dueDate: string
      teacherName: string
    }
  ) {
    return this.emailManager.sendTemplateEmail('test-invitation', to, variables)
  }

  // Test results
  static async sendTestResultsEmail(
    to: string,
    variables: {
      studentName: string
      testTitle: string
      score: number
      totalQuestions: number
      percentage: number
      resultsUrl: string
    }
  ) {
    return this.emailManager.sendTemplateEmail('test-results', to, variables)
  }

  // Notification email
  static async sendNotificationEmail(
    to: string | string[],
    subject: string,
    message: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ) {
    return this.emailManager.sendEmail({
      to,
      subject,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      priority,
    })
  }
}

// Export singleton instance
export const emailManager = EmailManager.getInstance()
export default EmailService
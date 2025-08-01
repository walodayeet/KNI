import { NextRequest } from 'next/server'

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log entry interface
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
  requestId?: string
  userId?: string
  ip?: string
  userAgent?: string
  url?: string
  method?: string
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  maxFileSize: number
  maxFiles: number
}

class Logger {
  private config: LoggerConfig
  private logBuffer: LogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<LoggerConfig> = {}) {
    const baseConfig = {
      level: this.getLogLevelFromEnv(),
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: true,
      enableRemote: process.env.NODE_ENV === 'production',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }
    
    // Only include remoteEndpoint if it has a value
    if (process.env.LOG_ENDPOINT) {
      (baseConfig as any).remoteEndpoint = process.env.LOG_ENDPOINT
    }
    
    this.config = {
      ...baseConfig,
      ...config,
    }

    // Start periodic flush for remote logging
    if (this.config.enableRemote) {
      this.flushInterval = setInterval(() => {
        this.flushLogs()
      }, 5000) // Flush every 5 seconds
    }
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.NEXT_PUBLIC_LOG_LEVEL?.toUpperCase()
    switch (level) {
      case 'ERROR':
        return LogLevel.ERROR
      case 'WARN':
        return LogLevel.WARN
      case 'INFO':
        return LogLevel.INFO
      case 'DEBUG':
        return LogLevel.DEBUG
      default:
        return LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelName = LogLevel[entry.level]
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` Error: ${entry.error.message}\n${entry.error.stack}` : ''
    
    return `[${entry.timestamp}] ${levelName}: ${entry.message}${contextStr}${errorStr}`
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    request?: NextRequest
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    }

    // Only include optional properties if they have values
    if (context) {
      entry.context = context
    }
    if (error) {
      entry.error = error
    }

    if (request) {
      entry.requestId = request.headers.get('x-request-id') || crypto.randomUUID()
      entry.ip = this.getClientIP(request)
      const userAgent = request.headers.get('user-agent')
      if (userAgent) {
        entry.userAgent = userAgent
      }
      entry.url = request.url
      entry.method = request.method
    }

    return entry
  }

  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    
    if (cfConnectingIP) return cfConnectingIP
    if (realIP) return realIP
    if (forwarded) return forwarded.split(',')[0]?.trim() || ''
    
    return 'unknown'
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    // Console logging
    if (this.config.enableConsole && this.shouldLog(entry.level)) {
      const formatted = this.formatLogEntry(entry)
      
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(formatted)
          break
        case LogLevel.WARN:
          console.warn(formatted)
          break
        case LogLevel.INFO:
          console.info(formatted)
          break
        case LogLevel.DEBUG:
          console.debug(formatted)
          break
      }
    }

    // Buffer for remote logging
    if (this.config.enableRemote && this.shouldLog(entry.level)) {
      this.logBuffer.push(entry)
      
      // Flush immediately for errors
      if (entry.level === LogLevel.ERROR) {
        await this.flushLogs()
      }
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.remoteEndpoint) {
      return
    }

    const logsToFlush = [...this.logBuffer]
    this.logBuffer = []

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToFlush }),
      })
    } catch (error) {
      // If remote logging fails, fall back to console
      console.error('Failed to send logs to remote endpoint:', error)
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToFlush)
    }
  }

  async error(
    message: string,
    context?: Record<string, any>,
    error?: Error,
    request?: NextRequest
  ): Promise<void> {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error, request)
    await this.writeLog(entry)
  }

  async warn(
    message: string,
    context?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, undefined, request)
    await this.writeLog(entry)
  }

  async info(
    message: string,
    context?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, undefined, request)
    await this.writeLog(entry)
  }

  async debug(
    message: string,
    context?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, undefined, request)
    await this.writeLog(entry)
  }

  // Performance logging
  async logPerformance(
    operation: string,
    duration: number,
    context?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    await this.info(
      `Performance: ${operation} completed in ${duration}ms`,
      { ...context, duration, operation },
      request
    )
  }

  // Database operation logging
  async logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    error?: Error,
    request?: NextRequest
  ): Promise<void> {
    const level = success ? LogLevel.INFO : LogLevel.ERROR
    const message = `Database ${operation} on ${table} ${success ? 'succeeded' : 'failed'} in ${duration}ms`
    
    const entry = this.createLogEntry(
      level,
      message,
      { operation, table, duration, success },
      error,
      request
    )
    
    await this.writeLog(entry)
  }

  // API request logging
  async logAPIRequest(
    request: NextRequest,
    response: { status: number; duration: number },
    userId?: string
  ): Promise<void> {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      `API Request: ${request.method} ${request.url}`,
      {
        status: response.status,
        duration: response.duration,
        userId,
      },
      undefined,
      request
    )
    
    await this.writeLog(entry)
  }

  // Security event logging
  async logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: Record<string, any>,
    request?: NextRequest
  ): Promise<void> {
    const level = severity === 'critical' || severity === 'high' ? LogLevel.ERROR : LogLevel.WARN
    
    await this.writeLog(
      this.createLogEntry(
        level,
        `Security Event: ${event}`,
        { ...context, severity, event },
        undefined,
        request
      )
    )
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    
    // Final flush
    this.flushLogs().catch(console.error)
  }
}

// Global logger instance
export const logger = new Logger()

// Performance measurement utility
export class PerformanceMonitor {
  private startTime: number
  private operation: string
  private context?: Record<string, any>
  private request?: NextRequest

  constructor(
    operation: string,
    context?: Record<string, any>,
    request?: NextRequest
  ) {
    this.operation = operation
    if (context) {
      this.context = context
    }
    if (request) {
      this.request = request
    }
    this.startTime = performance.now()
  }

  async end(): Promise<number> {
    const duration = performance.now() - this.startTime
    await logger.logPerformance(this.operation, duration, this.context, this.request)
    return duration
  }
}

// Error boundary for API routes
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (error) {
      await logger.error(
        'Unhandled error in API route',
        { handler: handler.name },
        error instanceof Error ? error : new Error(String(error))
      )
      throw error
    }
  }
}

// Request context middleware
export function createRequestLogger() {
  return async (request: NextRequest, handler: () => Promise<Response>): Promise<Response> => {
    const startTime = performance.now()
    const requestId = crypto.randomUUID()
    
    // Add request ID to headers
    request.headers.set('x-request-id', requestId)
    
    try {
      const response = await handler()
      const duration = performance.now() - startTime
      
      await logger.logAPIRequest(
        request,
        { status: response.status, duration }
      )
      
      return response
    } catch (error) {
      const duration = performance.now() - startTime
      
      await logger.error(
        'Request failed',
        { requestId, duration },
        error instanceof Error ? error : new Error(String(error)),
        request
      )
      
      throw error
    }
  }
}

export default logger
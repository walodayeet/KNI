import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { logger } from './logger'
import { Validator, ValidationError } from './validation'
import { rateLimit } from './security'
import { z } from 'zod'

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: any
  }
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    timestamp: string
    requestId?: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    timestamp: string
    requestId?: string
  }
}

// API Error types
export class KniApiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message)
    this.name = 'KniApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

// Common API errors
export const KniApiErrors = {
  BadRequest: (message: string = 'Bad request', details?: any) =>
    new KniApiError(message, 400, 'BAD_REQUEST', details),
  
  Unauthorized: (message: string = 'Unauthorized') =>
    new KniApiError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message: string = 'Forbidden') =>
    new KniApiError(message, 403, 'FORBIDDEN'),
  
  NotFound: (message: string = 'Resource not found') =>
    new KniApiError(message, 404, 'NOT_FOUND'),
  
  Conflict: (message: string = 'Resource conflict') =>
    new KniApiError(message, 409, 'CONFLICT'),
  
  ValidationFailed: (errors: ValidationError[]) =>
    new KniApiError(
      'Validation failed',
      422,
      'VALIDATION_FAILED',
      errors.map(e => ({
        field: e.field,
        message: e.message,
        code: e.code
      }))
    ),
  
  RateLimitExceeded: (message: string = 'Rate limit exceeded') =>
    new KniApiError(message, 429, 'RATE_LIMIT_EXCEEDED'),
  
  InternalError: (message: string = 'Internal server error') =>
    new KniApiError(message, 500, 'INTERNAL_ERROR'),
  
  ServiceUnavailable: (message: string = 'Service unavailable') =>
    new KniApiError(message, 503, 'SERVICE_UNAVAILABLE'),
}

// Response utilities
export class ApiResponse {
  static success<T>(
    data: T,
    meta?: Partial<ApiResponse['meta']>
  ): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }

    return NextResponse.json(response)
  }

  static paginated<T>(
    data: T[],
    pagination: {
      page: number
      limit: number
      total: number
    },
    meta?: Partial<ApiResponse['meta']>
  ): NextResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(pagination.total / pagination.limit)
    
    const response: PaginatedResponse<T> = {
      success: true,
      data,
      meta: {
        pagination: {
          ...pagination,
          totalPages,
        },
        timestamp: new Date().toISOString(),
        ...meta,
      },
    }

    return NextResponse.json(response)
  }

  static error(
    error: KniApiError | Error | string,
    requestId?: string
  ): NextResponse<ApiResponse> {
    let apiError: KniApiError
    
    if (error instanceof KniApiError) {
      apiError = error
    } else if (error instanceof Error) {
      apiError = new KniApiError(error.message)
    } else {
      apiError = new KniApiError(error)
    }

    const response: ApiResponse = {
      success: false,
      error: {
        message: apiError.message,
        code: apiError.code,
        details: apiError.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...(requestId && { requestId }),
      },
    }

    return NextResponse.json(response, { status: apiError.statusCode })
  }
}

// Request context
export interface RequestContext {
  user?: {
    id: string
    email: string
    name?: string
    role?: string
  }
  requestId: string
  ip: string
  userAgent: string
  method: string
  path: string
  timestamp: Date
}

// API Handler wrapper
export interface ApiHandlerOptions {
  requireAuth?: boolean
  requiredRole?: string
  rateLimit?: {
    requests: number
    window: number
  }
  validation?: {
    body?: z.ZodSchema
    query?: z.ZodSchema
    params?: z.ZodSchema
  }
}

export function createApiHandler(
  handler: (req: NextRequest, context: RequestContext, validated?: any) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    const requestId = crypto.randomUUID()
    const startTime = performance.now()
    
    try {
      // Create request context
      const context: RequestContext = {
        requestId,
        ip: ApiUtils.getClientIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        method: req.method,
        path: req.nextUrl.pathname,
        timestamp: new Date(),
      }

      // Log request start
      await logger.info('API request started', {
        requestId,
        method: context.method,
        path: context.path,
        ip: context.ip,
        userAgent: context.userAgent
      })

      // Rate limiting
      if (options.rateLimit) {
        const rateLimitResult = await rateLimit({
          maxRequests: options.rateLimit.requests,
          windowMs: options.rateLimit.window
        })(req)

        if (rateLimitResult) {
          throw KniApiErrors.RateLimitExceeded()
        }
      }

      // Authentication
      if (options.requireAuth) {
        const session = await getServerSession(authOptions)
        
        if (!session?.user) {
          throw KniApiErrors.Unauthorized()
        }

        context.user = {
          id: (session.user as any).id,
          email: session.user.email!,
          ...(session.user.name && { name: session.user.name }),
          ...((session.user as any).role && { role: (session.user as any).role }),
        }

        // Role-based access control
        if (options.requiredRole && context.user?.role !== options.requiredRole) {
          throw KniApiErrors.Forbidden('Insufficient permissions')
        }
      }

      // Validation
      const validated: any = {}
      
      if (options.validation) {
        // Validate body
        if (options.validation.body && req.method !== 'GET') {
          const body = await req.json().catch(() => ({}))
          const result = await Validator.validate(options.validation.body, body)
          
          if (!result.success) {
            throw KniApiErrors.ValidationFailed(result.errors!)
          }
          
          validated.body = result.data
        }

        // Validate query parameters
        if (options.validation.query) {
          const query = Object.fromEntries(req.nextUrl.searchParams.entries())
          const result = await Validator.validate(options.validation.query, query)
          
          if (!result.success) {
            throw KniApiErrors.ValidationFailed(result.errors!)
          }
          
          validated.query = result.data
        }

        // Validate path parameters
        if (options.validation.params && params) {
          const result = await Validator.validate(options.validation.params, params)
          
          if (!result.success) {
            throw KniApiErrors.ValidationFailed(result.errors!)
          }
          
          validated.params = result.data
        }
      }

      // Execute handler
      const response = await handler(req, context, validated)
      
      // Log successful response
      const duration = performance.now() - startTime
      await logger.info('API request completed', {
        requestId,
        method: context.method,
        path: context.path,
        statusCode: response.status,
        duration: Math.round(duration),
        userId: context.user?.id,
      })

      return response
      
    } catch (error) {
      // Log error
      const duration = performance.now() - startTime
      await logger.error('API request failed', {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        duration: Math.round(duration),
        error: error instanceof Error ? error.message : String(error),
      }, error instanceof Error ? error : new Error(String(error)))

      // Return error response
      return ApiResponse.error(error instanceof Error ? error : new Error(String(error)), requestId)
    }
  }
}

// Utility functions
export class ApiUtils {
  // Extract pagination parameters from request
  static getPaginationParams(searchParams: URLSearchParams) {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)))
    const skip = (page - 1) * limit
    
    return { page, limit, skip }
  }

  // Extract sorting parameters from request
  static getSortParams(searchParams: URLSearchParams, allowedFields: string[] = []) {
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    
    if (!sortBy || !allowedFields.includes(sortBy)) {
      return { sortBy: 'createdAt', sortOrder: 'desc' }
    }
    
    return { sortBy, sortOrder }
  }

  // Extract search parameters from request
  static getSearchParams(searchParams: URLSearchParams) {
    const search = searchParams.get('search')?.trim() || ''
    const filters: Record<string, any> = {}
    
    // Extract filter parameters (e.g., filter[category]=academic)
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const filterKey = key.slice(7, -1)
        filters[filterKey] = value
      }
    }
    
    return { search, filters }
  }

  // Validate request content type
  static validateContentType(req: NextRequest, expectedType: string = 'application/json'): boolean {
    const contentType = req.headers.get('content-type')
    return contentType?.includes(expectedType) || false
  }

  // Get client IP address
  static getClientIp(req: NextRequest): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'
    )
  }

  // Generate cache key for API responses
  static generateCacheKey(method: string, path: string, params?: Record<string, any>): string {
    const baseKey = `api:${method.toLowerCase()}:${path}`
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey
    }
    
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    return `${baseKey}:${Buffer.from(sortedParams).toString('base64')}`
  }

  // Parse request body safely
  static async parseRequestBody<T = any>(req: NextRequest): Promise<T | null> {
    try {
      if (!this.validateContentType(req)) {
        return null
      }
      
      const body = await req.text()
      return body ? JSON.parse(body) : null
    } catch (error) {
      await logger.warn('Failed to parse request body', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // Create response headers with security and caching
  static createSecureHeaders(options?: {
    cache?: boolean
    maxAge?: number
    cors?: boolean
  }) {
    const headers = new Headers()
    
    // Security headers
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Cache headers
    if (options?.cache) {
      const maxAge = options.maxAge || 300 // 5 minutes default
      headers.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`)
    } else {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
    
    // CORS headers
    if (options?.cors) {
      headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*')
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    
    return headers
  }
}

// Middleware for handling CORS preflight requests
export function handleCors(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: ApiUtils.createSecureHeaders({ cors: true }),
    })
  }
  return null
}

// Export commonly used utilities
export { ApiResponse as Response }
export default createApiHandler
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/security'
import { z } from 'zod'

// Rate limiting for error reporting
const errorReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50 // Limit each IP to 50 error reports per windowMs
})

// Validation schema for error reports
const errorReportSchema = z.object({
  errorId: z.string(),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }),
  errorInfo: z.object({
    componentStack: z.string().optional(),
  }).optional(),
  userAgent: z.string(),
  url: z.string().url(),
  timestamp: z.string(),
  level: z.enum(['component', 'page', 'critical']).optional(),
  retryCount: z.number().optional(),
  userId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  source: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await errorReportLimiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await request.json()
    
    // Validate the error report data
    const validationResult = errorReportSchema.safeParse(body)
    if (!validationResult.success) {
      logger.warn('Invalid error report data received', {
        errors: validationResult.error.errors,
        body,
      })
      return NextResponse.json(
        { error: 'Invalid error report data' },
        { status: 400 }
      )
    }

    const errorReport = validationResult.data

    // Enhanced logging with structured data
    const logData = {
      ...errorReport,
      clientIP: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'referer': request.headers.get('referer'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
      },
      severity: getSeverity(errorReport),
      category: getErrorCategory(errorReport.error.name),
    }

    // Log the error with appropriate level
    const {severity} = logData
    if (severity === 'critical') {
      logger.error('Critical client-side error reported', logData)
    } else if (severity === 'high') {
      logger.error('High priority client-side error reported', logData)
    } else {
      logger.warn('Client-side error reported', logData)
    }

    // Store error in database for analysis (if needed)
    await storeErrorReport(logData)

    // Send alerts for critical errors
    if (severity === 'critical') {
      await sendCriticalErrorAlert(logData)
    }

    return NextResponse.json(
      { 
        success: true, 
        errorId: errorReport.errorId,
        message: 'Error report received successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    logger.error('Failed to process error report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500 }
    )
  }
}

function getSeverity(errorReport: z.infer<typeof errorReportSchema>): 'low' | 'medium' | 'high' | 'critical' {
  const { level, retryCount = 0, error } = errorReport

  // Critical errors
  if (level === 'critical' || retryCount > 2) {
    return 'critical'
  }

  // High priority errors
  if (level === 'page' || retryCount > 1) {
    return 'high'
  }

  // Check error type for severity
  const criticalErrorTypes = [
    'ChunkLoadError',
    'SecurityError',
    'NetworkError',
    'TypeError: Cannot read property',
    'ReferenceError',
  ]

  if (criticalErrorTypes.some(type => error.message.includes(type) || error.name.includes(type))) {
    return 'high'
  }

  if (retryCount > 0) {
    return 'medium'
  }

  return 'low'
}

function getErrorCategory(errorName: string): string {
  const categories: Record<string, string> = {
    'ChunkLoadError': 'build',
    'TypeError': 'runtime',
    'ReferenceError': 'runtime',
    'SyntaxError': 'syntax',
    'NetworkError': 'network',
    'SecurityError': 'security',
    'Error': 'general',
  }

  return categories[errorName] || 'unknown'
}

async function storeErrorReport(errorData: any): Promise<void> {
  try {
    // Here you could store the error in a database
    // For now, we'll just log it as structured data
    logger.info('Error report stored', {
      errorId: errorData.errorId,
      timestamp: errorData.timestamp,
      severity: errorData.severity,
      category: errorData.category,
    })
  } catch (error) {
    logger.error('Failed to store error report', { error })
  }
}

async function sendCriticalErrorAlert(errorData: any): Promise<void> {
  try {
    // Here you could send alerts via email, Slack, etc.
    // For now, we'll just log the critical error
    logger.error('CRITICAL ERROR ALERT', {
      errorId: errorData.errorId,
      message: errorData.error.message,
      url: errorData.url,
      userId: errorData.userId,
      timestamp: errorData.timestamp,
      stack: errorData.error.stack,
    })

    // Example: Send to external monitoring service
    // await fetch('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `🚨 Critical Error: ${errorData.error.message}`,
    //     attachments: [{
    //       color: 'danger',
    //       fields: [
    //         { title: 'Error ID', value: errorData.errorId, short: true },
    //         { title: 'URL', value: errorData.url, short: true },
    //         { title: 'User ID', value: errorData.userId || 'Anonymous', short: true },
    //         { title: 'Timestamp', value: errorData.timestamp, short: true },
    //       ]
    //     }]
    //   })
    // })
  } catch (error) {
    logger.error('Failed to send critical error alert', { error })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'error-reporting' })
}
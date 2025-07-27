import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/security'
import { z } from 'zod'

// Rate limiting for user bug reports
const userReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 user reports per windowMs
  message: 'Too many bug reports from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Validation schema for user bug reports
const userReportSchema = z.object({
  errorId: z.string(),
  error: z.string().optional(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  userAgent: z.string(),
  url: z.string().url(),
  timestamp: z.string(),
  userFeedback: z.string().min(1).max(1000),
  userEmail: z.string().email().optional(),
  reproductionSteps: z.string().max(2000).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior: z.string().max(1000).optional(),
  browserInfo: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    platform: z.string().optional(),
  }).optional(),
  screenResolution: z.string().optional(),
  additionalContext: z.string().max(1000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await userReportLimiter(request)
    if (rateLimitResult) {
      return rateLimitResult
    }

    const body = await request.json()
    
    // Validate the user report data
    const validationResult = userReportSchema.safeParse(body)
    if (!validationResult.success) {
      logger.warn('Invalid user bug report data received', {
        errors: validationResult.error.errors,
        body,
      })
      return NextResponse.json(
        { error: 'Invalid bug report data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const userReport = validationResult.data

    // Enhanced logging with structured data
    const reportData = {
      ...userReport,
      reportId: `user_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientIP: request.ip || 'unknown',
      headers: {
        'user-agent': request.headers.get('user-agent'),
        'referer': request.headers.get('referer'),
        'x-forwarded-for': request.headers.get('x-forwarded-for'),
      },
      reportType: 'user_submitted',
      priority: getUserReportPriority(userReport),
      category: 'user_feedback',
    }

    // Log the user report
    logger.info('User bug report submitted', reportData)

    // Store the report for review
    await storeUserReport(reportData)

    // Send notification to development team
    await notifyDevelopmentTeam(reportData)

    // Generate ticket ID for user reference
    const ticketId = generateTicketId(reportData.reportId)

    return NextResponse.json(
      { 
        success: true, 
        reportId: reportData.reportId,
        ticketId,
        message: 'Bug report submitted successfully. Thank you for helping us improve!'
      },
      { status: 200 }
    )

  } catch (error) {
    logger.error('Failed to process user bug report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to submit bug report. Please try again later.' },
      { status: 500 }
    )
  }
}

function getUserReportPriority(report: z.infer<typeof userReportSchema>): 'low' | 'medium' | 'high' | 'critical' {
  const { error, userFeedback } = report

  // Check for critical keywords in user feedback
  const criticalKeywords = [
    'crash', 'broken', 'not working', 'error', 'bug', 'issue',
    'problem', 'fail', 'unable', 'cannot', 'won\'t', 'doesn\'t'
  ]

  const highPriorityKeywords = [
    'slow', 'performance', 'timeout', 'loading', 'stuck'
  ]

  const feedbackLower = userFeedback.toLowerCase()
  
  if (error && error.includes('Error')) {
    return 'high'
  }

  if (criticalKeywords.some(keyword => feedbackLower.includes(keyword))) {
    return 'medium'
  }

  if (highPriorityKeywords.some(keyword => feedbackLower.includes(keyword))) {
    return 'medium'
  }

  return 'low'
}

async function storeUserReport(reportData: any): Promise<void> {
  try {
    // Here you could store the report in a database
    // For now, we'll structure it for logging
    const storageData = {
      reportId: reportData.reportId,
      errorId: reportData.errorId,
      timestamp: reportData.timestamp,
      priority: reportData.priority,
      userFeedback: reportData.userFeedback,
      url: reportData.url,
      userAgent: reportData.userAgent,
      userEmail: reportData.userEmail,
      reproductionSteps: reportData.reproductionSteps,
      expectedBehavior: reportData.expectedBehavior,
      actualBehavior: reportData.actualBehavior,
      additionalContext: reportData.additionalContext,
    }

    logger.info('User report stored for review', storageData)

    // Example: Store in database
    // await db.userReports.create({
    //   data: storageData
    // })
  } catch (error) {
    logger.error('Failed to store user report', { error })
  }
}

async function notifyDevelopmentTeam(reportData: any): Promise<void> {
  try {
    const notification = {
      type: 'user_bug_report',
      reportId: reportData.reportId,
      ticketId: generateTicketId(reportData.reportId),
      priority: reportData.priority,
      summary: reportData.userFeedback.substring(0, 100) + (reportData.userFeedback.length > 100 ? '...' : ''),
      url: reportData.url,
      userEmail: reportData.userEmail || 'Anonymous',
      timestamp: reportData.timestamp,
    }

    logger.info('Development team notified of user bug report', notification)

    // Example: Send to Slack, email, or project management tool
    // await fetch('https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `🐛 New Bug Report: ${notification.ticketId}`,
    //     attachments: [{
    //       color: notification.priority === 'high' ? 'danger' : notification.priority === 'medium' ? 'warning' : 'good',
    //       fields: [
    //         { title: 'Priority', value: notification.priority.toUpperCase(), short: true },
    //         { title: 'URL', value: notification.url, short: true },
    //         { title: 'User', value: notification.userEmail, short: true },
    //         { title: 'Summary', value: notification.summary, short: false },
    //       ]
    //     }]
    //   })
    // })
  } catch (error) {
    logger.error('Failed to notify development team', { error })
  }
}

function generateTicketId(reportId: string): string {
  // Generate a human-readable ticket ID
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `BUG-${timestamp}-${random}`
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'user-error-reporting',
    endpoints: {
      'POST /': 'Submit user bug report',
      'GET /': 'Health check'
    }
  })
}

// Get report status (optional)
export async function PATCH(request: NextRequest) {
  try {
    const { reportId } = await request.json()
    
    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    // Here you could check the status of a report in your database
    // For now, we'll return a mock status
    const status = {
      reportId,
      status: 'received',
      message: 'Your bug report has been received and is being reviewed by our team.',
      estimatedResolution: '2-5 business days'
    }

    return NextResponse.json(status)
  } catch (error) {
    logger.error('Failed to get report status', { error })
    return NextResponse.json(
      { error: 'Failed to get report status' },
      { status: 500 }
    )
  }
}
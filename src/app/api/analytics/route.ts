import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/security'
import { logger } from '@/lib/logger'
import { getClientIP } from '@/lib/security'

// Validation schemas
const AnalyticsEventSchema = z.object({
  name: z.string().min(1).max(100),
  properties: z.record(z.any()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  page: z.string().optional(),
  userAgent: z.string().optional(),
  referrer: z.string().optional(),
})

const AnalyticsBatchSchema = z.object({
  events: z.array(AnalyticsEventSchema).min(1).max(50),
})

// Rate limiting configuration
const analyticsRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
})

// Event processing functions
function sanitizeEvent(event: any) {
  return {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    properties: event.properties ? sanitizeProperties(event.properties) : undefined,
  }
}

function sanitizeProperties(properties: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(properties)) {
    // Skip sensitive data
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('secret')) {
      continue
    }
    
    // Limit string length
    if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.substring(0, 1000) + '...'
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

function categorizeEvent(eventName: string): string {
  const categories = {
    page_view: 'navigation',
    page_exit: 'navigation',
    button_click: 'interaction',
    form_submission: 'interaction',
    user_interaction: 'interaction',
    search: 'feature',
    feature_usage: 'feature',
    conversion: 'business',
    error: 'system',
    web_vital: 'performance',
    timing: 'performance',
    user_engagement: 'engagement',
  }
  
  return categories[eventName as keyof typeof categories] || 'other'
}

async function storeEvents(events: any[], clientIP: string) {
  try {
    // In a real application, you would store these in a database
    // For now, we'll just log them with structured data
    
    const processedEvents = events.map(event => ({
      ...sanitizeEvent(event),
      category: categorizeEvent(event.name),
      clientIP: anonymizeIP(clientIP),
      receivedAt: new Date().toISOString(),
    }))
    
    // Log events for analysis
    logger.info('Analytics events received', {
      eventCount: processedEvents.length,
      events: processedEvents,
      source: 'analytics_api',
    })
    
    // Here you could:
    // 1. Store in database (PostgreSQL, ClickHouse, etc.)
    // 2. Send to analytics service (Google Analytics, Mixpanel, etc.)
    // 3. Stream to data pipeline (Kafka, Kinesis, etc.)
    
    return { success: true, processed: processedEvents.length }
  } catch (error) {
    logger.error('Failed to store analytics events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      eventCount: events.length,
    })
    throw error
  }
}

function anonymizeIP(ip: string): string {
  // Simple IP anonymization - remove last octet for IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.')
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  
  // For IPv6, remove last 64 bits
  if (ip.includes(':')) {
    const parts = ip.split(':')
    return parts.slice(0, 4).join(':') + '::'
  }
  
  return 'unknown'
}

// API handlers
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await analyticsRateLimit(request)
    if (rateLimitResult) {
      return rateLimitResult
    }
    
    // Parse and validate request body
    const body = await request.json()
    const validatedData = AnalyticsBatchSchema.parse(body)
    
    // Get client information
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Process events
    const result = await storeEvents(validatedData.events, clientIP)
    
    // Log successful processing
    logger.info('Analytics batch processed successfully', {
      eventCount: validatedData.events.length,
      clientIP: anonymizeIP(clientIP),
      userAgent,
    })
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      timestamp: new Date().toISOString(),
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid analytics data received', {
        errors: error.errors,
        clientIP: anonymizeIP(getClientIP(request)),
      })
      
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: error.errors,
        },
        { status: 400 }
      )
    }
    
    logger.error('Analytics API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP: anonymizeIP(getClientIP(request)),
    })
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process analytics data',
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'analytics',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}

// Options for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
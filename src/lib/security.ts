import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Security headers configuration
export const securityHeaders = {
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https: blob:;
    connect-src 'self' https: wss:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s+/g, ' ').trim(),
}

// Rate limiting configuration
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

const defaultRateLimit: RateLimitConfig = {
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0]?.trim() || ''
  
  return request.ip || 'unknown'
}

// Rate limiting middleware
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { maxRequests, windowMs } = { ...defaultRateLimit, ...config }
  
  return (request: NextRequest) => {
    const ip = getClientIP(request)
    const key = `rate_limit:${ip}`
    const now = Date.now()
    
    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k)
      }
    }
    
    const current = rateLimitStore.get(key)
    
    if (!current) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      return { allowed: true, remaining: maxRequests - 1 }
    }
    
    if (current.resetTime < now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
      return { allowed: true, remaining: maxRequests - 1 }
    }
    
    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
      }
    }
    
    current.count++
    return {
      allowed: true,
      remaining: maxRequests - current.count,
    }
  }
}

// CSRF token generation and validation
export class CSRFProtection {
  private static secret = process.env.CSRF_SECRET || 'default-csrf-secret'
  
  static generateToken(sessionId: string): string {
    const timestamp = Date.now().toString()
    const data = `${sessionId}:${timestamp}`
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
    
    return Buffer.from(`${data}:${hash}`).toString('base64')
  }
  
  static validateToken(token: string, sessionId: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [receivedSessionId, timestamp, hash] = decoded.split(':')
      
      if (receivedSessionId !== sessionId) return false
      
      // Check if token is not older than 1 hour
      const tokenAge = Date.now() - parseInt(timestamp)
      if (tokenAge > 3600000) return false
      
      const expectedHash = crypto
        .createHmac('sha256', this.secret)
        .update(`${receivedSessionId}:${timestamp}`)
        .digest('hex')
      
      return hash === expectedHash
    } catch {
      return false
    }
  }
}

// Input validation and sanitization
export class InputValidator {
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>"'&]/g, (char) => {
        const entities: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;',
        }
        return entities[char] || char
      })
      .trim()
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }
  
  static validatePassword(password: string): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  }
  
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }
}

// Security middleware factory
export function createSecurityMiddleware() {
  const limiter = rateLimit()
  
  return (request: NextRequest) => {
    // Apply rate limiting
    const rateLimitResult = limiter(request)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(
              ((rateLimitResult.resetTime || 0) - Date.now()) / 1000
            ).toString(),
          },
        }
      )
    }
    
    // Create response with security headers
    const response = NextResponse.next()
    
    // Apply security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', defaultRateLimit.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    
    return response
  }
}

// Encryption utilities
export class EncryptionUtils {
  private static algorithm = 'aes-256-gcm'
  private static key = crypto.scryptSync(
    process.env.ENCRYPTION_KEY || 'default-key',
    'salt',
    32
  )
  
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.algorithm, this.key)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  static decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipher(this.algorithm, this.key)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
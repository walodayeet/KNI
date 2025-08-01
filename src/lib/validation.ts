import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'
import { logger } from './logger'

// Custom error class for validation errors
export class ValidationError extends Error {
  public readonly field: string
  public readonly code: string
  public readonly value?: any

  constructor(message: string, field: string, code: string, value?: any) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
    this.code = code
    this.value = value
  }
}

// Validation result type
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: ValidationError[]
}

// Custom Zod schemas with enhanced validation
export const customSchemas = {
  // Enhanced email validation
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .max(254, 'Email must not exceed 254 characters')
    .refine(
      (email) => {
        // Additional email validation using validator.js
        return validator.isEmail(email, {
          allow_utf8_local_part: false,
          require_tld: true,
        })
      },
      { message: 'Invalid email format' }
    ),

  // Strong password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .refine(
      (password) => {
        // At least one uppercase letter
        return /[A-Z]/.test(password)
      },
      { message: 'Password must contain at least one uppercase letter' }
    )
    .refine(
      (password) => {
        // At least one lowercase letter
        return /[a-z]/.test(password)
      },
      { message: 'Password must contain at least one lowercase letter' }
    )
    .refine(
      (password) => {
        // At least one number
        return /\d/.test(password)
      },
      { message: 'Password must contain at least one number' }
    )
    .refine(
      (password) => {
        // At least one special character
        return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      },
      { message: 'Password must contain at least one special character' }
    ),

  // Phone number validation
  phone: z
    .string()
    .refine(
      (phone) => validator.isMobilePhone(phone, 'any', { strictMode: false }),
      { message: 'Invalid phone number format' }
    ),

  // URL validation
  url: z
    .string()
    .refine(
      (url) => validator.isURL(url, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
      }),
      { message: 'Invalid URL format' }
    ),

  // UUID validation
  uuid: z
    .string()
    .refine(
      (uuid) => validator.isUUID(uuid),
      { message: 'Invalid UUID format' }
    ),

  // Date validation
  dateString: z
    .string()
    .refine(
      (date) => validator.isISO8601(date),
      { message: 'Invalid date format. Use ISO 8601 format' }
    ),

  // Sanitized HTML content
  htmlContent: z
    .string()
    .transform((html) => DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    })),

  // File upload validation
  fileUpload: z.object({
    name: z.string().min(1, 'File name is required'),
    size: z.number().max(10 * 1024 * 1024, 'File size must not exceed 10MB'),
    type: z.string().refine(
      (type) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
        return allowedTypes.includes(type)
      },
      { message: 'Invalid file type' }
    ),
  }),
}

// User schemas
export const userSchemas = {
  register: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must not exceed 50 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
    email: customSchemas.email,
    password: customSchemas.password,
    confirmPassword: z.string(),
    terms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  }).refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  ),

  login: z.object({
    email: customSchemas.email,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
  }),

  updateProfile: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must not exceed 50 characters')
      .optional(),
    email: customSchemas.email.optional(),
    phone: customSchemas.phone.optional(),
    bio: z
      .string()
      .max(500, 'Bio must not exceed 500 characters')
      .optional(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: customSchemas.password,
    confirmNewPassword: z.string(),
  }).refine(
    (data) => data.newPassword === data.confirmNewPassword,
    {
      message: 'New passwords do not match',
      path: ['confirmNewPassword'],
    }
  ),
}

// Test schemas
export const testSchemas = {
  create: z.object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title must not exceed 200 characters'),
    description: z
      .string()
      .max(1000, 'Description must not exceed 1000 characters')
      .optional(),
    category: z.enum(['academic', 'professional', 'personal', 'other']),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    timeLimit: z
      .number()
      .min(1, 'Time limit must be at least 1 minute')
      .max(180, 'Time limit must not exceed 180 minutes'),
    isPublic: z.boolean().default(false),
    tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  }),

  update: z.object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title must not exceed 200 characters')
      .optional(),
    description: z
      .string()
      .max(1000, 'Description must not exceed 1000 characters')
      .optional(),
    category: z.enum(['academic', 'professional', 'personal', 'other']).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    timeLimit: z
      .number()
      .min(1, 'Time limit must be at least 1 minute')
      .max(180, 'Time limit must not exceed 180 minutes')
      .optional(),
    isPublic: z.boolean().optional(),
    tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed').optional(),
  }),

  question: z.object({
    question: z
      .string()
      .min(10, 'Question must be at least 10 characters')
      .max(1000, 'Question must not exceed 1000 characters'),
    type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay']),
    options: z
      .array(z.string())
      .min(2, 'At least 2 options required for multiple choice')
      .max(6, 'Maximum 6 options allowed')
      .optional(),
    correctAnswer: z.string().min(1, 'Correct answer is required'),
    explanation: z
      .string()
      .max(500, 'Explanation must not exceed 500 characters')
      .optional(),
    points: z
      .number()
      .min(1, 'Points must be at least 1')
      .max(100, 'Points must not exceed 100'),
  }),
}

// API schemas
export const apiSchemas = {
  pagination: z.object({
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'Page must be greater than 0')
      .default('1'),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .default('10'),
    search: z.string().max(100, 'Search term must not exceed 100 characters').optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),

  idParam: z.object({
    id: customSchemas.uuid,
  }),
}

// Validation utilities
export class Validator {
  // Validate data against schema
  static async validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context?: string
  ): Promise<ValidationResult<T>> {
    try {
      const validatedData = await schema.parseAsync(data)
      return {
        success: true,
        data: validatedData,
      }
    } catch (error) {
      const errors: ValidationError[] = []

      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          errors.push(
            new ValidationError(
              issue.message,
              issue.path.join('.'),
              issue.code,
              issue.received
            )
          )
        }
      } else {
        errors.push(
          new ValidationError(
            'Validation failed',
            'unknown',
            'unknown',
            data
          )
        )
      }

      // Log validation errors
      await logger.warn('Validation failed', {
        context,
        errors: errors.map((e) => ({
          field: e.field,
          message: e.message,
          code: e.code,
        })),
      })

      return {
        success: false,
        errors,
      }
    }
  }

  // Sanitize string input
  static sanitizeString(input: string, options?: {
    maxLength?: number
    allowHtml?: boolean
    trim?: boolean
  }): string {
    const { maxLength = 1000, allowHtml = false, trim = true } = options || {}
    
    let sanitized = input
    
    if (trim) {
      sanitized = sanitized.trim()
    }
    
    if (!allowHtml) {
      sanitized = validator.escape(sanitized)
    } else {
      sanitized = DOMPurify.sanitize(sanitized)
    }
    
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength)
    }
    
    return sanitized
  }

  // Validate and sanitize object
  static async validateAndSanitize<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    sanitizeOptions?: {
      stringFields?: string[]
      maxLength?: number
      allowHtml?: boolean
    }
  ): Promise<ValidationResult<T>> {
    // First sanitize string fields if specified
    if (sanitizeOptions?.stringFields && typeof data === 'object' && data !== null) {
      const sanitizedData = { ...data } as any
      
      for (const field of sanitizeOptions.stringFields) {
        if (typeof sanitizedData[field] === 'string') {
          sanitizedData[field] = this.sanitizeString(sanitizedData[field], {
            maxLength: sanitizeOptions.maxLength,
            allowHtml: sanitizeOptions.allowHtml,
          })
        }
      }
      
      data = sanitizedData
    }

    // Then validate
    return this.validate(schema, data)
  }

  // Check if string contains only safe characters
  static isSafeString(input: string): boolean {
    // Allow alphanumeric, spaces, and common punctuation
    const safePattern = /^[a-zA-Z0-9\s\.,!?\-_@#$%&*()+=\[\]{}|;:'"/\\<>]*$/
    return safePattern.test(input)
  }

  // Validate file upload
  static validateFile(file: {
    name: string
    size: number
    type: string
  }): ValidationResult<typeof file> {
    return this.validate(customSchemas.fileUpload, file)
  }

  // Rate limiting validation
  static validateRateLimit(_identifier: string, _limit: number, _window: number): boolean {
    // This would typically use Redis or in-memory store
    // For now, return true (implement with actual rate limiting logic)
    return true
  }
}

// Middleware for request validation
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: any, res: any, next: any) => {
    try {
      const data = req[source]
      const result = await Validator.validate(schema, data, `${req.method} ${req.path}`)
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.errors?.map((e) => ({
            field: e.field,
            message: e.message,
            code: e.code,
          })),
        })
      }
      
      req.validated = result.data
      next()
    } catch (error) {
      await logger.error('Validation middleware error', {}, error instanceof Error ? error : new Error(String(error)))
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

// Export commonly used schemas
export const schemas = {
  ...customSchemas,
  user: userSchemas,
  test: testSchemas,
  api: apiSchemas,
}

export default Validator
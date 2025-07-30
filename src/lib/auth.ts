import { NextAuthOptions, Session, User } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { compare, hash } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './database'
import { logger } from './logger'
import { Validator, userSchemas, customSchemas } from './validation'
import { rateLimit } from './security'
import crypto from 'crypto'

// Extended user type
export interface ExtendedUser extends User {
  id: string
  email: string
  name?: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST'
  createdAt: Date
  updatedAt: Date
}

// Extended session type
export interface ExtendedSession extends Session {
  user: ExtendedUser
  accessToken?: string
  refreshToken?: string
}

// Extended JWT type
export interface ExtendedJWT extends JWT {
  id: string
  role: string
}

// Authentication errors
class AuthError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.statusCode = statusCode
  }
}

const AuthErrors = {
  InvalidCredentials: () => new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401),
  AccountNotFound: () => new AuthError('Account not found', 'ACCOUNT_NOT_FOUND', 404),
  EmailNotVerified: () => new AuthError('Email not verified', 'EMAIL_NOT_VERIFIED', 403),
  AccountLocked: () => new AuthError('Account is locked', 'ACCOUNT_LOCKED', 423),
  TooManyAttempts: () => new AuthError('Too many login attempts', 'TOO_MANY_ATTEMPTS', 429),
  SessionExpired: () => new AuthError('Session expired', 'SESSION_EXPIRED', 401),
  InsufficientPermissions: () =>
    new AuthError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS', 403),
}

// Password utilities
class PasswordUtils {
  static async hash(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12')
    return hash(password, saltRounds)
  }

  static async verify(password: string, hashedPassword: string): Promise<boolean> {
    return compare(password, hashedPassword)
  }

  static generateSecurePassword(length: number = 16): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
    let password = ''

    // Ensure at least one character from each required category
    const categories = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      '!@#$%^&*()_+-=[]{}|;:,.<>?',
    ]

    // Add one character from each category
    for (const category of categories) {
      const randomIndex = crypto.randomInt(0, category.length)
      password += category[randomIndex]
    }

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length)
      password += charset[randomIndex]
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }
}

// User management utilities
class UserManager {
  static async createUser(userData: {
    name: string
    email: string
    password: string
    role?: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST'
  }) {
    // Validate input
    const validation = await Validator.validate(userSchemas.register, {
      ...userData,
      confirmPassword: userData.password,
      terms: true,
    })

    if (!validation.success) {
      throw new AuthError('Invalid user data', 'VALIDATION_FAILED', 400)
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email.toLowerCase() },
    })

    if (existingUser) {
      throw new AuthError('User already exists', 'USER_EXISTS', 409)
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(userData.password)

    // Create user
    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        role: userData.role || 'GUEST'
      },
    })

    await logger.info('User created', {
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    return user
  }

  // Email verification not implemented in current schema

  // Password reset not implemented in current schema
  static async initiatePasswordReset(_email: string) {
    // Don't reveal if user exists
    return { success: true }
  }

  // Password reset not implemented in current schema
  static async resetPassword(_token: string, _newPassword: string) {
    throw new AuthError('Password reset not available', 'NOT_IMPLEMENTED', 501)
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.password) {
      throw AuthErrors.AccountNotFound()
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtils.verify(currentPassword, user.password)

    if (!isCurrentPasswordValid) {
      throw AuthErrors.InvalidCredentials()
    }

    // Validate new password
    const validation = await Validator.validate(
      customSchemas.password,
      newPassword
    )

    if (!validation.success) {
      throw new AuthError('Invalid password format', 'INVALID_PASSWORD', 400)
    }

    const hashedPassword = await PasswordUtils.hash(newPassword)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    })

    await logger.info('Password changed', {
      userId: user.id,
      email: user.email,
    })

    return user
  }
}

// Session management
class SessionManager {
  static async createSession(userId: string, userAgent?: string, ip?: string) {
    const session = await prisma.session.create({
      data: {
        userId,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    })

    await logger.info('Session created', {
      sessionId: session.id,
      userId,
      ip,
      userAgent,
    })

    return session
  }

  static async invalidateSession(sessionId: string) {
    await prisma.session.delete({
      where: { id: sessionId },
    })

    await logger.info('Session invalidated', { sessionId })
  }

  static async invalidateAllUserSessions(userId: string) {
    const result = await prisma.session.deleteMany({
      where: { userId },
    })

    await logger.info('All user sessions invalidated', {
      userId,
      count: result.count,
    })

    return result.count
  }

  static async cleanupExpiredSessions() {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    await logger.info('Expired sessions cleaned up', {
      count: result.count,
    })

    return result.count
  }
}

// Role-based access control
class RoleManager {
  private static roleHierarchy = {
    ADMIN: ['ADMIN', 'TEACHER', 'STUDENT', 'GUEST'],
    TEACHER: ['TEACHER', 'STUDENT', 'GUEST'],
    STUDENT: ['STUDENT', 'GUEST'],
    GUEST: ['GUEST'],
  }

  static hasRole(userRole: string, requiredRole: string): boolean {
    const allowedRoles = this.roleHierarchy[userRole as keyof typeof this.roleHierarchy]
    return allowedRoles?.includes(requiredRole) || false
  }

  static hasPermission(userRole: string, permission: string): boolean {
    const permissions = {
      ADMIN: ['*'],
      TEACHER: [
        'test.create',
        'test.update',
        'test.delete',
        'test.view',
        'student.view',
        'result.view',
      ],
      STUDENT: ['test.take', 'result.view.own'],
      GUEST: ['test.view.public'],
    }

    const userPermissions = permissions[userRole as keyof typeof permissions] || []
    return userPermissions.includes('*') || userPermissions.includes(permission)
  }

  static async updateUserRole(userId: string, newRole: string, updatedBy: string) {
    const validRoles = ['ADMIN', 'TEACHER', 'STUDENT', 'GUEST']

    if (!validRoles.includes(newRole)) {
      throw new AuthError('Invalid role', 'INVALID_ROLE', 400)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole as any },
    })

    await logger.info('User role updated', {
      userId,
      newRole,
      updatedBy,
    })

    return user
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw AuthErrors.InvalidCredentials()
        }

        // Rate limiting for login attempts
        const rateLimitResult = rateLimit({ maxRequests: 5, windowMs: 15 * 60 * 1000 })(req as any)

        if (!rateLimitResult.allowed) {
          throw AuthErrors.TooManyAttempts()
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.password) {
          throw AuthErrors.InvalidCredentials()
        }

        // Verify password
        const isPasswordValid = await PasswordUtils.verify(credentials.password, user.password)

        if (!isPasswordValid) {
          throw AuthErrors.InvalidCredentials()
        }

        // Note: Email verification not implemented in current schema

        await logger.info('User logged in', {
          userId: user.id,
          email: user.email,
          ip: req?.headers?.['x-forwarded-for'] || 'unknown',
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),

    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user, account: _account }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role || 'GUEST'
      }

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id = token.id as string
        ;(session.user as any).role = token.role
      }

      return session
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },

  events: {
    async signIn({ user, account, profile: _profile }) {
      await logger.info('User signed in', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      })
    },

    async signOut({ session, token }) {
      await logger.info('User signed out', {
        userId: (session?.user as any)?.id || (token as any)?.id,
      })
    },
  },
}

// Session validation utility
export async function validateSession(sessionToken?: string): Promise<ExtendedUser | null> {
  if (!sessionToken) {
    return null
  }

  try {
    // This would typically decode and validate the JWT token
    // For now, we'll implement a basic version
    const session = await prisma.session.findFirst({
      where: {
        token: sessionToken,
      },
      include: {
        user: true,
      },
    })

    if (!session || !session.user) {
      return null
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as 'ADMIN' | 'TEACHER' | 'STUDENT' | 'GUEST',
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    } as ExtendedUser
  } catch (error) {
    await logger.error('Session validation failed', { error, sessionToken })
    return null
  }
}

// JWT utility functions
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12')
  return hash(password, saltRounds)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword)
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

export function verifyToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET!)
}

// Logout utility function
export async function logout(sessionToken: string): Promise<void> {
  try {
    // If using JWT tokens, we can't invalidate them server-side
    // But we can add the token to a blacklist or invalidate database sessions

    // For database sessions, find and delete the session
    await prisma.session.deleteMany({
      where: {
        token: sessionToken,
      },
    })

    await logger.info('User logged out', {
      sessionToken: `${sessionToken.substring(0, 10)}...`, // Log partial token for security
    })
  } catch (error) {
    await logger.error('Logout failed', {
      error,
      sessionToken: `${sessionToken.substring(0, 10)}...`,
    })
    throw new AuthError('Logout failed', 'LOGOUT_FAILED', 500)
  }
}

// Export utilities
export { PasswordUtils, UserManager, SessionManager, RoleManager, AuthError, AuthErrors }

export default authOptions

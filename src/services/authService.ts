import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth';
import { RegisterInput, LoginInput } from '@/validators/auth';
import { ConflictError, AuthenticationError, Logger } from '@/lib/errors';
import { User, Role } from '@prisma/client';

export interface AuthResult {
  user: Omit<User, 'password'>;
  token: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: RegisterInput): Promise<AuthResult> {
    Logger.info(`Registration attempt for email: ${data.email}`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existingUser) {
      Logger.warn(`Registration failed - user already exists: ${data.email}`);
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        name: data.name || null,
        role: data.role || Role.STUDENT
      }
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    Logger.info(`User registered successfully: ${user.email}`);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  }

  /**
   * Login user
   */
  static async login(data: LoginInput): Promise<AuthResult> {
    Logger.info(`Login attempt for email: ${data.email}`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (!user) {
      Logger.warn(`Login failed - user not found: ${data.email}`);
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await verifyPassword(data.password, user.password);
    if (!isValidPassword) {
      Logger.warn(`Login failed - invalid password: ${data.email}`);
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    Logger.info(`User logged in successfully: ${user.email}`);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  }

  /**
   * Logout user by invalidating session
   */
  static async logout(token: string): Promise<void> {
    Logger.info('Logout attempt');

    try {
      // Delete session
      await prisma.session.deleteMany({
        where: { token }
      });

      Logger.info('User logged out successfully');
    } catch (error) {
      Logger.error('Logout failed', error);
      throw error;
    }
  }

  /**
   * Validate session and get user
   */
  static async validateSession(token: string): Promise<Omit<User, 'password'> | null> {
    try {
      // Find valid session
      const session = await prisma.session.findFirst({
        where: {
          token,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          user: true
        }
      });

      if (!session) {
        return null;
      }

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = session.user;
      return userWithoutPassword;
    } catch (error) {
      Logger.error('Session validation failed', error);
      return null;
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      Logger.info(`Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      Logger.error('Session cleanup failed', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return null;
      }

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      Logger.error('Get user by ID failed', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    userId: number,
    data: { name?: string; email?: string }
  ): Promise<Omit<User, 'password'>> {
    Logger.info(`Profile update attempt for user ID: ${userId}`);

    // If email is being updated, check if it's already taken
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email.toLowerCase(),
          id: { not: userId }
        }
      });

      if (existingUser) {
        throw new ConflictError('Email is already taken by another user');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email.toLowerCase() })
      }
    });

    Logger.info(`Profile updated successfully for user ID: ${userId}`);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
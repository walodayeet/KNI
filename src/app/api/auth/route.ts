import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { registerSchema, loginSchema } from '@/validators/auth';
import { asyncHandler, ConflictError, AuthenticationError, RateLimitError, Logger, checkRateLimit } from '@/lib/errors';
import { Role } from '@prisma/client';

export const POST = asyncHandler(async (request: NextRequest) => {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  // Rate limiting: 5 requests per minute per IP
  if (!checkRateLimit(clientIp, 5, 60000)) {
    Logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
    throw new RateLimitError('Too many authentication attempts. Please try again later.');
  }

  const body = await request.json();
  const action = body.action;

  if (action === 'register') {
    const validatedData = registerSchema.parse(body);
    Logger.info(`Registration attempt for email: ${validatedData.email}`);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      Logger.warn(`Registration failed - user already exists: ${validatedData.email}`);
      throw new ConflictError('User with this email already exists');
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role || Role.STUDENT
      }
    });

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Create session record
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    Logger.info(`User registered successfully: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } else if (action === 'login') {
    const validatedData = loginSchema.parse(body);
    Logger.info(`Login attempt for email: ${validatedData.email}`);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (!user) {
      Logger.warn(`Login failed - user not found: ${validatedData.email}`);
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!isValidPassword) {
      Logger.warn(`Login failed - invalid password: ${validatedData.email}`);
      throw new AuthenticationError('Invalid email or password');
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Create session record
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    Logger.info(`User logged in successfully: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } else {
    throw new ValidationError('Invalid action. Must be "login" or "register"');
  }
});
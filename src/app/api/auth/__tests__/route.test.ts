import { POST } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('/api/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST - Register', () => {
    const registerData = {
      action: 'register',
      email: 'test@example.com',
      password: 'testpass',
      name: 'Test User',
      role: 'STUDENT'
    };

    it('should register a new user successfully', async () => {
      const hashedPassword = 'hashedPassword123';
      const token = 'generated.jwt.token';
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock database calls
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue(user);
      mockedPrisma.session.create.mockResolvedValue({
        id: 1,
        userId: 1,
        token,
        expiresAt: new Date(),
        createdAt: new Date()
      });

      // Mock bcrypt and jwt
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
      mockedJwt.sign.mockReturnValue(token as never);

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('User registered successfully');
      expect(data.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT'
      });
      expect(data.token).toBe(token);
    });

    it('should return error if user already exists', async () => {
      const existingUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Existing User',
        role: 'STUDENT',
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedPrisma.user.findUnique.mockResolvedValue(existingUser);

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(registerData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe('User with this email already exists');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        action: 'register',
        email: 'invalid-email',
        password: '123', // Too short (less than 6 characters)
      };

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Validation error');
      expect(data.details).toBeDefined();
    });
  });

  describe('POST - Login', () => {
    const loginData = {
      action: 'login',
      email: 'test@example.com',
      password: 'testpass'
    };

    it('should login user successfully', async () => {
      const token = 'generated.jwt.token';
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT',
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock database calls
      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedPrisma.session.create.mockResolvedValue({
        id: 1,
        userId: 1,
        token,
        expiresAt: new Date(),
        createdAt: new Date()
      });

      // Mock bcrypt and jwt
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedJwt.sign.mockReturnValue(token as never);

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Login successful');
      expect(data.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT'
      });
      expect(data.token).toBe(token);
    });

    it('should return error for non-existent user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Invalid email or password');
    });

    it('should return error for incorrect password', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'STUDENT',
        password: 'hashedPassword123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedPrisma.user.findUnique.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const request = new NextRequest('http://localhost:3000/api/auth', {
        method: 'POST',
        body: JSON.stringify(loginData),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Invalid email or password');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting', async () => {
      const registerData = {
        action: 'register',
        email: 'test@example.com',
        password: 'testpass',
      };

      // Make multiple requests quickly
      const requests = Array.from({ length: 6 }, () =>
        new NextRequest('http://localhost:3000/api/auth', {
          method: 'POST',
          body: JSON.stringify(registerData),
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
          },
        })
      );

      // First 5 requests should be allowed, 6th should be rate limited
      const responses = await Promise.all(requests.map(req => POST(req)));
      const lastResponse = responses[5];
      const data = await lastResponse.json();

      expect(lastResponse.status).toBe(429);
      expect(data.message).toContain('Too many authentication attempts');
    });
  });
});
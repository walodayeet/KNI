import { hashPassword, verifyPassword, generateToken, verifyToken } from '../auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Auth utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
      
      const result = await hashPassword(password);
      
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should throw error if hashing fails', async () => {
      const password = 'testPassword123';
      const error = new Error('Hashing failed');
      
      mockedBcrypt.hash.mockRejectedValue(error);
      
      await expect(hashPassword(password)).rejects.toThrow('Hashing failed');
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      
      const result = await verifyPassword(password, hashedPassword);
      
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'wrongPassword';
      const hashedPassword = 'hashedPassword123';
      
      mockedBcrypt.compare.mockResolvedValue(false as never);
      
      const result = await verifyPassword(password, hashedPassword);
      
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      const payload = { userId: 1, email: 'test@example.com', role: 'STUDENT' };
      const token = 'generated.jwt.token';
      
      mockedJwt.sign.mockReturnValue(token as never);
      
      const result = generateToken(payload);
      
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      expect(result).toBe(token);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode JWT token', () => {
      const token = 'valid.jwt.token';
      const payload = { userId: 1, email: 'test@example.com', role: 'STUDENT' };
      
      mockedJwt.verify.mockReturnValue(payload as never);
      
      const result = verifyToken(token);
      
      expect(mockedJwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid.jwt.token';
      const error = new Error('Invalid token');
      
      mockedJwt.verify.mockImplementation(() => {
        throw error;
      });
      
      expect(() => verifyToken(token)).toThrow('Invalid token');
    });
  });
});
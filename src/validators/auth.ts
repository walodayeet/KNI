import { z } from 'zod';

// User registration schema
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password too long'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).default('STUDENT'),
});

// User login schema
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(1, 'Email is required'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

// User profile update schema
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .optional(),
});

// Password change schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password too long'),
});

// Test creation schema
export const createTestSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long'),
  description: z
    .string()
    .max(1000, 'Description too long')
    .optional(),
  timeLimit: z
    .number()
    .int()
    .min(1, 'Time limit must be at least 1 minute')
    .max(480, 'Time limit cannot exceed 8 hours'),
  isPublic: z.boolean().default(false),
  questions: z.array(z.object({
    question: z.string().min(1, 'Question text is required'),
    type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().min(1, 'Correct answer is required'),
    points: z.number().int().min(1, 'Points must be at least 1'),
  })).min(1, 'At least one question is required'),
});

// Test submission schema
export const submitTestSchema = z.object({
  testId: z.number().int().positive(),
  answers: z.array(z.object({
    questionId: z.number().int().positive(),
    answer: z.string(),
  })),
  timeSpent: z.number().int().min(0),
});

// Pagination schema
export const paginationSchema = z.object({
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
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateTestInput = z.infer<typeof createTestSchema>;
export type SubmitTestInput = z.infer<typeof submitTestSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
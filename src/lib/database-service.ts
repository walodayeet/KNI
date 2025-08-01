import { Prisma } from '@prisma/client';
import { db } from './database';

// Get database instance from the exported singleton

// Export database client for direct access when needed
export const prisma = db.getClient();

// Helper function to check database connection
export const checkDatabaseConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

// Database service with common operations
export const DatabaseService = {
  // User operations
  users: {
    findMany: (args?: any) => db.executeQuery('users.findMany', () => prisma.user.findMany(args)),
    findUnique: (args: any) => db.executeQuery('users.findUnique', () => prisma.user.findUnique(args)),
    create: (args: any) => db.executeQuery('users.create', () => prisma.user.create(args)),
    update: (args: any) => db.executeQuery('users.update', () => prisma.user.update(args)),
    delete: (args: any) => db.executeQuery('users.delete', () => prisma.user.delete(args)),
  },
  
  // Session operations
  sessions: {
    findMany: (args?: any) => db.executeQuery('sessions.findMany', () => prisma.session.findMany(args)),
    findUnique: (args: any) => db.executeQuery('sessions.findUnique', () => prisma.session.findUnique(args)),
    create: (args: any) => db.executeQuery('sessions.create', () => prisma.session.create(args)),
    update: (args: any) => db.executeQuery('sessions.update', () => prisma.session.update(args)),
    delete: (args: any) => db.executeQuery('sessions.delete', () => prisma.session.delete(args)),
  },
  
  // Generic operations for any table
  table: (tableName: string) => ({
    findMany: (args?: any) => db.executeQuery(`${tableName}.findMany`, () => (prisma as any)[tableName].findMany(args)),
    findUnique: (args: any) => db.executeQuery(`${tableName}.findUnique`, () => (prisma as any)[tableName].findUnique(args)),
    create: (args: any) => db.executeQuery(`${tableName}.create`, () => (prisma as any)[tableName].create(args)),
    update: (args: any) => db.executeQuery(`${tableName}.update`, () => (prisma as any)[tableName].update(args)),
    delete: (args: any) => db.executeQuery(`${tableName}.delete`, () => (prisma as any)[tableName].delete(args)),
  }),
  
  // Transaction support
  transaction: <T>(operations: (tx: Prisma.TransactionClient) => Promise<T>) => 
    db.transaction(operations),
};

// Main exports
export default DatabaseService;
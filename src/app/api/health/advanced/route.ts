import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { CacheService } from '@/lib/cache';
import { prisma } from '@/lib/database';


// Health check response schema
const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  version: z.string(),
  environment: z.string(),
  uptime: z.number(),
  services: z.object({
    database: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      responseTime: z.number(),
      connections: z.number().optional(),
    }),
    cache: z.object({
      status: z.enum(['healthy', 'degraded', 'unhealthy']),
      responseTime: z.number(),
      hitRate: z.number().optional(),
    }),

  }),
  metrics: z.object({
    memory: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number(),
    }),
    cpu: z.object({
      usage: z.number(),
      loadAverage: z.array(z.number()),
    }),
  }),
});

type HealthCheckResponse = z.infer<typeof healthCheckSchema>;

// Service health check functions
async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  connections?: number;
}> {
  const startTime = Date.now();
  
  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Get connection pool info if available
    const connections = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
    `.catch(() => [{ count: 0 }]);
    
    const responseTime = Date.now() - startTime;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (responseTime < 100) {
      status = 'healthy';
    } else if (responseTime < 500) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return {
      status,
      responseTime,
      connections: connections[0]?.count || 0,
    };
  } catch (error) {
    await logger.error('Database health check failed', { error });
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkCacheHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  hitRate?: number;
}> {
  const startTime = Date.now();
  
  try {
    const testKey = 'health-check-test';
    const testValue = 'test-value';
    
    // Test cache set/get operations
    await CacheService.set(testKey, testValue, 60);
    const retrievedValue = await CacheService.get(testKey);
    await CacheService.delete(testKey);
    
    const responseTime = Date.now() - startTime;
    const isWorking = retrievedValue === testValue;
    
    // Get cache statistics if available
    const stats = await CacheService.getStats();
    const hitRate = stats.hits > 0 ? stats.hits / (stats.hits + stats.misses) : 0;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (isWorking && responseTime < 50) {
      status = 'healthy';
    } else if (isWorking && responseTime < 200) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    return {
      status,
      responseTime,
      hitRate,
    };
  } catch (error) {
    await logger.error('Cache health check failed', { error });
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
    };
  }
}



function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
    },
    cpu: {
      usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
    },
  };
}

// GET /api/health/advanced
export async function GET() {
  const startTime = Date.now();
  
  try {
    // Run health checks in parallel
    const [databaseHealth, cacheHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkCacheHealth(),
    ]);
    
    // Get system metrics
    const metrics = getSystemMetrics();
    
    // Determine overall status
    const services = { database: databaseHealth, cache: cacheHealth };
    const serviceStatuses = Object.values(services).map(service => service.status);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (serviceStatuses.every(status => status === 'healthy')) {
      overallStatus = 'healthy';
    } else if (serviceStatuses.some(status => status === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }
    
    const healthCheck: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services,
      metrics,
    };
    
    // Validate response
    const validatedResponse = healthCheckSchema.parse(healthCheck);
    
    // Log health check if status is not healthy
    if (overallStatus !== 'healthy') {
      await logger.warn('Health check shows degraded/unhealthy status', {
        status: overallStatus,
        services: serviceStatuses,
        duration: Date.now() - startTime,
      });
    }
    
    // Set appropriate HTTP status code
    let httpStatus: number;
    if (overallStatus === 'healthy' || overallStatus === 'degraded') {
      httpStatus = 200;
    } else {
      httpStatus = 503;
    }
    
    return NextResponse.json(validatedResponse, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
      },
    });
    
  } catch (error) {
    await logger.error('Health check endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
    });
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: 'An error occurred while checking system health',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// HEAD /api/health/advanced - Lightweight health check
export async function HEAD() {
  try {
    // Quick database ping
    await prisma.$queryRaw`SELECT 1`;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}
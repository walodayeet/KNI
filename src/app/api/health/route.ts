import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Logger } from '@/lib/errors';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning' | 'critical';
      usage: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    environment: {
      nodeEnv: string;
      nextVersion: string;
    };
  };
}

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    const dbStart = Date.now();
    let dbStatus: 'up' | 'down' = 'down';
    let dbResponseTime: number | undefined;
    let dbError: string | undefined;
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'up';
      dbResponseTime = Date.now() - dbStart;
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error';
      Logger.error('Database health check failed', error);
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;
    
    let memoryStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (memoryPercentage > 90) {
      memoryStatus = 'critical';
    } else if (memoryPercentage > 75) {
      memoryStatus = 'warning';
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (dbStatus === 'down') {
      overallStatus = 'unhealthy';
    } else if (memoryStatus === 'critical' || (dbResponseTime && dbResponseTime > 1000)) {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: {
          status: dbStatus,
          ...(dbResponseTime !== undefined && { responseTime: dbResponseTime }),
          ...(dbError !== undefined && { error: dbError }),
        },
        memory: {
          status: memoryStatus,
          usage: {
            used: Math.round(usedMemory / 1024 / 1024), // MB
            total: Math.round(totalMemory / 1024 / 1024), // MB
            percentage: Math.round(memoryPercentage * 100) / 100,
          },
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          nextVersion: process.env.npm_package_dependencies_next || 'unknown',
        },
      },
    };

    let statusCode: number;
    if (overallStatus === 'healthy' || overallStatus === 'degraded') {
      statusCode = 200;
    } else {
      statusCode = 503;
    }
    
    Logger.info(`Health check completed in ${Date.now() - startTime}ms`, {
      status: overallStatus,
      dbResponseTime,
      memoryPercentage,
    });

    return NextResponse.json(healthStatus, { status: statusCode });
  } catch (error) {
    Logger.error('Health check failed', error);
    
    const errorStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'down',
          error: 'Health check failed',
        },
        memory: {
          status: 'critical',
          usage: {
            used: 0,
            total: 0,
            percentage: 0,
          },
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          nextVersion: 'unknown',
        },
      },
    };

    return NextResponse.json(errorStatus, { status: 503 });
  }
}

// Simple ping endpoint for basic availability checks
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
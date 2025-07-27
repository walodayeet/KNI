import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createRecommendationSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  recommendation_type: z.enum(['study_area', 'practice_questions', 'review_topics']),
  content: z.record(z.string(), z.any()),
  priority: z.number().min(1).max(5).default(1),
  expires_at: z.string().transform(str => new Date(str)),
  n8n_workflow_id: z.string().optional()
});

const markCompletedSchema = z.object({
  recommendation_id: z.string().min(1, 'Recommendation ID is required'),
  user_id: z.string().min(1, 'User ID is required')
});

// POST /api/recommendations - Create recommendation (n8n webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createRecommendationSchema.parse(body);

    // Check if user exists and is premium
    const user = await prisma.user.findUnique({
      where: { id: validatedData.user_id },
      select: { id: true, user_type: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.user_type !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'Recommendations are only available for premium users' },
        { status: 403 }
      );
    }

    // Create recommendation
    const recommendation = await prisma.daily_recommendations.create({
      data: {
        ...validatedData,
        generated_by_n8n: true
      }
    });

    // Log webhook
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'recommendation_created',
        payload: body,
        status: 'success',
        processed_at: new Date()
      }
    });

    return NextResponse.json({
      message: 'Recommendation created successfully',
      recommendation
    });
  } catch (error) {
    console.error('Error creating recommendation:', error);
    
    // Log failed webhook
    try {
      await prisma.n8n_webhook_logs.create({
        data: {
          webhook_type: 'recommendation_created',
          payload: await request.json(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/recommendations - Get recommendations for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeCompleted = searchParams.get('includeCompleted') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user is premium
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { user_type: true }
    });

    if (!user || user.user_type !== 'PREMIUM') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const whereClause: any = {
      user_id: userId,
      expires_at: {
        gte: new Date()
      }
    };

    if (!includeCompleted) {
      whereClause.is_completed = false;
    }

    const [recommendations, total] = await Promise.all([
      prisma.daily_recommendations.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.daily_recommendations.count({ where: whereClause })
    ]);

    return NextResponse.json({
      recommendations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/recommendations - Mark recommendation as completed
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { recommendation_id, user_id } = markCompletedSchema.parse(body);

    // Verify recommendation belongs to user
    const recommendation = await prisma.daily_recommendations.findFirst({
      where: {
        id: recommendation_id,
        user_id: user_id
      }
    });

    if (!recommendation) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    if (recommendation.is_completed) {
      return NextResponse.json(
        { error: 'Recommendation already completed' },
        { status: 400 }
      );
    }

    // Mark as completed
    const updatedRecommendation = await prisma.daily_recommendations.update({
      where: { id: recommendation_id },
      data: { is_completed: true }
    });

    // Send webhook to n8n for tracking
    try {
      await fetch(process.env.N8N_WEBHOOK_URL + '/recommendation-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user_id,
          recommendationId: recommendation_id,
          recommendationType: recommendation.recommendation_type,
          completedAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
    }

    return NextResponse.json({
      message: 'Recommendation marked as completed',
      recommendation: updatedRecommendation
    });
  } catch (error) {
    console.error('Error updating recommendation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/recommendations - Clean up expired recommendations
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('adminKey');

    // Simple admin key check (in production, use proper authentication)
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete expired recommendations
    const result = await prisma.daily_recommendations.deleteMany({
      where: {
        expires_at: {
          lt: new Date()
        }
      }
    });

    return NextResponse.json({
      message: 'Expired recommendations cleaned up',
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error cleaning up recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createEvaluationSchema = z.object({
  attempt_id: z.string().min(1, 'Attempt ID is required'),
  overall_score: z.number().min(0).max(100),
  detailed_feedback: z.record(z.string(), z.any()), // questionId -> feedback
  improvement_areas: z.array(z.string()),
  strengths: z.array(z.string()),
  recommended_study: z.array(z.string()),
  difficulty_analysis: z.record(z.string(), z.any()),
  performance_trends: z.record(z.string(), z.any()),
  n8n_workflow_id: z.string().optional()
});

// POST /api/evaluations - Create evaluation (n8n webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createEvaluationSchema.parse(body);

    // Check if attempt exists
    const attempt = await prisma.mock_test_attempts.findUnique({
      where: { id: validatedData.attempt_id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            user_type: true
          }
        },
        mock_test: {
          select: {
            id: true,
            title: true,
            subject_area: true
          }
        }
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Test attempt not found' },
        { status: 404 }
      );
    }

    // Check if evaluation already exists
    const existingEvaluation = await prisma.test_evaluations.findFirst({
      where: { attempt_id: validatedData.attempt_id }
    });

    if (existingEvaluation) {
      return NextResponse.json(
        { error: 'Evaluation already exists for this attempt' },
        { status: 400 }
      );
    }

    // Create evaluation
    const evaluation = await prisma.test_evaluations.create({
      data: {
        ...validatedData,
        n8n_workflow_id: validatedData.n8n_workflow_id ?? null,
        generated_by_n8n: true
      }
    });

    // Update user progress with insights
    const userProgress = await prisma.user_progress.findUnique({
      where: {
        user_id_subject_area: {
          user_id: attempt.user.id,
          subject_area: attempt.mock_test.subject_area
        }
      }
    });

    if (userProgress) {
      // Calculate new average score
      const newAverage = (
        (userProgress.average_score * (userProgress.total_tests_taken - 1) + validatedData.overall_score) /
        userProgress.total_tests_taken
      );

      await prisma.user_progress.update({
        where: { id: userProgress.id },
        data: {
          average_score: newAverage,
          weak_areas: validatedData.improvement_areas,
          strong_areas: validatedData.strengths
        }
      });
    }

    // For premium users, generate daily recommendations
    if (attempt.user.user_type === 'PREMIUM') {
      try {
        await fetch(`${process.env.N8N_WEBHOOK_URL  }/generate-recommendations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: attempt.user.id,
            evaluationId: evaluation.id,
            improvementAreas: validatedData.improvement_areas,
            strengths: validatedData.strengths,
            subjectArea: attempt.mock_test.subject_area
          })
        });
      } catch (webhookError) {
        // Failed to trigger recommendations webhook
      }
    }

    // Log webhook
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'evaluation_created',
        payload: body,
        status: 'success',
        processed_at: new Date()
      }
    });

    return NextResponse.json({
      message: 'Evaluation created successfully',
      evaluation: {
        ...evaluation,
        attempt: {
          id: attempt.id,
          user: attempt.user,
          mock_test: attempt.mock_test
        }
      }
    });
  } catch (error) {
    // Error creating evaluation
    
    // Log failed webhook
    try {
      await prisma.n8n_webhook_logs.create({
        data: {
          webhook_type: 'evaluation_created',
          payload: await request.json(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (logError) {
      // Failed to log webhook error
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/evaluations - Get evaluations for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const attemptId = searchParams.get('attemptId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!userId && !attemptId) {
      return NextResponse.json(
        { error: 'User ID or Attempt ID is required' },
        { status: 400 }
      );
    }

    const whereClause: any = {};
    
    if (attemptId) {
      whereClause.attempt_id = attemptId;
    } else if (userId) {
      whereClause.attempt = {
        user_id: userId
      };
    }

    const [evaluations, total] = await Promise.all([
      prisma.test_evaluations.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          attempt: {
            include: {
              mock_test: {
                select: {
                  id: true,
                  title: true,
                  subject_area: true,
                  difficulty: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.test_evaluations.count({ where: whereClause })
    ]);

    return NextResponse.json({
      evaluations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    // Error fetching evaluations
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
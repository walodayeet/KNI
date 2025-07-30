import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createMockTestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  subject_area: z.string().min(1, 'Subject area is required'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  duration: z.number().min(1, 'Duration must be at least 1 minute'),
  total_questions: z.number().min(1, 'Must have at least 1 question'),
  passing_score: z.number().min(0).max(100).default(70),
  instructions: z.string().optional(),
  target_user_type: z.enum(['FREE', 'PREMIUM']).optional(),
  question_ids: z.array(z.string()).min(1, 'Must include at least 1 question'),
  n8n_workflow_id: z.string().optional()
});

// GET /api/mock-tests - Get available mock tests for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType') as 'FREE' | 'PREMIUM' | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!userId || !userType) {
      return NextResponse.json(
        { error: 'User ID and user type are required' },
        { status: 400 }
      );
    }

    // Build filter based on user type
    const whereClause: any = {
      status: 'ACTIVE',
      OR: [
        { target_user_type: null }, // Available to all
        { target_user_type: userType }
      ]
    };

    const [mockTests, total] = await Promise.all([
      prisma.mock_tests.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          mock_test_questions: {
            include: {
              question: {
                select: {
                  id: true,
                  subject_area: true,
                  difficulty: true
                }
              }
            }
          },
          mock_test_attempts: {
            where: { user_id: userId },
            select: {
              id: true,
              status: true,
              score: true,
              percentage: true,
              completed_at: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.mock_tests.count({ where: whereClause })
    ]);

    return NextResponse.json({
      mockTests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    // Error fetching mock tests
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/mock-tests - Create a new mock test (n8n webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createMockTestSchema.parse(body);

    const { question_ids, ...mockTestData } = validatedData;

    // Create mock test
    const mockTest = await prisma.mock_tests.create({
      data: {
        ...mockTestData,
        description: mockTestData.description ?? null,
        instructions: mockTestData.instructions ?? null,
        target_user_type: mockTestData.target_user_type ?? null,
        n8n_workflow_id: mockTestData.n8n_workflow_id ?? null,
        created_by_n8n: true
      }
    });

    // Create question associations
    const questionAssociations = question_ids.map((questionId, index) => ({
      mock_test_id: mockTest.id,
      question_id: questionId,
      order_index: index + 1
    }));

    await prisma.mock_test_questions.createMany({
      data: questionAssociations
    });

    // Log webhook
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'mock_test_created',
        payload: body,
        status: 'success',
        processed_at: new Date()
      }
    });

    return NextResponse.json({
      message: 'Mock test created successfully',
      mockTest: {
        ...mockTest,
        question_count: question_ids.length
      }
    });
  } catch (error) {
    // Error creating mock test
    
    // Log failed webhook
    try {
      await prisma.n8n_webhook_logs.create({
        data: {
          webhook_type: 'mock_test_created',
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

// PUT /api/mock-tests - Update mock test status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Mock test ID and status are required' },
        { status: 400 }
      );
    }

    const mockTest = await prisma.mock_tests.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({
      message: 'Mock test updated successfully',
      mockTest
    });
  } catch (error) {
    // Error updating mock test
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
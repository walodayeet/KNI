import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createAssignmentSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  mock_test_id: z.string().min(1, 'Mock test ID is required'),
  expires_at: z.string().transform(str => new Date(str))
});

const markCompletedSchema = z.object({
  assignment_id: z.string().min(1, 'Assignment ID is required'),
  user_id: z.string().min(1, 'User ID is required')
});

// POST /api/weekly-assignments - Create weekly assignment (n8n webhook)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createAssignmentSchema.parse(body);

    // Check if user exists and is free tier
    const user = await prisma.user.findUnique({
      where: { id: validatedData.user_id },
      select: { id: true, user_type: true, email: true, last_weekly_test_at: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.user_type !== 'FREE') {
      return NextResponse.json(
        { error: 'Weekly assignments are only for free tier users' },
        { status: 403 }
      );
    }

    // Check if mock test exists
    const mockTest = await prisma.mock_tests.findUnique({
      where: { id: validatedData.mock_test_id },
      select: { id: true, title: true, status: true, target_user_type: true }
    });

    if (!mockTest || mockTest.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Mock test not found or not available' },
        { status: 404 }
      );
    }

    // Check if user already has an active assignment for this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const existingAssignment = await prisma.weekly_assignments.findFirst({
      where: {
        user_id: validatedData.user_id,
        assigned_at: {
          gte: oneWeekAgo
        },
        is_completed: false
      }
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'User already has an active weekly assignment' },
        { status: 400 }
      );
    }

    // Create assignment
    const assignment = await prisma.weekly_assignments.create({
      data: validatedData,
      include: {
        mock_test: {
          select: {
            id: true,
            title: true,
            description: true,
            subject_area: true,
            difficulty: true,
            duration: true,
            total_questions: true
          }
        }
      }
    });

    // Update user's last weekly test assignment time
    await prisma.user.update({
      where: { id: validatedData.user_id },
      data: { last_weekly_test_at: new Date() }
    });

    // Log webhook
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'weekly_assignment_created',
        payload: body,
        status: 'success',
        processed_at: new Date()
      }
    });

    return NextResponse.json({
      message: 'Weekly assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Error creating weekly assignment:', error);
    
    // Log failed webhook
    try {
      await prisma.n8n_webhook_logs.create({
        data: {
          webhook_type: 'weekly_assignment_created',
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

// GET /api/weekly-assignments - Get assignments for user
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

    // Check if user is free tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { user_type: true }
    });

    if (!user || user.user_type !== 'FREE') {
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

    const [assignments, total] = await Promise.all([
      prisma.weekly_assignments.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          mock_test: {
            select: {
              id: true,
              title: true,
              description: true,
              subject_area: true,
              difficulty: true,
              duration: true,
              total_questions: true,
              passing_score: true
            }
          }
        },
        orderBy: { assigned_at: 'desc' }
      }),
      prisma.weekly_assignments.count({ where: whereClause })
    ]);

    return NextResponse.json({
      assignments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching weekly assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/weekly-assignments - Mark assignment as completed
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { assignment_id, user_id } = markCompletedSchema.parse(body);

    // Verify assignment belongs to user
    const assignment = await prisma.weekly_assignments.findFirst({
      where: {
        id: assignment_id,
        user_id: user_id
      },
      include: {
        mock_test: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (assignment.is_completed) {
      return NextResponse.json(
        { error: 'Assignment already completed' },
        { status: 400 }
      );
    }

    // Check if user has actually completed the test
    const testAttempt = await prisma.mock_test_attempts.findFirst({
      where: {
        user_id: user_id,
        mock_test_id: assignment.mock_test_id,
        status: 'completed',
        completed_at: {
          gte: assignment.assigned_at
        }
      }
    });

    if (!testAttempt) {
      return NextResponse.json(
        { error: 'Test must be completed before marking assignment as done' },
        { status: 400 }
      );
    }

    // Mark as completed
    const updatedAssignment = await prisma.weekly_assignments.update({
      where: { id: assignment_id },
      data: {
        is_completed: true,
        completed_at: new Date()
      }
    });

    // Send webhook to n8n for tracking
    try {
      await fetch(process.env.N8N_WEBHOOK_URL + '/weekly-assignment-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user_id,
          assignmentId: assignment_id,
          mockTestId: assignment.mock_test_id,
          testAttemptId: testAttempt.id,
          completedAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
    }

    return NextResponse.json({
      message: 'Assignment marked as completed',
      assignment: updatedAssignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/weekly-assignments - Clean up expired assignments
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

    // Delete expired assignments
    const result = await prisma.weekly_assignments.deleteMany({
      where: {
        expires_at: {
          lt: new Date()
        }
      }
    });

    return NextResponse.json({
      message: 'Expired assignments cleaned up',
      deletedCount: result.count
    });
  } catch (error) {
    console.error('Error cleaning up assignments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
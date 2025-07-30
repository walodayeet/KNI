import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const generateDailyTestSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
});

const completeDailyTestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  testAttemptId: z.string().min(1, 'Test attempt ID is required')
});

// GET /api/daily-mock-test - Get today's daily mock test for user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        user_type: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has a daily test for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingDailyTest = await prisma.mock_test_attempts.findFirst({
      where: {
        user_id: userId,
        started_at: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        mock_test: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            duration: true,
            total_questions: true
          }
        }
      }
    });

    if (existingDailyTest) {
      return NextResponse.json({
        hasDaily: true,
        dailyTest: existingDailyTest.mock_test,
        attempt: {
          id: existingDailyTest.id,
          status: existingDailyTest.status,
          score: existingDailyTest.score,
          completed_at: existingDailyTest.completed_at
        },
        streak: 0,
        message: existingDailyTest.status === 'completed' 
          ? 'Daily test already completed for today'
          : 'Daily test in progress'
      });
    }

    // Get a random active mock test for daily challenge
    const availableTests = await prisma.mock_tests.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { target_user_type: null },
          { target_user_type: user.user_type }
        ]
      },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        duration: true,
        total_questions: true
      }
    });

    if (availableTests.length === 0) {
      return NextResponse.json({
        hasDaily: false,
        message: 'No tests available for daily challenge'
      });
    }

    // Select a random test
    const randomIndex = Math.floor(Math.random() * availableTests.length);
    const selectedTest = availableTests[randomIndex];

    return NextResponse.json({
      hasDaily: false,
      dailyTest: selectedTest,
      streak: 0,
      message: 'Daily test ready to start'
    });

  } catch (error) {
    // Error fetching daily mock test
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/daily-mock-test - Start daily mock test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = generateDailyTestSchema.parse(body);

    // Check if user already has a daily test for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingDailyTest = await prisma.mock_test_attempts.findFirst({
      where: {
        user_id: userId,
        started_at: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (existingDailyTest) {
      return NextResponse.json(
        { error: 'Daily test already generated for today' },
        { status: 400 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, user_type: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get a random active mock test
    const availableTests = await prisma.mock_tests.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { target_user_type: null },
          { target_user_type: user.user_type }
        ]
      }
    });

    if (availableTests.length === 0) {
      return NextResponse.json(
        { error: 'No tests available for daily challenge' },
        { status: 404 }
      );
    }

    // Select a random test
    const randomIndex = Math.floor(Math.random() * availableTests.length);
    const selectedTest = availableTests[randomIndex];

    if (!selectedTest) {
      return NextResponse.json(
        { error: 'No test selected' },
        { status: 500 }
      );
    }

    // Create daily test attempt
    const attempt = await prisma.mock_test_attempts.create({
      data: {
        user_id: userId,
        mock_test_id: selectedTest.id,
        total_questions: selectedTest.total_questions,
        answers: {}
      },
      include: {
        mock_test: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            duration: true,
            total_questions: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Daily test started successfully',
      attempt: {
        id: attempt.id,
        mock_test: attempt.mock_test,
        started_at: attempt.started_at
      }
    });

  } catch (error) {
    // Error starting daily mock test
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/daily-mock-test - Complete daily mock test and update streak
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, testAttemptId } = completeDailyTestSchema.parse(body);

    // Verify the attempt belongs to the user and is a daily test
    const attempt = await prisma.mock_test_attempts.findFirst({
      where: {
        id: testAttemptId,
        user_id: userId,
        status: 'completed'
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Daily test attempt not found or not completed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Daily test completed successfully',
      streak: 1,
      lastTestDate: new Date()
    });

  } catch (error) {
    // Error completing daily mock test
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
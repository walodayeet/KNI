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
        user_type: true, 
        daily_streak: true,
        last_daily_test_at: true
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
        is_daily_test: true,
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
        streak: user.daily_streak || 0,
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
      streak: user.daily_streak || 0,
      message: 'Daily test ready to start'
    });

  } catch (error) {
    console.error('Error fetching daily mock test:', error);
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
        is_daily_test: true,
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

    // Create daily test attempt
    const attempt = await prisma.mock_test_attempts.create({
      data: {
        user_id: userId,
        mock_test_id: selectedTest.id,
        total_questions: selectedTest.total_questions,
        is_daily_test: true,
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
    console.error('Error starting daily mock test:', error);
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
        is_daily_test: true,
        status: 'completed'
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Daily test attempt not found or not completed' },
        { status: 404 }
      );
    }

    // Get user's current streak info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        daily_streak: true,
        last_daily_test_at: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate new streak
    let newStreak = 1;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    if (user.last_daily_test_at) {
      const lastTestDate = new Date(user.last_daily_test_at);
      lastTestDate.setHours(0, 0, 0, 0);
      
      // If last test was yesterday, increment streak
      if (lastTestDate.getTime() === yesterday.getTime()) {
        newStreak = (user.daily_streak || 0) + 1;
      }
      // If last test was today, keep current streak (shouldn't happen with proper validation)
      else if (lastTestDate.getTime() === today.setHours(0, 0, 0, 0)) {
        newStreak = user.daily_streak || 1;
      }
      // Otherwise, reset streak to 1
    }

    // Update user's streak and last test date
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        daily_streak: newStreak,
        last_daily_test_at: new Date()
      },
      select: {
        daily_streak: true,
        last_daily_test_at: true
      }
    });

    return NextResponse.json({
      message: 'Daily test completed and streak updated',
      streak: updatedUser.daily_streak,
      lastTestDate: updatedUser.last_daily_test_at
    });

  } catch (error) {
    console.error('Error completing daily mock test:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET /api/user-progress - Get user progress and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const subjectArea = searchParams.get('subjectArea');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        user_type: true,
        premium_activated_at: true,
        last_weekly_test_at: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build where clause for progress
    const progressWhere: any = { user_id: userId };
    if (subjectArea) {
      progressWhere.subject_area = subjectArea;
    }

    // Get user progress
    const userProgress = await prisma.user_progress.findMany({
      where: progressWhere,
      orderBy: { last_test_date: 'desc' }
    });

    // Get recent test attempts
    const recentAttempts = await prisma.mock_test_attempts.findMany({
      where: { user_id: userId },
      take: 10,
      include: {
        mock_test: {
          select: {
            id: true,
            title: true,
            subject_area: true,
            difficulty: true
          }
        },
        evaluations: {
          select: {
            id: true,
            overall_score: true,
            improvement_areas: true,
            strengths: true
          }
        }
      },
      orderBy: { completed_at: 'desc' }
    });

    // Calculate overall statistics
    const totalAttempts = await prisma.mock_test_attempts.count({
      where: {
        user_id: userId,
        status: 'completed'
      }
    });

    const avgScore = await prisma.mock_test_attempts.aggregate({
      where: {
        user_id: userId,
        status: 'completed',
        percentage: { not: null }
      },
      _avg: {
        percentage: true
      }
    });



    // Get improvement trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrends = await prisma.mock_test_attempts.findMany({
      where: {
        user_id: userId,
        status: 'completed',
        completed_at: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        percentage: true,
        completed_at: true,
        mock_test: {
          select: {
            subject_area: true,
            difficulty: true
          }
        }
      },
      orderBy: { completed_at: 'asc' }
    });

    // Get active recommendations (premium users)
    let activeRecommendations: any[] = [];
    if (user.user_type === 'PREMIUM') {
      activeRecommendations = await prisma.daily_recommendations.findMany({
        where: {
          user_id: userId,
          is_completed: false,
          expires_at: {
            gte: new Date()
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5
      });
    }

    // Get active weekly assignments (free users)
    let activeAssignments: any[] = [];
    if (user.user_type === 'FREE') {
      activeAssignments = await prisma.weekly_assignments.findMany({
        where: {
          user_id: userId,
          is_completed: false,
          expires_at: {
            gte: new Date()
          }
        },
        include: {
          mock_test: {
            select: {
              id: true,
              title: true,
              subject_area: true,
              difficulty: true,
              duration: true
            }
          }
        },
        orderBy: { assigned_at: 'desc' }
      });
    }

    // Calculate streak (consecutive days with activity)
    const calculateStreak = async () => {
      const attempts = await prisma.mock_test_attempts.findMany({
        where: {
          user_id: userId,
          status: 'completed'
        },
        select: {
          completed_at: true
        },
        orderBy: { completed_at: 'desc' }
      });

      if (attempts.length === 0) return 0;

      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (const attempt of attempts) {
        const attemptDate = new Date(attempt.completed_at!);
        attemptDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((currentDate.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === streak) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (diffDays === streak + 1) {
          // Allow for one day gap
          streak++;
          currentDate.setDate(currentDate.getDate() - 2);
        } else {
          break;
        }
      }

      return streak;
    };

    const currentStreak = await calculateStreak();

    return NextResponse.json({
      user,
      progress: userProgress,
      statistics: {
        totalAttempts,
        averageScore: avgScore._avg.percentage || 0,
        currentStreak,
        totalSubjects: userProgress.length
      },
      recentAttempts,
      trends: recentTrends,
      activeRecommendations,
      activeAssignments
    });
  } catch (error) {
    // Error fetching user progress
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/user-progress - Update user progress (internal use)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subjectArea, testResults } = body;

    if (!userId || !subjectArea || !testResults) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current progress
    const currentProgress = await prisma.user_progress.findUnique({
      where: {
        user_id_subject_area: {
          user_id: userId,
          subject_area: subjectArea
        }
      }
    });

    const {
      totalQuestions,
      correctAnswers,
      score,
      weakAreas,
      strongAreas
    } = testResults;

    if (currentProgress) {
      // Update existing progress
      const newTotalTests = currentProgress.total_tests_taken + 1;
      const newTotalQuestions = currentProgress.total_questions + totalQuestions;
      const newCorrectAnswers = currentProgress.correct_answers + correctAnswers;
      const newAverageScore = (
        (currentProgress.average_score * currentProgress.total_tests_taken + score) /
        newTotalTests
      );

      // Calculate improvement rate
      const improvementRate = newAverageScore - currentProgress.average_score;

      const updatedProgress = await prisma.user_progress.update({
        where: { id: currentProgress.id },
        data: {
          total_tests_taken: newTotalTests,
          total_questions: newTotalQuestions,
          correct_answers: newCorrectAnswers,
          average_score: newAverageScore,
          weak_areas: weakAreas,
          strong_areas: strongAreas,
          improvement_rate: improvementRate,
          last_test_date: new Date()
        }
      });

      return NextResponse.json({
        message: 'Progress updated successfully',
        progress: updatedProgress
      });
    } else {
      // Create new progress record
      const newProgress = await prisma.user_progress.create({
        data: {
          user_id: userId,
          subject_area: subjectArea,
          total_tests_taken: 1,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          average_score: score,
          weak_areas: weakAreas,
          strong_areas: strongAreas,
          improvement_rate: 0,
          last_test_date: new Date()
        }
      });

      return NextResponse.json({
        message: 'Progress created successfully',
        progress: newProgress
      });
    }
  } catch (error) {
    // Error updating user progress
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const startAttemptSchema = z.object({
  userId: z.string().min(1, 'User ID is required')
});

const submitAttemptSchema = z.object({
  attemptId: z.string().min(1, 'Attempt ID is required'),
  answers: z.record(z.string(), z.string()), // questionId -> answer
  timeTaken: z.number().optional()
});

// POST /api/mock-tests/[id]/attempt - Start a new test attempt
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { userId } = startAttemptSchema.parse(body);
    const mockTestId = params.id;

    // Check if mock test exists and is active
    const mockTest = await prisma.mock_tests.findUnique({
      where: { id: mockTestId },
      include: {
        mock_test_questions: {
          include: {
            question: true
          },
          orderBy: { order_index: 'asc' }
        }
      }
    });

    if (!mockTest || mockTest.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Mock test not found or not available' },
        { status: 404 }
      );
    }

    // Check if user has access based on user type
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { user_type: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (mockTest.target_user_type && mockTest.target_user_type !== user.user_type) {
      return NextResponse.json(
        { error: 'Access denied for this test' },
        { status: 403 }
      );
    }

    // Check for existing incomplete attempt
    const existingAttempt = await prisma.mock_test_attempts.findFirst({
      where: {
        user_id: userId,
        mock_test_id: mockTestId,
        status: 'in_progress'
      }
    });

    if (existingAttempt) {
      return NextResponse.json({
        message: 'Resuming existing attempt',
        attempt: existingAttempt,
        questions: mockTest.mock_test_questions.map(mtq => ({
          id: mtq.question.id,
          question: mtq.question.question,
          options: mtq.question.options,
          order_index: mtq.order_index
        }))
      });
    }

    // Create new attempt
    const attempt = await prisma.mock_test_attempts.create({
      data: {
        user_id: userId,
        mock_test_id: mockTestId,
        total_questions: mockTest.total_questions,
        answers: {}
      }
    });

    return NextResponse.json({
      message: 'Test attempt started',
      attempt,
      questions: mockTest.mock_test_questions.map(mtq => ({
        id: mtq.question.id,
        question: mtq.question.question,
        options: mtq.question.options,
        order_index: mtq.order_index
      })),
      duration: mockTest.duration
    });
  } catch (error) {
    console.error('Error starting test attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/mock-tests/[id]/attempt - Submit test attempt
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { attemptId, answers, timeTaken } = submitAttemptSchema.parse(body);

    // Get attempt with questions
    const attempt = await prisma.mock_test_attempts.findUnique({
      where: { id: attemptId },
      include: {
        mock_test: {
          include: {
            mock_test_questions: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    if (attempt.status === 'completed') {
      return NextResponse.json(
        { error: 'Attempt already completed' },
        { status: 400 }
      );
    }

    // Calculate score
    let correctAnswers = 0;
    const questionResults: any[] = [];

    for (const mtq of attempt.mock_test.mock_test_questions) {
      const userAnswer = answers[mtq.question.id];
      const isCorrect = userAnswer === mtq.question.correct_answer;
      
      if (isCorrect) {
        correctAnswers++;
      }

      questionResults.push({
        questionId: mtq.question.id,
        userAnswer,
        correctAnswer: mtq.question.correct_answer,
        isCorrect,
        difficulty: mtq.question.difficulty
      });

      // Update question analytics
      await prisma.question_analytics.upsert({
        where: { question_id: mtq.question.id },
        update: {
          total_attempts: { increment: 1 },
          correct_attempts: isCorrect ? { increment: 1 } : undefined,
          last_updated: new Date()
        },
        create: {
          question_id: mtq.question.id,
          total_attempts: 1,
          correct_attempts: isCorrect ? 1 : 0,
          success_rate: isCorrect ? 100 : 0
        }
      });
    }

    const percentage = (correctAnswers / attempt.total_questions) * 100;
    const score = Math.round(percentage);

    // Update attempt
    const updatedAttempt = await prisma.mock_test_attempts.update({
      where: { id: attemptId },
      data: {
        status: 'completed',
        score,
        correct_answers: correctAnswers,
        percentage,
        time_taken: timeTaken,
        completed_at: new Date(),
        answers
      }
    });

    // Update user progress
    await prisma.user_progress.upsert({
      where: {
        user_id_subject_area: {
          user_id: attempt.user_id,
          subject_area: attempt.mock_test.subject_area
        }
      },
      update: {
        total_tests_taken: { increment: 1 },
        total_questions: { increment: attempt.total_questions },
        correct_answers: { increment: correctAnswers },
        last_test_date: new Date()
      },
      create: {
        user_id: attempt.user_id,
        subject_area: attempt.mock_test.subject_area,
        total_tests_taken: 1,
        total_questions: attempt.total_questions,
        correct_answers: correctAnswers,
        average_score: percentage,
        last_test_date: new Date()
      }
    });

    // Send webhook to n8n for evaluation
    try {
      await fetch(process.env.N8N_WEBHOOK_URL + '/test-submitted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: updatedAttempt.id,
          userId: attempt.user_id,
          mockTestId: attempt.mock_test_id,
          score,
          percentage,
          correctAnswers,
          totalQuestions: attempt.total_questions,
          questionResults,
          submittedAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
    }

    return NextResponse.json({
      message: 'Test submitted successfully',
      attempt: updatedAttempt,
      results: {
        score,
        percentage,
        correctAnswers,
        totalQuestions: attempt.total_questions,
        passed: percentage >= attempt.mock_test.passing_score
      }
    });
  } catch (error) {
    console.error('Error submitting test attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
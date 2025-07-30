import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const uploadConfigSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().min(1, 'File size is required'),
  fileType: z.string().min(1, 'File type is required'),
  testFormat: z.enum(['PDF', 'DOCX', 'TXT', 'JSON']).default('PDF'),
  targetModules: z.array(z.string()).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  duration: z.number().min(1, 'Duration must be at least 1 minute').default(60),
  passingScore: z.number().min(0).max(100).default(70),
  instructions: z.string().optional(),
  n8nWorkflowId: z.string().optional()
});

const updateStatusSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
  status: z.enum(['UPLOADED', 'PROCESSING', 'CONVERTED', 'EVALUATING', 'COMPLETED', 'FAILED']),
  progress: z.number().min(0).max(100).optional(),
  errorMessage: z.string().optional(),
  mockTestId: z.string().optional()
});

// POST /api/mock-tests/upload - Initialize file upload for mock test creation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = uploadConfigSchema.parse(body);

    // Check if user exists and has permission
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { id: true, user_type: true, role: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to upload (premium users or admin)
    if (user.user_type !== 'PREMIUM' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'File upload is only available for premium users' },
        { status: 403 }
      );
    }

    // Create upload record
    const upload = await prisma.file_uploads.create({
      data: {
        user_id: validatedData.userId,
        file_name: validatedData.fileName,
        file_size: validatedData.fileSize,
        file_type: validatedData.fileType,
        upload_type: 'MOCK_TEST',
        status: 'UPLOADED',
        progress: 0,
        configuration: {
          testFormat: validatedData.testFormat,
          targetModules: validatedData.targetModules || [],
          difficulty: validatedData.difficulty,
          duration: validatedData.duration,
          passingScore: validatedData.passingScore,
          instructions: validatedData.instructions,
          n8nWorkflowId: validatedData.n8nWorkflowId
        }
      }
    });

    // Log webhook for n8n processing
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'file_upload_initiated',
        payload: {
          uploadId: upload.id,
          userId: validatedData.userId,
          fileName: validatedData.fileName,
          configuration: upload.configuration
        },
        status: 'success',
        processed_at: new Date()
      }
    });

    // Send webhook to n8n for processing
    try {
      await fetch(`${process.env.N8N_WEBHOOK_URL  }/file-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId: upload.id,
          userId: validatedData.userId,
          fileName: validatedData.fileName,
          fileType: validatedData.fileType,
          configuration: upload.configuration,
          initiatedAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      // Failed to send upload webhook
    }

    return NextResponse.json({
      message: 'File upload initiated successfully',
      upload: {
        id: upload.id,
        status: upload.status,
        progress: upload.progress,
        created_at: upload.created_at
      }
    });

  } catch (error) {
    // Error initiating file upload
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/mock-tests/upload - Get upload status and history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const uploadId = searchParams.get('uploadId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // If specific upload ID is requested
    if (uploadId) {
      const upload = await prisma.file_uploads.findFirst({
        where: {
          id: uploadId,
          user_id: userId
        },
        include: {
          mock_test: {
            select: {
              id: true,
              title: true,
              status: true,
              total_questions: true
            }
          }
        }
      });

      if (!upload) {
        return NextResponse.json(
          { error: 'Upload not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ upload });
    }

    // Get user's upload history
    const [uploads, total] = await Promise.all([
      prisma.file_uploads.findMany({
        where: {
          user_id: userId,
          upload_type: 'MOCK_TEST'
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          mock_test: {
            select: {
              id: true,
              title: true,
              status: true,
              total_questions: true
            }
          }
        }
      }),
      prisma.file_uploads.count({
        where: {
          user_id: userId,
          upload_type: 'MOCK_TEST'
        }
      })
    ]);

    return NextResponse.json({
      uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    // Error fetching upload data
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/mock-tests/upload - Update upload status (n8n webhook)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = updateStatusSchema.parse(body);

    // Find the upload record
    const upload = await prisma.file_uploads.findUnique({
      where: { id: validatedData.uploadId }
    });

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      );
    }

    // Update upload status
    const updateData: any = {
      status: validatedData.status,
      progress: validatedData.progress || upload.progress,
      updated_at: new Date()
    };

    if (validatedData.errorMessage !== undefined) {
      updateData.error_message = validatedData.errorMessage;
    }

    if (validatedData.mockTestId !== undefined) {
      updateData.mock_test_id = validatedData.mockTestId;
    }

    const updatedUpload = await prisma.file_uploads.update({
      where: { id: validatedData.uploadId },
      data: updateData
    });

    // Log webhook
    await prisma.n8n_webhook_logs.create({
      data: {
        webhook_type: 'upload_status_updated',
        payload: body,
        status: 'success',
        processed_at: new Date()
      }
    });

    // If upload is completed and mock test is created, send notification
    if (validatedData.status === 'COMPLETED' && validatedData.mockTestId) {
      try {
        // Get user info for notification
        const user = await prisma.user.findUnique({
          where: { id: upload.user_id },
          select: { email: true, name: true }
        });

        if (user) {
          // Send completion webhook to n8n for notification
          await fetch(`${process.env.N8N_WEBHOOK_URL  }/upload-completed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uploadId: validatedData.uploadId,
              mockTestId: validatedData.mockTestId,
              userEmail: user.email,
              userName: user.name,
              fileName: upload.file_name,
              completedAt: new Date().toISOString()
            })
          });
        }
      } catch (notificationError) {
        // Failed to send completion notification
      }
    }

    return NextResponse.json({
      message: 'Upload status updated successfully',
      upload: updatedUpload
    });

  } catch (error) {
    // Error updating upload status
    
    // Log failed webhook
    try {
      await prisma.n8n_webhook_logs.create({
        data: {
          webhook_type: 'upload_status_updated',
          payload: await request.json(),
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          processed_at: new Date()
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

// DELETE /api/mock-tests/upload - Cancel/delete upload
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const userId = searchParams.get('userId');

    if (!uploadId || !userId) {
      return NextResponse.json(
        { error: 'Upload ID and User ID are required' },
        { status: 400 }
      );
    }

    // Find and verify ownership
    const upload = await prisma.file_uploads.findFirst({
      where: {
        id: uploadId,
        user_id: userId
      }
    });

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found or access denied' },
        { status: 404 }
      );
    }

    // Only allow deletion if not completed
    if (upload.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot delete completed upload' },
        { status: 400 }
      );
    }

    // Delete the upload record
    await prisma.file_uploads.delete({
      where: { id: uploadId }
    });

    // Send cancellation webhook to n8n
    try {
      await fetch(`${process.env.N8N_WEBHOOK_URL  }/upload-cancelled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          userId,
          fileName: upload.file_name,
          cancelledAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      // Failed to send cancellation webhook
    }

    return NextResponse.json({
      message: 'Upload cancelled successfully'
    });

  } catch (error) {
    // Error cancelling upload
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
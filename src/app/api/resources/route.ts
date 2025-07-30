import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const createResourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  subject_area: z.string().min(1, 'Subject area is required'),
  resource_type: z.enum(['PDF', 'VIDEO', 'DOCUMENT', 'LINK']),
  file_url: z.string().url('Valid URL is required'),
  file_size: z.number().optional(),
  duration: z.number().optional(), // For videos in minutes
  difficulty_level: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  tags: z.array(z.string()).optional(),
  is_premium: z.boolean().default(false)
});

// GET /api/resources - Get study resources
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const subjectArea = searchParams.get('subjectArea');
    const resourceType = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user info to check access level
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

    // Build filter based on user type and parameters
    const whereClause: any = {
      is_active: true
    };

    // Free users can only access free resources
    if (user.user_type === 'FREE') {
      whereClause.is_premium = false;
    }

    if (subjectArea) {
      whereClause.subject_area = subjectArea;
    }

    if (resourceType) {
      whereClause.resource_type = resourceType;
    }

    const [resources, total] = await Promise.all([
      prisma.study_materials.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [
          { is_premium: 'asc' }, // Free resources first
          { createdAt: 'desc' }
        ],
        select: {
          id: true,
          title: true,
          description: true,
          subject_area: true,
          resource_type: true,
          file_url: true,
          file_size: true,
          duration: true,
          difficulty_level: true,
          tags: true,
          is_premium: true,
          createdAt: true
        }
      }),
      prisma.study_materials.count({ where: whereClause })
    ]);

    // Transform data to match frontend interface
    const transformedResources = resources.map(resource => ({
      id: resource.id,
      title: resource.title,
      description: resource.description || '',
      type: resource.resource_type.toLowerCase() === 'pdf' ? 'pdf' : 'video',
      url: resource.file_url,
      subject_area: resource.subject_area,
      difficulty: resource.difficulty_level,
      tags: resource.tags,
      is_premium: resource.is_premium,
      file_size: resource.file_size,
      duration: resource.duration,
      created_at: resource.createdAt
    }));

    return NextResponse.json({
      resources: transformedResources,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      user_access: {
        type: user.user_type,
        can_access_premium: user.user_type === 'PREMIUM'
      }
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/resources - Create new resource (Admin/Teacher only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createResourceSchema.parse(body);

    // TODO: Add authentication check for admin/teacher role
    // For now, allowing creation for development

    const resource = await prisma.study_materials.create({
      data: {
        title: validatedData.title,
        description: validatedData.description || null,
        subject_area: validatedData.subject_area,
        resource_type: validatedData.resource_type,
        file_url: validatedData.file_url,
        file_size: validatedData.file_size || null,
        duration: validatedData.duration || null,
        difficulty_level: validatedData.difficulty_level || null,
        tags: validatedData.tags || [],
        is_premium: validatedData.is_premium
      }
    });

    return NextResponse.json({
      message: 'Resource created successfully',
      resource
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating resource:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/resources - Update resource status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Resource ID is required' },
        { status: 400 }
      );
    }

    const updatedResource = await prisma.study_materials.update({
      where: { id },
      data: { is_active }
    });

    return NextResponse.json({
      message: 'Resource updated successfully',
      resource: updatedResource
    });
  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
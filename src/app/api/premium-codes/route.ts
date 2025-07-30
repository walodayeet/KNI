import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { z } from 'zod';

const redeemCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  userId: z.string().min(1, 'User ID is required')
});

const createCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  expiresAt: z.string().optional(),
  createdBy: z.string().min(1, 'Creator ID is required')
});

// POST /api/premium-codes - Redeem a premium code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId } = redeemCodeSchema.parse(body);

    // Check if code exists and is not used
    const premiumCode = await prisma.premium_codes.findUnique({
      where: { code },
      include: { user: true }
    });

    if (!premiumCode) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 400 }
      );
    }

    if (premiumCode.is_used) {
      return NextResponse.json(
        { error: 'Code has already been used' },
        { status: 400 }
      );
    }

    if (premiumCode.expires_at && new Date() > premiumCode.expires_at) {
      return NextResponse.json(
        { error: 'Code has expired' },
        { status: 400 }
      );
    }

    // Update code as used and user as premium
    const [_updatedCode, updatedUser] = await Promise.all([
      prisma.premium_codes.update({
        where: { id: premiumCode.id },
        data: {
          is_used: true,
          used_by: userId,
          used_at: new Date()
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          user_type: 'PREMIUM',
          premium_activated_at: new Date()
        }
      })
    ]);

    // Send webhook to n8n
    try {
      await fetch(`${process.env.N8N_WEBHOOK_URL  }/code-redeemed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code,
          redeemedAt: new Date().toISOString()
        })
      });
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
    }

    return NextResponse.json({
      message: 'Code redeemed successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error redeeming code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/premium-codes - Create a new premium code (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, expiresAt, createdBy } = createCodeSchema.parse(body);

    // Check if code already exists
    const existingCode = await prisma.premium_codes.findUnique({
      where: { code }
    });

    if (existingCode) {
      return NextResponse.json(
        { error: 'Code already exists' },
        { status: 400 }
      );
    }

    const premiumCode = await prisma.premium_codes.create({
      data: {
        code,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        created_by: createdBy
      }
    });

    return NextResponse.json({
      message: 'Premium code created successfully',
      code: premiumCode
    });
  } catch (error) {
    console.error('Error creating premium code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/premium-codes - Get all premium codes (Admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [codes, total] = await Promise.all([
      prisma.premium_codes.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.premium_codes.count()
    ]);

    return NextResponse.json({
      codes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching premium codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
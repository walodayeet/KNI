import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing KNI schema connection...');

    // Test basic database connection
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');

    // Get schema information
    const schemaInfo = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'kni'
    ` as Array<{ schema_name: string }>;

    if (schemaInfo.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'KNI schema not found',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    // Get table count in KNI schema
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'kni' 
      AND table_type = 'BASE TABLE'
    ` as Array<{ count: bigint }>;

    // Get KNI tables list
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'kni' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    ` as Array<{ table_name: string }>;

    // Test core KNI tables
    const coreTableTests = {
      users: 0,
      sessions: 0,
      test_questions: 0,
      test_templates: 0,
      test_results: 0
    };

    // Count records in each core table
    try {
      const userCount = await prisma.user.count();
      coreTableTests.users = userCount;
    } catch (error) {
      console.warn('Could not count users:', error);
    }

    try {
      const sessionCount = await prisma.session.count();
      coreTableTests.sessions = sessionCount;
    } catch (error) {
      console.warn('Could not count sessions:', error);
    }

    try {
      const questionCount = await prisma.test_questions.count();
      coreTableTests.test_questions = questionCount;
    } catch (error) {
      console.warn('Could not count test_questions:', error);
    }

    try {
      const templateCount = await prisma.test_templates.count();
      coreTableTests.test_templates = templateCount;
    } catch (error) {
      console.warn('Could not count test_templates:', error);
    }

    try {
      const resultCount = await prisma.test_results.count();
      coreTableTests.test_results = resultCount;
    } catch (error) {
      console.warn('Could not count test_results:', error);
    }

    // Test a sample query on test_questions if it has data
    let sampleQuestion = null;
    if (coreTableTests.test_questions > 0) {
      try {
        sampleQuestion = await prisma.test_questions.findFirst({
          select: {
            id: true,
            question: true,
            subject_area: true,
            difficulty: true,
            createdAt: true
          }
        });
      } catch (error) {
        console.warn('Could not fetch sample question:', error);
      }
    }

    const response = {
      success: true,
      message: 'KNI schema connection successful',
      timestamp: new Date().toISOString(),
      schema: {
        name: 'kni',
        exists: true,
        tableCount: Number(tableCount[0]?.count || 0),
        tables: tables.map(t => t.table_name)
      },
      coreTableCounts: coreTableTests,
      sampleData: {
        question: sampleQuestion
      },
      prismaClient: {
        connected: true,
        multiSchemaEnabled: true
      }
    };

    console.log('✅ KNI schema test completed successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ KNI schema test failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'KNI schema connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint to create a sample test question (for demonstration)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, options, correct_answer, subject_area, difficulty } = body;

    if (!question || !options || !correct_answer || !subject_area) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required fields: question, options, correct_answer, subject_area' 
        },
        { status: 400 }
      );
    }

    const newQuestion = await prisma.test_questions.create({
      data: {
        question,
        options,
        correct_answer,
        subject_area,
        difficulty: difficulty || 'medium',
        explanation: 'Sample question created via API test'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Test question created successfully',
      question: newQuestion,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to create test question:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create test question',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
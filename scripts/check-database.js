const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Simple database check without the DatabaseManager for now
const prisma = new PrismaClient();

async function checkDatabaseConnection() {
  console.log('🔍 Checking PostgreSQL database connection...');
  
  try {
    // Test basic connection
    console.log('📡 Testing database connection...');
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful');
    
    // Check if tables exist
    console.log('\n📋 Checking database schema...');
    
    // First check what schemas exist
    const schemasResult = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'kni')
      ORDER BY schema_name
    `;
    
    console.log('📊 Available schemas:', schemasResult.map(s => s.schema_name).join(', '));
    
    // Check for tables in 'kni' schema first, then 'public'
    let tables;
    let currentSchema = 'kni';
    
    try {
      tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'kni' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      
      if (tables.length === 0) {
        console.log('⚠️  No tables found in "kni" schema, checking "public" schema...');
        currentSchema = 'public';
        tables = await prisma.$queryRaw`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
      }
    } catch (error) {
      console.log('⚠️  Error querying "kni" schema, falling back to "public" schema...');
      currentSchema = 'public';
      tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
    }
    
    console.log(`📊 Found ${tables.length} tables in the "${currentSchema}" schema:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check for KNI-specific tables
    const kniTables = ['users', 'sessions', 'test_questions', 'test_templates', 'test_results'];
    const existingKniTables = tables.filter(table => 
      kniTables.includes(table.table_name)
    );
    
    console.log(`\n🎯 KNI tables status:`);
    kniTables.forEach(tableName => {
      const exists = existingKniTables.some(table => table.table_name === tableName);
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
    });
    
    // Check test_questions table structure if it exists
    if (existingKniTables.some(table => table.table_name === 'test_questions')) {
      console.log('\n🔍 Checking test_questions table structure...');
      
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'test_questions' 
        AND table_schema = ${currentSchema}
        ORDER BY ordinal_position;
      `;
      
      console.log('📋 test_questions columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
      
      // Check for subject_area column specifically
      const hasSubjectArea = columns.some(col => col.column_name === 'subject_area');
      
      console.log(`\n🎯 Current schema: "${currentSchema}"`);
      console.log(`🎯 subject_area column: ${hasSubjectArea ? '✅ Present' : '❌ Missing'}`);
    }
    
    // Test database performance
    console.log('\n📊 Testing database performance...');
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1 as performance_test`;
    const latency = performance.now() - start;
    console.log(`Database latency: ${latency.toFixed(2)}ms`);
    
    console.log('\n🎉 Database check completed successfully!');
    
    return {
      status: 'healthy',
      connection: true,
      tablesCount: tables.length,
      kniTablesPresent: existingKniTables.length,
      kniTablesTotal: kniTables.length,
      latency: latency
    };
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Suggestions:');
      console.error('  1. Make sure PostgreSQL is running');
      console.error('  2. Check your DATABASE_URL in .env file');
      console.error('  3. Verify database credentials');
    } else if (error.code === 'P1001') {
      console.error('\n💡 Suggestions:');
      console.error('  1. Check if the database exists');
      console.error('  2. Verify your DATABASE_URL format');
      console.error('  3. Ensure database server is accessible');
    } else if (error.message.includes('schema')) {
      console.error('\n💡 Suggestions:');
      console.error('  1. Run: npm run db:generate');
      console.error('  2. Run: npm run db:push');
      console.error('  3. Check your Prisma schema file');
    }
    
    return {
      status: 'unhealthy',
      connection: false,
      error: error.message
    };
  } finally {
    // Clean up
    try {
      await prisma.$disconnect();
    } catch (cleanupError) {
      console.warn('⚠️ Warning: Could not properly disconnect from database');
    }
  }
}

// Run the check if this script is executed directly
if (require.main === module) {
  checkDatabaseConnection()
    .then(result => {
      console.log('\n📋 Final Result:', JSON.stringify(result, null, 2));
      process.exit(result.status === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { checkDatabaseConnection };
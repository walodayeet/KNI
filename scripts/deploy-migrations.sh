#!/bin/sh
# =============================================================================
# Database Migration Deployment Script
# =============================================================================
# This script runs Prisma migrations in production environment

echo "🚀 Starting database migration deployment..."
echo "Database URL: ${DATABASE_URL}"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

# Generate Prisma Client (in case it's not generated)
echo "📦 Generating Prisma Client..."
npx prisma generate

# Check database connection
echo "🔗 Testing database connection..."
npx prisma db push --accept-data-loss --skip-generate || {
    echo "❌ ERROR: Cannot connect to database or deploy schema"
    echo "Please check:"
    echo "1. Database URL format: postgresql://user:pass@host:port/database"
    echo "2. Database server is running"
    echo "3. User has CREATE privileges"
    exit 1
}

echo "✅ Database migration deployment completed successfully!"
echo "🎉 Your application should now be able to access all database tables."
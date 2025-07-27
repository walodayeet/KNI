# Migration from Supabase to PostgreSQL

This guide will help you migrate from Supabase to a standard PostgreSQL database.

## Overview

The application has been updated to use PostgreSQL with Prisma ORM instead of Supabase. This provides:

- Better control over your database
- No vendor lock-in
- Improved performance with connection pooling
- Enhanced monitoring and logging
- Support for local development

## What Changed

### Files Updated

1. **`src/lib/supabase.ts`** → Now uses Prisma instead of Supabase client
2. **`prisma/schema.prisma`** → Added KNI test system tables
3. **`.env`** → Updated database configuration
4. **`package.json`** → Removed Supabase dependencies
5. **`scripts/check-database.js`** → New database validation script

### Database Schema

Added the following tables to support the KNI test system:

- `test_questions` - Test questions with subject_area column
- `test_templates` - Test templates and configurations
- `test_results` - User test results and scores
- `users` - Enhanced user management
- `sessions` - User session management

## Setup Instructions

### 1. Choose Your PostgreSQL Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL locally
# Windows: Download from https://www.postgresql.org/download/windows/
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# Create database
psql -U postgres
CREATE DATABASE kni_database;
```

#### Option B: Docker PostgreSQL
```bash
# Use the provided docker-compose.yml
docker-compose up -d postgres
```

#### Option C: Cloud PostgreSQL
- **Railway**: https://railway.app/
- **Supabase** (just the database): https://supabase.com/
- **PlanetScale**: https://planetscale.com/
- **Neon**: https://neon.tech/

### 2. Configure Environment Variables

Update your `.env` file with the appropriate DATABASE_URL:

```env
# Local PostgreSQL
DATABASE_URL="postgresql://username:password@localhost:5432/kni_database"

# Docker PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/kni_database"

# Cloud PostgreSQL
DATABASE_URL="postgresql://username:password@host:port/database"
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Verify Setup

```bash
# Check database connection and schema
npm run db:check

# Open Prisma Studio to view data
npm run db:studio
```

## Data Migration

If you have existing data in Supabase:

### 1. Export from Supabase

```sql
-- Connect to your Supabase database and export data
COPY kni.users TO '/tmp/users.csv' WITH CSV HEADER;
COPY kni.test_questions TO '/tmp/test_questions.csv' WITH CSV HEADER;
COPY kni.test_templates TO '/tmp/test_templates.csv' WITH CSV HEADER;
COPY kni.test_results TO '/tmp/test_results.csv' WITH CSV HEADER;
```

### 2. Import to PostgreSQL

```sql
-- Connect to your new PostgreSQL database
\COPY users FROM '/tmp/users.csv' WITH CSV HEADER;
\COPY test_questions FROM '/tmp/test_questions.csv' WITH CSV HEADER;
\COPY test_templates FROM '/tmp/test_templates.csv' WITH CSV HEADER;
\COPY test_results FROM '/tmp/test_results.csv' WITH CSV HEADER;
```

### 3. Alternative: Use Migration Script

Create a custom migration script if you need to transform data during migration.

## Code Changes Required

### Before (Supabase)
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('kni.test_questions')
  .select('*')
  .eq('subject_area', 'math');
```

### After (PostgreSQL with Prisma)
```typescript
import { prisma } from '@/lib/supabase'; // Now uses Prisma

const data = await prisma.test_questions.findMany({
  where: {
    subject_area: 'math'
  }
});
```

### Using the Database Service
```typescript
import { DatabaseService } from '@/lib/supabase';

// Using the service layer
const questions = await DatabaseService.table('test_questions').findMany({
  where: { subject_area: 'math' }
});

// Using specific operations
const users = await DatabaseService.users.findMany();
```

## Benefits of the Migration

1. **Better Performance**: Connection pooling and optimized queries
2. **Enhanced Monitoring**: Built-in query logging and metrics
3. **Flexible Deployment**: Works with any PostgreSQL provider
4. **Type Safety**: Full TypeScript support with Prisma
5. **Developer Experience**: Prisma Studio for database management
6. **Cost Control**: No vendor-specific pricing constraints

## Troubleshooting

### Connection Issues
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection manually
psql "postgresql://username:password@localhost:5432/kni_database"
```

### Schema Issues
```bash
# Reset database if needed
npm run db:reset

# Regenerate Prisma client
npm run db:generate
```

### Migration Issues
```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

## Support

If you encounter issues during migration:

1. Check the database connection with `npm run db:check`
2. Verify your `.env` configuration
3. Ensure PostgreSQL is running and accessible
4. Review the Prisma schema for any conflicts
5. Check the application logs for detailed error messages

## Next Steps

1. Update any remaining Supabase references in your codebase
2. Set up database backups for production
3. Configure monitoring and alerting
4. Optimize queries for your specific use case
5. Consider setting up read replicas for better performance
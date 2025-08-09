# Production Deployment PostgreSQL Fix

## Issue Analysis

The deployment logs show PostgreSQL authentication failures:

```
pg_dump: error: connection to server at "postgres" (10.0.7.3), port 5432 failed: FATAL: password authentication failed for user "postgres"
2025-08-08 23:49:06.190 UTC [6576] FATAL: role "postgres" does not exist
```

## Root Cause

The production configuration (`docker-compose.prod.yml`) is set up to use:

- **Database User**: `kni_user` (default)
- **Database Name**: `kni_db` (default)

But the deployment environment appears to be trying to connect using the
`postgres` user, which doesn't exist.

## Solution Steps

### 1. Verify Environment Variables

Ensure these environment variables are correctly set in your deployment
platform:

```bash
# Database Configuration
POSTGRES_DB=kni_db
POSTGRES_USER=kni_user
POSTGRES_PASSWORD=your_secure_password

# Connection URLs
DATABASE_URL=postgresql://kni_user:your_secure_password@postgres:5432/kni_db
DIRECT_URL=postgresql://kni_user:your_secure_password@postgres:5432/kni_db
```

### 2. Database Backup Service Fix

The backup service in `docker-compose.prod.yml` uses the correct environment
variables, but ensure they're properly substituted:

```yaml
command: >
  sh -c '
    while true; do
      pg_dump -h postgres -U ${POSTGRES_USER:-kni_user} -d
  ${POSTGRES_DB:-kni_db} > /backups/backup_$$(date +%Y%m%d_%H%M%S).sql
      find /backups -name "backup_*.sql" -mtime +7 -delete
      sleep 86400
    done
  '
```

### 3. Deployment Platform Configuration

#### For Coolify:

1. Go to your project environment variables
2. Set the following variables:
   - `POSTGRES_USER=kni_user`
   - `POSTGRES_DB=kni_db`
   - `POSTGRES_PASSWORD=your_secure_password`
   - Update `DATABASE_URL` and `DIRECT_URL` accordingly

#### For Docker Swarm/Compose:

1. Create a `.env` file with production values
2. Ensure environment variable substitution works correctly

### 4. Database Initialization

If the database needs to be recreated:

```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Remove old volume (WARNING: This deletes all data)
docker volume rm $(docker-compose -f docker-compose.prod.yml config --volumes)

# Recreate with correct configuration
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for initialization and check logs
docker-compose -f docker-compose.prod.yml logs postgres
```

### 5. Verification Commands

```bash
# Check if environment variables are set correctly
docker exec kni-platform-postgres env | grep POSTGRES

# Test database connection
docker exec kni-platform-postgres psql -U kni_user -d kni_db -c "SELECT version();"

# Check backup service logs
docker-compose -f docker-compose.prod.yml logs db-backup
```

## Prevention

1. **Environment Variable Validation**: Add startup checks to verify all
   required environment variables are set
2. **Health Checks**: The existing health checks should catch these issues early
3. **Documentation**: Keep environment variable documentation up to date

## Quick Fix for Immediate Deployment

If you need a quick fix and can't change environment variables immediately, you
can temporarily modify the production config to use `postgres` user:

```yaml
# In docker-compose.prod.yml, change defaults to:
POSTGRES_USER: ${POSTGRES_USER:-postgres}
POSTGRES_DB: ${POSTGRES_DB:-postgres}
```

But this is **not recommended** for production - use proper environment variable
configuration instead.

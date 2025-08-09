# Quick Fix for PostgreSQL Authentication Error

## 🚨 Issue

Deployment logs show:

```
pg_dump: error: connection to server at "postgres" (10.0.7.3), port 5432 failed: FATAL: password authentication failed for user "postgres"
FATAL: role "postgres" does not exist
```

## 🔧 Immediate Fix Steps

### 1. Set Correct Environment Variables

In your deployment platform (Coolify, Docker, etc.), ensure these variables are
set:

```bash
# Critical Database Variables
POSTGRES_USER=kni_user
POSTGRES_DB=kni_db
POSTGRES_PASSWORD=your_secure_password_here

# Update Connection URLs
DATABASE_URL=postgresql://kni_user:your_secure_password_here@postgres:5432/kni_db
DIRECT_URL=postgresql://kni_user:your_secure_password_here@postgres:5432/kni_db
```

### 2. Validate Configuration

Run the validation script before deployment:

```bash
npm run validate:prod
```

### 3. Deploy with Production Config

```bash
# Use production docker-compose file
docker-compose -f docker-compose.prod.yml up -d

# Or with npm script
npm run docker:prod:up
```

### 4. Verify Database Connection

```bash
# Check container logs
npm run docker:prod:logs

# Test database connection
docker exec kni-platform-postgres psql -U kni_user -d kni_db -c "SELECT version();"
```

## 🔍 Root Cause

The production configuration (`docker-compose.prod.yml`) expects:

- **User**: `kni_user` (not `postgres`)
- **Database**: `kni_db` (not `postgres`)

But the deployment environment was missing these environment variables, causing
the system to try connecting with the wrong credentials.

## 📋 Prevention Checklist

- [ ] Environment variables are set in deployment platform
- [ ] `DATABASE_URL` matches `POSTGRES_USER` and `POSTGRES_DB`
- [ ] `DIRECT_URL` is consistent with `DATABASE_URL`
- [ ] Validation script passes: `npm run validate:prod`
- [ ] Production Docker Compose file is used
- [ ] Database health checks are working

## 🛠️ Files Updated

1. **`docker-compose.prod.yml`** - Enhanced backup service with better error
   handling
2. **`scripts/validate-production-env.js`** - New validation script
3. **`package.json`** - Added production deployment scripts
4. **`PRODUCTION_DEPLOYMENT_FIX.md`** - Detailed troubleshooting guide

## 🚀 Quick Commands

```bash
# Validate environment
npm run validate:prod

# Deploy to production
npm run docker:prod:up

# Check logs
npm run docker:prod:logs

# Stop production
npm run docker:prod:down
```

---

**Need more help?** See `PRODUCTION_DEPLOYMENT_FIX.md` for detailed
troubleshooting steps.

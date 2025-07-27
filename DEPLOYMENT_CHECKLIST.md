# KNI Platform - Deployment Checklist

Use this checklist to ensure a successful deployment to Coolify.

## Pre-Deployment Checklist

### 📋 Code Preparation
- [ ] All code changes committed and pushed to GitHub
- [ ] Tests are passing locally (`npm run test:ci`)
- [ ] Build is successful (`npm run build`)
- [ ] TypeScript compilation is clean (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Security audit is clean (`npm run security:audit`)

### 🔧 Environment Configuration
- [ ] `.env.production` file reviewed and updated
- [ ] All required environment variables identified
- [ ] Strong passwords and secrets generated
- [ ] Domain name configured and DNS pointing to server
- [ ] SSL certificate requirements understood

### 🖥️ Server Preparation
- [ ] Server meets minimum requirements (2 CPU, 4GB RAM, 50GB storage)
- [ ] Docker and Docker Compose installed
- [ ] Coolify installed and accessible
- [ ] Firewall configured (ports 80, 443, 22 open)
- [ ] Server has sufficient disk space

## Deployment Checklist

### 🚀 Coolify Setup
- [ ] Coolify project created
- [ ] GitHub repository connected
- [ ] Build configuration set:
  - [ ] Docker Compose file: `docker-compose.prod.yml`
  - [ ] Build context: `.`
  - [ ] Dockerfile: `Dockerfile`

### 🔐 Environment Variables
- [ ] **Required variables configured in Coolify:**
  - [ ] `NODE_ENV=production`
  - [ ] `DATABASE_URL` (PostgreSQL connection string)
  - [ ] `DIRECT_URL` (same as DATABASE_URL)
  - [ ] `JWT_SECRET` (32+ characters)
  - [ ] `NEXTAUTH_SECRET` (32+ characters)
  - [ ] `NEXTAUTH_URL` (your domain URL)
  - [ ] `NEXT_PUBLIC_APP_URL` (your domain URL)
  - [ ] `POSTGRES_DB` (database name)
  - [ ] `POSTGRES_USER` (database user)
  - [ ] `POSTGRES_PASSWORD` (strong password)
  - [ ] `REDIS_PASSWORD` (strong password)

- [ ] **Optional variables (as needed):**
  - [ ] `OPENAI_API_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - [ ] `SENDGRID_API_KEY`
  - [ ] `EMAIL_FROM`
  - [ ] AWS S3 credentials (if using cloud storage)

### 🌐 Domain Configuration
- [ ] Domain added in Coolify
- [ ] DNS A record pointing to server IP
- [ ] SSL/TLS enabled (Let's Encrypt)
- [ ] HTTPS redirect enabled
- [ ] DNS propagation completed (check with `nslookup your-domain.com`)

### 🚀 Initial Deployment
- [ ] First deployment triggered in Coolify
- [ ] Build logs monitored for errors
- [ ] All containers started successfully
- [ ] Database migrations completed
- [ ] Health check endpoint responding (`/api/health`)

## Post-Deployment Checklist

### ✅ Verification
- [ ] Application accessible at domain URL
- [ ] HTTPS working correctly
- [ ] Health check endpoint returns 200 status
- [ ] Database connection working
- [ ] Redis connection working
- [ ] File uploads working (if applicable)
- [ ] Authentication working
- [ ] All main features functional

### 📊 Monitoring Setup
- [ ] Application logs accessible in Coolify
- [ ] Database logs monitored
- [ ] Error tracking configured (if using Sentry)
- [ ] Performance monitoring active
- [ ] Backup schedule verified

### 🔒 Security Verification
- [ ] Security headers present (check with browser dev tools)
- [ ] Rate limiting active
- [ ] CSRF protection enabled
- [ ] No sensitive data in logs
- [ ] Environment variables not exposed in client

### 📈 Performance Check
- [ ] Page load times acceptable (<3 seconds)
- [ ] Database queries optimized
- [ ] Static assets cached properly
- [ ] CDN configured (if applicable)
- [ ] Lighthouse score acceptable (>90)

## Troubleshooting Checklist

### 🐛 Common Issues
- [ ] **Build Failures:**
  - [ ] Check build logs in Coolify
  - [ ] Verify all dependencies installed
  - [ ] Check Docker resource limits
  - [ ] Verify Dockerfile syntax

- [ ] **Database Issues:**
  - [ ] Verify PostgreSQL container running
  - [ ] Check database credentials
  - [ ] Test database connection
  - [ ] Check migration status

- [ ] **SSL Certificate Issues:**
  - [ ] Verify domain DNS configuration
  - [ ] Check Let's Encrypt rate limits
  - [ ] Wait for certificate generation
  - [ ] Check Coolify SSL settings

- [ ] **Application Not Starting:**
  - [ ] Check application logs
  - [ ] Verify environment variables
  - [ ] Check resource limits
  - [ ] Test health check endpoint

### 🔧 Useful Commands
```bash
# Check container status
docker ps

# View application logs
docker logs kni-platform-app

# Access application container
docker exec -it kni-platform-app sh

# Check database
docker exec -it kni-platform-postgres psql -U kni_user -d kni_db

# Test health endpoint
curl -f https://your-domain.com/api/health

# Check DNS
nslookup your-domain.com

# Test SSL
openssl s_client -connect your-domain.com:443
```

## Rollback Plan

### 🔄 If Deployment Fails
- [ ] Identify the issue from logs
- [ ] Revert to previous working version in Coolify
- [ ] Restore database backup if needed
- [ ] Verify rollback successful
- [ ] Investigate and fix issues
- [ ] Plan next deployment attempt

### 📦 Backup Verification
- [ ] Database backups are running
- [ ] File upload backups are working
- [ ] Backup restoration tested
- [ ] Backup retention policy configured

## Maintenance Schedule

### 📅 Regular Tasks
- [ ] **Daily:** Monitor application health and logs
- [ ] **Weekly:** Check security updates and patches
- [ ] **Monthly:** Review performance metrics and optimize
- [ ] **Quarterly:** Update dependencies and security audit

### 🔄 Update Process
- [ ] Test updates in staging environment
- [ ] Schedule maintenance window
- [ ] Create backup before updates
- [ ] Deploy updates during low traffic
- [ ] Monitor post-update performance

---

## Emergency Contacts

- **Server Admin:** [Your contact info]
- **Database Admin:** [Your contact info]
- **Application Developer:** [Your contact info]
- **Domain/DNS Provider:** [Provider contact]

## Resources

- [Coolify Documentation](https://coolify.io/docs)
- [KNI Platform Deployment Guide](./COOLIFY_DEPLOYMENT.md)
- [Application Health Check](https://your-domain.com/api/health)
- [Coolify Dashboard](http://your-server-ip:8000)

---

**✅ Deployment Complete!** 

Once all items are checked, your KNI Platform should be successfully deployed and running on Coolify! 🚀
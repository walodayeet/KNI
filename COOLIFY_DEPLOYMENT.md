# KNI Platform - Coolify Deployment Guide

This guide will help you deploy the KNI Platform on your self-hosted server using Coolify with GitHub integration.

## Prerequisites

### Server Requirements
- **CPU**: Minimum 2 cores (4 cores recommended)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: Minimum 50GB SSD
- **OS**: Ubuntu 20.04+ or any Docker-compatible Linux distribution
- **Network**: Public IP address with ports 80, 443, and 22 open

### Software Requirements
- Docker and Docker Compose installed
- Coolify installed and configured
- Domain name pointing to your server (optional but recommended)
- GitHub repository access

## Step 1: Coolify Installation

If you haven't installed Coolify yet, run this command on your server:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation, access Coolify at `http://your-server-ip:8000`

## Step 2: GitHub Repository Setup

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Coolify deployment"
   git push origin main
   ```

2. **Create a GitHub Personal Access Token**:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate a new token with `repo` permissions
   - Save the token securely

## Step 3: Coolify Project Setup

1. **Login to Coolify** and create a new project
2. **Add a new application**:
   - Choose "Docker Compose" as the application type
   - Connect your GitHub repository
   - Select the branch (usually `main`)
   - Set the build pack to "Docker Compose"

3. **Configure the build settings**:
   - Docker Compose file: `docker-compose.prod.yml`
   - Build context: `.`
   - Dockerfile: `Dockerfile`

## Step 4: Environment Variables Configuration

In Coolify, navigate to your application's environment variables section and add the following:

### Required Variables
```env
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=KNI Platform

# Database
DATABASE_URL=postgresql://kni_user:your_secure_password@postgres:5432/kni_db
DIRECT_URL=postgresql://kni_user:your_secure_password@postgres:5432/kni_db
POSTGRES_DB=kni_db
POSTGRES_USER=kni_user
POSTGRES_PASSWORD=your_secure_password

# Security (Generate strong secrets)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
NEXTAUTH_SECRET=your-nextauth-secret-minimum-32-characters-long
CSRF_SECRET=your-csrf-secret-here
ENCRYPTION_KEY=your-32-char-encryption-key-here

# Redis
REDIS_URL=redis://:your_redis_password@redis:6379
REDIS_PASSWORD=your_redis_password
```

### Optional Variables (Add as needed)
```env
# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-publishable-key

# Email
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@your-domain.com

# MinIO (Self-hosted S3-compatible storage)
MINIO_ACCESS_KEY=your_minio_access_key_here
MINIO_SECRET_KEY=your_minio_secret_key_here_minimum_8_chars
MINIO_BUCKET=kni-uploads
MINIO_ENDPOINT=http://minio:9000
MINIO_USE_SSL=false

# AWS S3 (Alternative cloud storage)
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=your-access-key
AWS_S3_SECRET_ACCESS_KEY=your-secret-key
```

## Step 5: Domain Configuration

1. **Add your domain** in Coolify:
   - Go to your application settings
   - Add your domain name
   - Enable SSL/TLS (Let's Encrypt)

2. **DNS Configuration**:
   - Point your domain's A record to your server's IP address
   - Wait for DNS propagation (can take up to 24 hours)

## Step 6: Deploy the Application

1. **Initial Deployment**:
   - Click "Deploy" in Coolify
   - Monitor the build logs for any errors
   - The first deployment may take 5-10 minutes

2. **Database Migration**:
   - After the first successful deployment, run database migrations:
   ```bash
   # Connect to your application container
   docker exec -it kni-platform-app npx prisma migrate deploy
   ```

## Step 7: Post-Deployment Configuration

### Health Check
1. Visit `https://your-domain.com/api/health` to verify the application is running
2. Check all services are healthy in Coolify dashboard

### Database Seeding (Optional)
```bash
# Seed the database with initial data
docker exec -it kni-platform-app npm run db:seed
```

### MinIO Setup
1. **Access MinIO Console**:
   - Visit `http://your-server-ip:9001` or `https://your-domain.com:9001`
   - Login with your `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`

2. **Create Bucket**:
   - Create a bucket named `kni-uploads` (or your configured bucket name)
   - Set bucket policy to allow public read access for uploaded files

3. **Configure Bucket Policy** (Optional):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {"AWS": "*"},
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::kni-uploads/*"
       }
     ]
   }
   ```

### SSL Certificate
- Coolify should automatically generate SSL certificates
- Verify HTTPS is working at your domain

## Step 8: Monitoring and Maintenance

### Application Logs
- View logs in Coolify dashboard
- Monitor for errors and performance issues

### Database Backups
- Backups are automatically configured in `docker-compose.prod.yml`
- Backups are stored in the `./backups` directory
- Retention: 7 days (configurable)

### Updates and Deployments
- Push changes to your GitHub repository
- Coolify will automatically detect changes and redeploy
- Or manually trigger deployments from Coolify dashboard

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check build logs in Coolify
   - Verify all environment variables are set
   - Ensure Docker has enough resources

2. **Database Connection Issues**:
   - Verify PostgreSQL container is running
   - Check database credentials
   - Ensure network connectivity between containers

3. **SSL Certificate Issues**:
   - Verify domain DNS is pointing to your server
   - Check Coolify SSL settings
   - Wait for certificate generation (can take a few minutes)

4. **Application Not Starting**:
   - Check application logs
   - Verify all required environment variables
   - Check resource limits

### Useful Commands

```bash
# View application logs
docker logs kni-platform-app

# View database logs
docker logs kni-platform-postgres

# Access application container
docker exec -it kni-platform-app sh

# Access database
docker exec -it kni-platform-postgres psql -U kni_user -d kni_db

# Restart services
docker-compose -f docker-compose.prod.yml restart

# View running containers
docker ps
```

## Security Considerations

1. **Environment Variables**:
   - Use strong, unique passwords
   - Never commit secrets to version control
   - Regularly rotate API keys and passwords

2. **Server Security**:
   - Keep your server updated
   - Use SSH keys instead of passwords
   - Configure firewall rules
   - Enable fail2ban for SSH protection

3. **Application Security**:
   - Regularly update dependencies
   - Monitor security advisories
   - Use HTTPS everywhere
   - Implement proper rate limiting

## Performance Optimization

1. **Resource Allocation**:
   - Monitor CPU and memory usage
   - Adjust container resource limits as needed
   - Consider scaling horizontally for high traffic

2. **Database Optimization**:
   - Regular database maintenance
   - Monitor query performance
   - Consider read replicas for high read workloads

3. **Caching**:
   - Redis is configured for caching
   - Monitor cache hit rates
   - Adjust cache TTL values as needed

## Support and Resources

- **Coolify Documentation**: https://coolify.io/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Deployment**: https://www.prisma.io/docs/guides/deployment
- **Docker Compose**: https://docs.docker.com/compose/

## Backup and Recovery

### Automated Backups
- Database backups run daily at 2 AM
- File uploads are backed up with persistent volumes
- Logs are rotated and archived

### Manual Backup
```bash
# Create manual database backup
docker exec kni-platform-postgres pg_dump -U kni_user kni_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/
```

### Recovery
```bash
# Restore database from backup
docker exec -i kni-platform-postgres psql -U kni_user -d kni_db < backup_file.sql

# Restore uploaded files
tar -xzf uploads_backup.tar.gz
```

Congratulations! Your KNI Platform should now be successfully deployed on Coolify. 🚀
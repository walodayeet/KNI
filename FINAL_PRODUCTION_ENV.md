# Final Production Environment Configuration

## 🎯 Complete Production Environment Variables

With your domain `https://kni.caukieuai.site`, here's your complete,
ready-to-deploy configuration:

```bash
# =============================================================================
# KNI Platform - Final Production Environment Configuration
# Domain: https://kni.caukieuai.site
# =============================================================================

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=KNI Platform

# Application URLs (UPDATED WITH YOUR DOMAIN)
NEXTAUTH_URL=https://kni.caukieuai.site
NEXT_PUBLIC_APP_URL=https://kni.caukieuai.site

# Database Configuration (set passwords in Coolify envs)
DATABASE_URL=postgresql://kni_user:${POSTGRES_PASSWORD}@postgres:5432/kni_db
DIRECT_URL=postgresql://kni_user:${POSTGRES_PASSWORD}@postgres:5432/kni_db
POSTGRES_DB=kni_db
POSTGRES_USER=kni_user
POSTGRES_PASSWORD=<SET_IN_COOLIFY>

# Authentication & Security (generate strong secrets in Coolify)
JWT_SECRET=<SET_IN_COOLIFY_MIN_32_CHARS>
NEXTAUTH_SECRET=<SET_IN_COOLIFY_MIN_32_CHARS>

# Redis Configuration
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=<SET_IN_COOLIFY>

# Email Configuration
EMAIL_FROM=noreply@kni.caukieuai.site
SENDGRID_API_KEY=<SET_IN_COOLIFY>

# File Storage (MinIO)
UPLOAD_PROVIDER=minio
MINIO_ACCESS_KEY=<SET_IN_COOLIFY>
MINIO_SECRET_KEY=<SET_IN_COOLIFY>
MINIO_BUCKET=kni
MINIO_ENDPOINT=https://minio.caukieuai.com
MINIO_USE_SSL=true

# Optional Features (Add if needed)
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# AWS S3 (Optional - Leave empty since using MinIO)
AWS_S3_ACCESS_KEY_ID=
AWS_S3_BUCKET=
AWS_S3_REGION=
AWS_S3_SECRET_ACCESS_KEY=
```

## 🚨 Only One Thing Left to Do

**Get SendGrid API Key:**

1. Go to [SendGrid](https://sendgrid.com/)
2. Sign up for a free account
3. Create an API key
4. Replace `<SET_IN_COOLIFY>` with your actual key in Coolify envs

## 🧪 Test Your Configuration

Run this command to validate everything locally (use placeholders):

```bash
# Example (do not commit real secrets)
$env:DATABASE_URL='postgresql://kni_user:***@postgres:5432/kni_db'
$env:DIRECT_URL='postgresql://kni_user:***@postgres:5432/kni_db'
$env:POSTGRES_DB='kni_db'
$env:POSTGRES_USER='kni_user'
$env:POSTGRES_PASSWORD='***'
$env:JWT_SECRET='***'
$env:NEXTAUTH_SECRET='***'
$env:NEXTAUTH_URL='https://kni.caukieuai.site'
$env:NEXT_PUBLIC_APP_URL='https://kni.caukieuai.site'
$env:NEXT_PUBLIC_APP_NAME='KNI Platform'
$env:REDIS_URL='redis://:***@redis:6379'
$env:REDIS_PASSWORD='***'
$env:EMAIL_FROM='noreply@kni.caukieuai.site'
$env:SENDGRID_API_KEY='***'
$env:MINIO_ACCESS_KEY='***'
$env:MINIO_SECRET_KEY='***'
$env:MINIO_BUCKET='kni'
$env:MINIO_ENDPOINT='https://minio.caukieuai.com'
$env:MINIO_USE_SSL='true'
$env:UPLOAD_PROVIDER='minio'
npm run validate:prod
```

## 🚀 Deploy to Production

Once your secrets are set in Coolify:

```bash
# Deploy with production configuration
npm run docker:prod:up

# Check logs
npm run docker:prod:logs

# Your app will be available at: https://kni.caukieuai.site
```

## 📋 Deployment Checklist

- [x] Domain configured: `https://kni.caukieuai.site`
- [x] Database URLs use service name `postgres`
- [x] Redis URL uses service name `redis`
- [x] Email from address set
- [x] MinIO configuration ready
- [x] Strong secrets configured in Coolify
- [ ] Set environment variables in your deployment platform
- [ ] Run validation: `npm run validate:prod`
- [ ] Deploy: `npm run docker:prod:up`
- [ ] Test application at `https://kni.caukieuai.site`

## 🔒 Security Notes

✅ Do not commit secrets; set them in Coolify only. ✅ Use HTTPS domain. ✅ Use
strong JWT and NextAuth secrets. ✅ MinIO over SSL.

## 🎉 Ready for Production!

Your configuration is ready. Set secrets in Coolify and deploy!

---

**Questions?** All the troubleshooting guides are available in the other
documentation files if you encounter any issues.

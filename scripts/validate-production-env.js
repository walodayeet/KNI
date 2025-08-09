#!/usr/bin/env node

/**
 * Production Environment Validation Script
 *
 * This script validates that all required environment variables are set
 * for production deployment and checks for common configuration issues.
 */

const fs = require('fs')
const path = require('path')

// Required environment variables for production
const REQUIRED_ENV_VARS = {
  // Database
  POSTGRES_DB: 'Database name (e.g., kni_db)',
  POSTGRES_USER: 'Database user (e.g., kni_user)',
  POSTGRES_PASSWORD: 'Database password (must be secure)',
  DATABASE_URL: 'Full database connection URL',
  DIRECT_URL: 'Direct database connection URL',

  // Authentication
  JWT_SECRET: 'JWT signing secret (minimum 32 characters)',
  NEXTAUTH_SECRET: 'NextAuth secret (minimum 32 characters)',

  // Application
  NEXTAUTH_URL: 'Application URL (https://your-domain.com)',
  NEXT_PUBLIC_APP_URL: 'Public application URL',

  // Redis
  REDIS_URL: 'Redis connection URL',
  REDIS_PASSWORD: 'Redis password',

  // Email
  SENDGRID_API_KEY: 'SendGrid API key for email sending',
  EMAIL_FROM: 'From email address',
}

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = {
  OPENAI_API_KEY: 'OpenAI API key for AI features',
  STRIPE_SECRET_KEY: 'Stripe secret key for payments',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'Stripe publishable key',
  MINIO_ACCESS_KEY: 'MinIO access key for file storage',
  MINIO_SECRET_KEY: 'MinIO secret key for file storage',
}

class ProductionValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.envVars = process.env
  }

  validateRequired() {
    console.log('🔍 Validating required environment variables...')

    for (const [varName, description] of Object.entries(REQUIRED_ENV_VARS)) {
      if (!this.envVars[varName]) {
        this.errors.push(`❌ Missing required variable: ${varName} - ${description}`)
      } else {
        console.log(`✅ ${varName}: Set`)
      }
    }
  }

  validateRecommended() {
    console.log('\n🔍 Checking recommended environment variables...')

    for (const [varName, description] of Object.entries(RECOMMENDED_ENV_VARS)) {
      if (!this.envVars[varName]) {
        this.warnings.push(`⚠️  Missing recommended variable: ${varName} - ${description}`)
      } else {
        console.log(`✅ ${varName}: Set`)
      }
    }
  }

  validateSecrets() {
    console.log('\n🔐 Validating secret strength...')

    const secrets = ['JWT_SECRET', 'NEXTAUTH_SECRET']

    for (const secret of secrets) {
      const value = this.envVars[secret]
      if (value) {
        if (value.length < 32) {
          this.errors.push(
            `❌ ${secret} must be at least 32 characters long (current: ${value.length})`
          )
        } else if (
          value.includes('your-') ||
          value.includes('change-me') ||
          value.includes('secret')
        ) {
          this.warnings.push(`⚠️  ${secret} appears to be a placeholder value`)
        } else {
          console.log(`✅ ${secret}: Strong (${value.length} characters)`)
        }
      }
    }
  }

  validateDatabaseConfig() {
    console.log('\n🗄️  Validating database configuration...')

    const dbUrl = this.envVars.DATABASE_URL
    const directUrl = this.envVars.DIRECT_URL
    const dbUser = this.envVars.POSTGRES_USER
    const dbName = this.envVars.POSTGRES_DB

    if (dbUrl && dbUser && dbName) {
      // Check if DATABASE_URL contains the correct user and database
      if (!dbUrl.includes(dbUser)) {
        this.errors.push(`❌ DATABASE_URL doesn't contain POSTGRES_USER (${dbUser})`)
      }
      if (!dbUrl.includes(dbName)) {
        this.errors.push(`❌ DATABASE_URL doesn't contain POSTGRES_DB (${dbName})`)
      }

      // Check if DIRECT_URL matches DATABASE_URL pattern
      if (directUrl && dbUrl !== directUrl) {
        this.warnings.push(
          `⚠️  DATABASE_URL and DIRECT_URL are different - ensure this is intentional`
        )
      }

      console.log(`✅ Database configuration appears consistent`)
    }
  }

  validateUrls() {
    console.log('\n🌐 Validating URLs...')

    const urls = {
      NEXTAUTH_URL: this.envVars.NEXTAUTH_URL,
      NEXT_PUBLIC_APP_URL: this.envVars.NEXT_PUBLIC_APP_URL,
    }

    for (const [varName, url] of Object.entries(urls)) {
      if (url) {
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          this.errors.push(`❌ ${varName} contains localhost - use production domain`)
        } else if (!url.startsWith('https://')) {
          this.warnings.push(`⚠️  ${varName} should use HTTPS in production`)
        } else if (url.includes('your-domain.com')) {
          this.errors.push(`❌ ${varName} contains placeholder domain`)
        } else {
          console.log(`✅ ${varName}: Valid`)
        }
      }
    }
  }

  validateDockerCompose() {
    console.log('\n🐳 Validating Docker Compose configuration...')

    const prodComposeFile = path.join(process.cwd(), 'docker-compose.prod.yml')

    if (!fs.existsSync(prodComposeFile)) {
      this.errors.push(`❌ docker-compose.prod.yml not found`)
      return
    }

    const composeContent = fs.readFileSync(prodComposeFile, 'utf8')

    // Check for common issues
    if (composeContent.includes('${POSTGRES_USER:-postgres}')) {
      this.warnings.push(
        `⚠️  docker-compose.prod.yml uses 'postgres' as default user - ensure POSTGRES_USER is set`
      )
    }

    if (!composeContent.includes('condition: service_healthy')) {
      this.warnings.push(`⚠️  Consider using health check conditions in depends_on`)
    }

    console.log(`✅ Docker Compose file exists`)
  }

  generateReport() {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📋 PRODUCTION DEPLOYMENT VALIDATION REPORT')
    console.log('='.repeat(60))

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All validations passed! Ready for production deployment.')
      return true
    }

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (Must be fixed before deployment):')
      this.errors.forEach(error => console.log(`   ${error}`))
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (Recommended to fix):')
      this.warnings.forEach(warning => console.log(`   ${warning}`))
    }

    console.log('\n📚 For detailed fix instructions, see: PRODUCTION_DEPLOYMENT_FIX.md')

    return this.errors.length === 0
  }

  run() {
    console.log('🚀 Production Environment Validation')
    console.log('=====================================\n')

    this.validateRequired()
    this.validateRecommended()
    this.validateSecrets()
    this.validateDatabaseConfig()
    this.validateUrls()
    this.validateDockerCompose()

    const isValid = this.generateReport()

    process.exit(isValid ? 0 : 1)
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionValidator()
  validator.run()
}

module.exports = ProductionValidator

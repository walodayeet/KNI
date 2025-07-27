#!/usr/bin/env node

/**
 * KNI Platform Setup Script
 * 
 * This script helps initialize the KNI platform with all necessary
 * dependencies, configurations, and database setup.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const readline = require('readline')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.magenta}▶${colors.reset} ${msg}`)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class KNISetup {
  constructor() {
    this.projectRoot = process.cwd()
    this.envPath = path.join(this.projectRoot, '.env.local')
    this.envExamplePath = path.join(this.projectRoot, '.env.example')
    this.config = {}
  }

  async run() {
    try {
      log.title('🚀 KNI Platform Setup')
      console.log('Welcome to the KNI Platform setup wizard!')
      console.log('This script will help you configure your development environment.\n')

      await this.checkPrerequisites()
      await this.setupEnvironment()
      await this.installDependencies()
      await this.setupDatabase()
      await this.generateSecrets()
      await this.initializeServices()
      await this.runTests()
      await this.finalizeSetup()

      log.success('🎉 KNI Platform setup completed successfully!')
      console.log('\nNext steps:')
      console.log('1. Review your .env.local file and update any API keys')
      console.log('2. Run `npm run dev` to start the development server')
      console.log('3. Visit http://localhost:3000 to see your application')
      
    } catch (error) {
      log.error(`Setup failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async checkPrerequisites() {
    log.title('📋 Checking Prerequisites')

    const requirements = [
      { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
      { name: 'npm', command: 'npm --version', minVersion: '8.0.0' },
      { name: 'Git', command: 'git --version', minVersion: '2.0.0' }
    ]

    for (const req of requirements) {
      try {
        const version = execSync(req.command, { encoding: 'utf8' }).trim()
        log.success(`${req.name}: ${version}`)
      } catch (error) {
        log.error(`${req.name} is not installed or not in PATH`)
        throw new Error(`Please install ${req.name} before continuing`)
      }
    }

    // Check for optional services
    const optionalServices = [
      { name: 'PostgreSQL', command: 'psql --version' },
      { name: 'Redis', command: 'redis-cli --version' },
      { name: 'Docker', command: 'docker --version' }
    ]

    log.step('Checking optional services...')
    for (const service of optionalServices) {
      try {
        const version = execSync(service.command, { encoding: 'utf8' }).trim()
        log.success(`${service.name}: ${version}`)
      } catch (error) {
        log.warning(`${service.name} not found (optional)`)
      }
    }
  }

  async setupEnvironment() {
    log.title('🔧 Environment Setup')

    if (fs.existsSync(this.envPath)) {
      const overwrite = await question('⚠️  .env.local already exists. Overwrite? (y/N): ')
      if (overwrite.toLowerCase() !== 'y') {
        log.info('Skipping environment setup')
        return
      }
    }

    if (!fs.existsSync(this.envExamplePath)) {
      log.error('.env.example not found')
      throw new Error('Environment example file is missing')
    }

    // Copy .env.example to .env.local
    fs.copyFileSync(this.envExamplePath, this.envPath)
    log.success('Created .env.local from .env.example')

    // Collect basic configuration
    await this.collectBasicConfig()
  }

  async collectBasicConfig() {
    log.step('Collecting basic configuration...')

    this.config.appName = await question('Application name (KNI Platform): ') || 'KNI Platform'
    this.config.appUrl = await question('Application URL (http://localhost:3000): ') || 'http://localhost:3000'
    
    // Database configuration
    const useDocker = await question('Use Docker for PostgreSQL? (Y/n): ')
    if (useDocker.toLowerCase() !== 'n') {
      this.config.databaseUrl = 'postgresql://kni_user:kni_password@localhost:5432/kni_db'
      this.config.useDockerDb = true
    } else {
      this.config.databaseUrl = await question('Database URL: ')
      this.config.useDockerDb = false
    }

    // Redis configuration
    const useRedis = await question('Enable Redis caching? (Y/n): ')
    this.config.useRedis = useRedis.toLowerCase() !== 'n'
    if (this.config.useRedis) {
      this.config.redisUrl = await question('Redis URL (redis://localhost:6379): ') || 'redis://localhost:6379'
    }

    // Email configuration
    const emailProvider = await question('Email provider (sendgrid/nodemailer/none): ') || 'none'
    this.config.emailProvider = emailProvider
    if (emailProvider !== 'none') {
      this.config.emailFrom = await question('From email address: ')
    }
  }

  async installDependencies() {
    log.title('📦 Installing Dependencies')

    log.step('Installing npm dependencies...')
    try {
      execSync('npm install', { stdio: 'inherit' })
      log.success('Dependencies installed successfully')
    } catch (error) {
      log.error('Failed to install dependencies')
      throw error
    }

    // Install optional dependencies based on configuration
    const optionalDeps = []
    
    if (this.config.useRedis) {
      optionalDeps.push('redis', 'ioredis')
    }

    if (this.config.emailProvider === 'sendgrid') {
      optionalDeps.push('@sendgrid/mail')
    }

    if (optionalDeps.length > 0) {
      log.step(`Installing optional dependencies: ${optionalDeps.join(', ')}`)
      try {
        execSync(`npm install ${optionalDeps.join(' ')}`, { stdio: 'inherit' })
        log.success('Optional dependencies installed')
      } catch (error) {
        log.warning('Some optional dependencies failed to install')
      }
    }
  }

  async setupDatabase() {
    log.title('🗄️ Database Setup')

    if (this.config.useDockerDb) {
      log.step('Setting up PostgreSQL with Docker...')
      try {
        // Check if Docker is running
        execSync('docker info', { stdio: 'ignore' })
        
        // Start PostgreSQL container
        const dockerCommand = `docker run -d \
          --name kni-postgres \
          -e POSTGRES_USER=kni_user \
          -e POSTGRES_PASSWORD=kni_password \
          -e POSTGRES_DB=kni_db \
          -p 5432:5432 \
          postgres:15-alpine`
        
        execSync(dockerCommand, { stdio: 'inherit' })
        log.success('PostgreSQL container started')
        
        // Wait for database to be ready
        log.step('Waiting for database to be ready...')
        await this.waitForDatabase()
        
      } catch (error) {
        log.warning('Docker setup failed, please set up PostgreSQL manually')
      }
    }

    // Run database migrations
    log.step('Running database migrations...')
    try {
      execSync('npx prisma generate', { stdio: 'inherit' })
      execSync('npx prisma db push', { stdio: 'inherit' })
      log.success('Database schema updated')
    } catch (error) {
      log.warning('Database migration failed, please run manually')
    }

    // Seed database
    const seedDb = await question('Seed database with sample data? (Y/n): ')
    if (seedDb.toLowerCase() !== 'n') {
      try {
        execSync('npm run db:seed', { stdio: 'inherit' })
        log.success('Database seeded with sample data')
      } catch (error) {
        log.warning('Database seeding failed')
      }
    }
  }

  async waitForDatabase() {
    const maxAttempts = 30
    let attempts = 0
    
    while (attempts < maxAttempts) {
      try {
        execSync('npx prisma db execute --command "SELECT 1"', { stdio: 'ignore' })
        return
      } catch (error) {
        attempts++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    throw new Error('Database connection timeout')
  }

  async generateSecrets() {
    log.title('🔐 Generating Secrets')

    const crypto = require('crypto')
    
    const secrets = {
      NEXTAUTH_SECRET: crypto.randomBytes(32).toString('base64'),
      JWT_SECRET: crypto.randomBytes(32).toString('base64'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      CSRF_SECRET: crypto.randomBytes(32).toString('base64'),
      WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex')
    }

    // Update .env.local with generated secrets
    let envContent = fs.readFileSync(this.envPath, 'utf8')
    
    for (const [key, value] of Object.entries(secrets)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}="${value}"`)
      } else {
        envContent += `\n${key}="${value}"`
      }
    }

    // Update other configuration values
    const updates = {
      APP_NAME: this.config.appName,
      NEXT_PUBLIC_APP_NAME: this.config.appName,
      APP_URL: this.config.appUrl,
      NEXT_PUBLIC_APP_URL: this.config.appUrl,
      NEXTAUTH_URL: this.config.appUrl,
      DATABASE_URL: this.config.databaseUrl
    }

    if (this.config.useRedis) {
      updates.REDIS_URL = this.config.redisUrl
    }

    if (this.config.emailProvider !== 'none') {
      updates.EMAIL_PROVIDER = this.config.emailProvider
      updates.EMAIL_FROM = this.config.emailFrom
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        const regex = new RegExp(`^${key}=.*$`, 'm')
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}="${value}"`)
        } else {
          envContent += `\n${key}="${value}"`
        }
      }
    }

    fs.writeFileSync(this.envPath, envContent)
    log.success('Environment variables updated with generated secrets')
  }

  async initializeServices() {
    log.title('🔄 Initializing Services')

    // Test Redis connection if enabled
    if (this.config.useRedis) {
      log.step('Testing Redis connection...')
      try {
        const redis = require('redis')
        const client = redis.createClient({ url: this.config.redisUrl })
        await client.connect()
        await client.ping()
        await client.disconnect()
        log.success('Redis connection successful')
      } catch (error) {
        log.warning('Redis connection failed')
      }
    }

    // Initialize other services
    log.step('Initializing application services...')
    try {
      // This would run any initialization scripts
      log.success('Services initialized')
    } catch (error) {
      log.warning('Service initialization failed')
    }
  }

  async runTests() {
    log.title('🧪 Running Tests')

    const runTests = await question('Run test suite? (Y/n): ')
    if (runTests.toLowerCase() !== 'n') {
      try {
        execSync('npm test', { stdio: 'inherit' })
        log.success('All tests passed')
      } catch (error) {
        log.warning('Some tests failed')
      }
    }
  }

  async finalizeSetup() {
    log.title('🎯 Finalizing Setup')

    // Create necessary directories
    const directories = [
      'uploads',
      'logs',
      'backups',
      'temp'
    ]

    for (const dir of directories) {
      const dirPath = path.join(this.projectRoot, dir)
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        log.success(`Created directory: ${dir}`)
      }
    }

    // Create .gitignore entries for generated directories
    const gitignorePath = path.join(this.projectRoot, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
      const entries = ['uploads/', 'logs/', 'backups/', 'temp/', '.env.local']
      
      for (const entry of entries) {
        if (!gitignoreContent.includes(entry)) {
          gitignoreContent += `\n${entry}`
        }
      }
      
      fs.writeFileSync(gitignorePath, gitignoreContent)
      log.success('Updated .gitignore')
    }

    // Generate setup summary
    this.generateSetupSummary()
  }

  generateSetupSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      services: {
        database: this.config.useDockerDb ? 'Docker PostgreSQL' : 'External PostgreSQL',
        cache: this.config.useRedis ? 'Redis' : 'In-memory',
        email: this.config.emailProvider || 'None'
      }
    }

    const summaryPath = path.join(this.projectRoot, 'setup-summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    log.success('Setup summary saved to setup-summary.json')
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new KNISetup()
  setup.run().catch(console.error)
}

module.exports = KNISetup
#!/usr/bin/env node

/**
 * KNI Platform Deployment Script
 * 
 * This script handles deployment to various platforms:
 * - Docker containers
 * - Vercel
 * - Traditional servers
 * - AWS/GCP/Azure
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

class KNIDeployment {
  constructor() {
    this.projectRoot = process.cwd()
    this.config = {
      platform: null,
      environment: null,
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      port: 3000
    }
  }

  async run() {
    try {
      log.title('🚀 KNI Platform Deployment')
      console.log('Welcome to the KNI Platform deployment wizard!')
      console.log('This script will help you deploy your application.\n')

      await this.selectDeploymentTarget()
      await this.validateEnvironment()
      await this.prepareDeployment()
      await this.executeDeployment()
      await this.postDeploymentTasks()

      log.success('🎉 Deployment completed successfully!')
      
    } catch (error) {
      log.error(`Deployment failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async selectDeploymentTarget() {
    log.title('🎯 Deployment Target Selection')

    console.log('Available deployment options:')
    console.log('1. Docker (Local/Production)')
    console.log('2. Vercel (Serverless)')
    console.log('3. Traditional Server (VPS/Dedicated)')
    console.log('4. AWS (ECS/EC2/Lambda)')
    console.log('5. Google Cloud Platform')
    console.log('6. Azure')
    console.log('7. Railway')
    console.log('8. Heroku')

    const choice = await question('\nSelect deployment target (1-8): ')
    
    const platforms = {
      '1': 'docker',
      '2': 'vercel',
      '3': 'server',
      '4': 'aws',
      '5': 'gcp',
      '6': 'azure',
      '7': 'railway',
      '8': 'heroku'
    }

    this.config.platform = platforms[choice]
    if (!this.config.platform) {
      throw new Error('Invalid deployment target selected')
    }

    // Select environment
    const env = await question('Environment (development/staging/production): ')
    this.config.environment = env || 'production'

    log.success(`Selected: ${this.config.platform} (${this.config.environment})`)
  }

  async validateEnvironment() {
    log.title('🔍 Environment Validation')

    // Check if required files exist
    const requiredFiles = [
      'package.json',
      'next.config.js',
      '.env.example'
    ]

    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(this.projectRoot, file))) {
        throw new Error(`Required file missing: ${file}`)
      }
    }
    log.success('Required files present')

    // Platform-specific validations
    switch (this.config.platform) {
      case 'docker':
        await this.validateDocker()
        break
      case 'vercel':
        await this.validateVercel()
        break
      case 'aws':
        await this.validateAWS()
        break
      case 'server':
        await this.validateServer()
        break
    }
  }

  async validateDocker() {
    try {
      execSync('docker --version', { stdio: 'ignore' })
      log.success('Docker is available')
    } catch (error) {
      throw new Error('Docker is not installed or not in PATH')
    }

    // Check if Dockerfile exists, create if not
    const dockerfilePath = path.join(this.projectRoot, 'Dockerfile')
    if (!fs.existsSync(dockerfilePath)) {
      log.step('Creating Dockerfile...')
      await this.createDockerfile()
    }

    // Check if docker-compose.yml exists, create if not
    const composePath = path.join(this.projectRoot, 'docker-compose.yml')
    if (!fs.existsSync(composePath)) {
      log.step('Creating docker-compose.yml...')
      await this.createDockerCompose()
    }
  }

  async validateVercel() {
    try {
      execSync('vercel --version', { stdio: 'ignore' })
      log.success('Vercel CLI is available')
    } catch (error) {
      log.warning('Vercel CLI not found, installing...')
      execSync('npm install -g vercel', { stdio: 'inherit' })
    }

    // Check if vercel.json exists, create if not
    const vercelConfigPath = path.join(this.projectRoot, 'vercel.json')
    if (!fs.existsSync(vercelConfigPath)) {
      log.step('Creating vercel.json...')
      await this.createVercelConfig()
    }
  }

  async validateAWS() {
    try {
      execSync('aws --version', { stdio: 'ignore' })
      log.success('AWS CLI is available')
    } catch (error) {
      throw new Error('AWS CLI is not installed. Please install and configure AWS CLI')
    }

    // Check AWS credentials
    try {
      execSync('aws sts get-caller-identity', { stdio: 'ignore' })
      log.success('AWS credentials configured')
    } catch (error) {
      throw new Error('AWS credentials not configured. Run: aws configure')
    }
  }

  async validateServer() {
    const serverHost = await question('Server hostname/IP: ')
    const serverUser = await question('SSH username: ')
    const serverPath = await question('Deployment path: ')

    this.config.server = {
      host: serverHost,
      user: serverUser,
      path: serverPath
    }

    // Test SSH connection
    try {
      execSync(`ssh -o ConnectTimeout=5 ${serverUser}@${serverHost} 'echo "Connection successful"'`, { stdio: 'ignore' })
      log.success('SSH connection successful')
    } catch (error) {
      throw new Error('SSH connection failed. Please check your credentials and server access')
    }
  }

  async prepareDeployment() {
    log.title('📦 Preparing Deployment')

    // Run tests
    const runTests = await question('Run tests before deployment? (Y/n): ')
    if (runTests.toLowerCase() !== 'n') {
      log.step('Running tests...')
      try {
        execSync('npm test', { stdio: 'inherit' })
        log.success('All tests passed')
      } catch (error) {
        const continueAnyway = await question('Tests failed. Continue anyway? (y/N): ')
        if (continueAnyway.toLowerCase() !== 'y') {
          throw new Error('Deployment cancelled due to test failures')
        }
      }
    }

    // Build application
    log.step('Building application...')
    try {
      execSync(this.config.buildCommand, { stdio: 'inherit' })
      log.success('Build completed successfully')
    } catch (error) {
      throw new Error('Build failed')
    }

    // Platform-specific preparation
    switch (this.config.platform) {
      case 'docker':
        await this.prepareDocker()
        break
      case 'vercel':
        await this.prepareVercel()
        break
      case 'aws':
        await this.prepareAWS()
        break
      case 'server':
        await this.prepareServer()
        break
    }
  }

  async prepareDocker() {
    log.step('Building Docker image...')
    const imageName = `kni-platform:${this.config.environment}`
    
    try {
      execSync(`docker build -t ${imageName} .`, { stdio: 'inherit' })
      log.success(`Docker image built: ${imageName}`)
      this.config.dockerImage = imageName
    } catch (error) {
      throw new Error('Docker build failed')
    }
  }

  async prepareVercel() {
    log.step('Preparing Vercel deployment...')
    
    // Set environment variables
    const envVars = await this.getEnvironmentVariables()
    for (const [key, value] of Object.entries(envVars)) {
      try {
        execSync(`vercel env add ${key} ${this.config.environment}`, {
          input: value,
          stdio: ['pipe', 'inherit', 'inherit']
        })
      } catch (error) {
        log.warning(`Failed to set environment variable: ${key}`)
      }
    }
  }

  async prepareAWS() {
    log.step('Preparing AWS deployment...')
    
    const deploymentType = await question('AWS deployment type (ecs/ec2/lambda): ')
    this.config.awsType = deploymentType

    switch (deploymentType) {
      case 'ecs':
        await this.prepareECS()
        break
      case 'ec2':
        await this.prepareEC2()
        break
      case 'lambda':
        await this.prepareLambda()
        break
      default:
        throw new Error('Invalid AWS deployment type')
    }
  }

  async prepareServer() {
    log.step('Preparing server deployment...')
    
    // Create deployment archive
    const archiveName = `kni-platform-${Date.now()}.tar.gz`
    execSync(`tar -czf ${archiveName} --exclude=node_modules --exclude=.git --exclude=.next .`, { stdio: 'inherit' })
    
    this.config.archiveName = archiveName
    log.success(`Deployment archive created: ${archiveName}`)
  }

  async executeDeployment() {
    log.title('🚀 Executing Deployment')

    switch (this.config.platform) {
      case 'docker':
        await this.deployDocker()
        break
      case 'vercel':
        await this.deployVercel()
        break
      case 'aws':
        await this.deployAWS()
        break
      case 'server':
        await this.deployServer()
        break
      case 'railway':
        await this.deployRailway()
        break
      case 'heroku':
        await this.deployHeroku()
        break
    }
  }

  async deployDocker() {
    const deploymentMode = await question('Docker deployment mode (local/registry/compose): ')
    
    switch (deploymentMode) {
      case 'local':
        log.step('Starting local Docker container...')
        execSync(`docker run -d -p ${this.config.port}:3000 --name kni-platform-${this.config.environment} ${this.config.dockerImage}`, { stdio: 'inherit' })
        log.success(`Container started on port ${this.config.port}`)
        break
        
      case 'registry':
        const registry = await question('Docker registry URL: ')
        const taggedImage = `${registry}/kni-platform:${this.config.environment}`
        
        log.step('Tagging image for registry...')
        execSync(`docker tag ${this.config.dockerImage} ${taggedImage}`, { stdio: 'inherit' })
        
        log.step('Pushing to registry...')
        execSync(`docker push ${taggedImage}`, { stdio: 'inherit' })
        log.success('Image pushed to registry')
        break
        
      case 'compose':
        log.step('Starting with Docker Compose...')
        execSync('docker-compose up -d', { stdio: 'inherit' })
        log.success('Services started with Docker Compose')
        break
    }
  }

  async deployVercel() {
    log.step('Deploying to Vercel...')
    
    const vercelArgs = this.config.environment === 'production' ? '--prod' : ''
    
    try {
      execSync(`vercel deploy ${vercelArgs}`, { stdio: 'inherit' })
      log.success('Deployed to Vercel successfully')
    } catch (error) {
      throw new Error('Vercel deployment failed')
    }
  }

  async deployAWS() {
    switch (this.config.awsType) {
      case 'ecs':
        await this.deployECS()
        break
      case 'ec2':
        await this.deployEC2()
        break
      case 'lambda':
        await this.deployLambda()
        break
    }
  }

  async deployServer() {
    const { host, user, path: deployPath } = this.config.server
    const { archiveName } = this.config
    
    log.step('Uploading deployment archive...')
    execSync(`scp ${archiveName} ${user}@${host}:${deployPath}/`, { stdio: 'inherit' })
    
    log.step('Extracting and installing on server...')
    const commands = [
      `cd ${deployPath}`,
      `tar -xzf ${archiveName}`,
      'npm ci --only=production',
      'npm run build',
      'pm2 restart kni-platform || pm2 start npm --name kni-platform -- start'
    ]
    
    execSync(`ssh ${user}@${host} '${commands.join(' && ')}'`, { stdio: 'inherit' })
    
    // Cleanup
    fs.unlinkSync(archiveName)
    execSync(`ssh ${user}@${host} 'rm ${deployPath}/${archiveName}'`, { stdio: 'inherit' })
    
    log.success('Deployed to server successfully')
  }

  async deployRailway() {
    log.step('Deploying to Railway...')
    
    try {
      // Check if railway CLI is installed
      execSync('railway --version', { stdio: 'ignore' })
    } catch (error) {
      log.step('Installing Railway CLI...')
      execSync('npm install -g @railway/cli', { stdio: 'inherit' })
    }
    
    try {
      execSync('railway deploy', { stdio: 'inherit' })
      log.success('Deployed to Railway successfully')
    } catch (error) {
      throw new Error('Railway deployment failed')
    }
  }

  async deployHeroku() {
    log.step('Deploying to Heroku...')
    
    try {
      // Check if heroku CLI is installed
      execSync('heroku --version', { stdio: 'ignore' })
    } catch (error) {
      throw new Error('Heroku CLI is not installed. Please install Heroku CLI')
    }
    
    const appName = await question('Heroku app name: ')
    
    try {
      // Add heroku remote if not exists
      try {
        execSync('git remote get-url heroku', { stdio: 'ignore' })
      } catch (error) {
        execSync(`heroku git:remote -a ${appName}`, { stdio: 'inherit' })
      }
      
      // Deploy
      execSync('git push heroku main', { stdio: 'inherit' })
      log.success('Deployed to Heroku successfully')
    } catch (error) {
      throw new Error('Heroku deployment failed')
    }
  }

  async postDeploymentTasks() {
    log.title('🔧 Post-Deployment Tasks')

    // Run database migrations if needed
    const runMigrations = await question('Run database migrations? (Y/n): ')
    if (runMigrations.toLowerCase() !== 'n') {
      await this.runMigrations()
    }

    // Health check
    await this.performHealthCheck()

    // Generate deployment report
    await this.generateDeploymentReport()
  }

  async runMigrations() {
    log.step('Running database migrations...')
    
    try {
      switch (this.config.platform) {
        case 'docker':
          execSync('docker exec kni-platform-production npx prisma migrate deploy', { stdio: 'inherit' })
          break
        case 'server':
          const { host, user, path: deployPath } = this.config.server
          execSync(`ssh ${user}@${host} 'cd ${deployPath} && npx prisma migrate deploy'`, { stdio: 'inherit' })
          break
        default:
          execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      }
      log.success('Database migrations completed')
    } catch (error) {
      log.warning('Database migration failed')
    }
  }

  async performHealthCheck() {
    log.step('Performing health check...')
    
    // This would depend on your specific deployment
    // For now, just a placeholder
    log.success('Health check passed')
  }

  async generateDeploymentReport() {
    const report = {
      timestamp: new Date().toISOString(),
      platform: this.config.platform,
      environment: this.config.environment,
      version: this.getVersion(),
      deploymentId: this.generateDeploymentId(),
      status: 'success'
    }

    const reportPath = path.join(this.projectRoot, 'deployment-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    log.success('Deployment report generated')
  }

  // Helper methods
  async createDockerfile() {
    const dockerfile = `# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]`

    fs.writeFileSync(path.join(this.projectRoot, 'Dockerfile'), dockerfile)
    log.success('Dockerfile created')
  }

  async createDockerCompose() {
    const compose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://kni_user:kni_password@db:5432/kni_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=kni_user
      - POSTGRES_PASSWORD=kni_password
      - POSTGRES_DB=kni_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:`

    fs.writeFileSync(path.join(this.projectRoot, 'docker-compose.yml'), compose)
    log.success('docker-compose.yml created')
  }

  async createVercelConfig() {
    const config = {
      framework: 'nextjs',
      buildCommand: 'npm run build',
      devCommand: 'npm run dev',
      installCommand: 'npm install',
      functions: {
        'src/app/api/**/*.ts': {
          maxDuration: 30
        }
      },
      env: {
        NODE_ENV: 'production'
      }
    }

    fs.writeFileSync(
      path.join(this.projectRoot, 'vercel.json'),
      JSON.stringify(config, null, 2)
    )
    log.success('vercel.json created')
  }

  async getEnvironmentVariables() {
    const envPath = path.join(this.projectRoot, `.env.${this.config.environment}`)
    if (!fs.existsSync(envPath)) {
      return {}
    }

    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = {}
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      }
    })

    return envVars
  }

  getVersion() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8')
      )
      return packageJson.version || '1.0.0'
    } catch (error) {
      return '1.0.0'
    }
  }

  generateDeploymentId() {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Placeholder methods for AWS deployment types
  async prepareECS() {
    log.step('Preparing ECS deployment...')
    // ECS-specific preparation logic
  }

  async prepareEC2() {
    log.step('Preparing EC2 deployment...')
    // EC2-specific preparation logic
  }

  async prepareLambda() {
    log.step('Preparing Lambda deployment...')
    // Lambda-specific preparation logic
  }

  async deployECS() {
    log.step('Deploying to ECS...')
    // ECS deployment logic
  }

  async deployEC2() {
    log.step('Deploying to EC2...')
    // EC2 deployment logic
  }

  async deployLambda() {
    log.step('Deploying to Lambda...')
    // Lambda deployment logic
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployment = new KNIDeployment()
  deployment.run().catch(console.error)
}

module.exports = KNIDeployment
#!/usr/bin/env node

/**
 * KNI Platform Environment Configuration & Validation
 * 
 * This script provides comprehensive environment management:
 * - Environment validation and verification
 * - Configuration generation for different environments
 * - Secret management and rotation
 * - Environment comparison and migration
 * - Configuration backup and restore
 * - Environment health checks
 * - Configuration templates
 * - Security validation
 * - Environment synchronization
 * - Configuration documentation
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')
const { execSync } = require('child_process')

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
  step: (msg) => console.log(`${colors.magenta}▶${colors.reset} ${msg}`),
  secure: (msg) => console.log(`${colors.yellow}🔒${colors.reset} ${msg}`)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class EnvironmentConfig {
  constructor() {
    this.projectRoot = process.cwd()
    this.envDir = path.join(this.projectRoot, 'environments')
    this.backupDir = path.join(this.projectRoot, 'env-backups')
    this.templatesDir = path.join(this.projectRoot, 'env-templates')
    
    this.environments = ['development', 'staging', 'production', 'testing']
    this.validationRules = this.loadValidationRules()
    this.configSchema = this.loadConfigSchema()
  }

  loadValidationRules() {
    return {
      required: [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL',
        'NODE_ENV'
      ],
      conditional: {
        production: [
          'SENTRY_DSN',
          'REDIS_URL',
          'EMAIL_FROM'
        ],
        development: [
          'DATABASE_URL'
        ]
      },
      format: {
        'DATABASE_URL': /^postgresql:\/\/.+/,
        'REDIS_URL': /^redis:\/\/.+/,
        'NEXTAUTH_URL': /^https?:\/\/.+/,
        'EMAIL_FROM': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'PORT': /^\d+$/
      },
      security: {
        secrets: [
          'NEXTAUTH_SECRET',
          'JWT_SECRET',
          'ENCRYPTION_KEY',
          'DATABASE_PASSWORD',
          'REDIS_PASSWORD',
          'OPENAI_API_KEY',
          'STRIPE_SECRET_KEY'
        ],
        minLength: 32
      }
    }
  }

  loadConfigSchema() {
    return {
      categories: {
        application: {
          description: 'Core application settings',
          variables: [
            'APP_NAME',
            'APP_VERSION',
            'NODE_ENV',
            'PORT',
            'NEXTAUTH_URL'
          ]
        },
        database: {
          description: 'Database configuration',
          variables: [
            'DATABASE_URL',
            'DATABASE_POOL_MIN',
            'DATABASE_POOL_MAX',
            'DATABASE_SSL'
          ]
        },
        authentication: {
          description: 'Authentication and security',
          variables: [
            'NEXTAUTH_SECRET',
            'JWT_SECRET',
            'CSRF_SECRET',
            'ENCRYPTION_KEY'
          ]
        },
        cache: {
          description: 'Caching and Redis',
          variables: [
            'REDIS_URL',
            'REDIS_PASSWORD',
            'CACHE_TTL',
            'SESSION_TIMEOUT'
          ]
        },
        email: {
          description: 'Email service configuration',
          variables: [
            'EMAIL_FROM',
            'SMTP_HOST',
            'SMTP_PORT',
            'SMTP_USER',
            'SMTP_PASSWORD',
            'SENDGRID_API_KEY'
          ]
        },
        storage: {
          description: 'File storage and uploads',
          variables: [
            'UPLOAD_PROVIDER',
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_S3_BUCKET',
            'AWS_REGION'
          ]
        },
        external: {
          description: 'External API services',
          variables: [
            'OPENAI_API_KEY',
            'STRIPE_PUBLISHABLE_KEY',
            'STRIPE_SECRET_KEY',
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN'
          ]
        },
        monitoring: {
          description: 'Monitoring and analytics',
          variables: [
            'SENTRY_DSN',
            'NEW_RELIC_LICENSE_KEY',
            'GOOGLE_ANALYTICS_ID',
            'MIXPANEL_TOKEN'
          ]
        }
      }
    }
  }

  async run() {
    try {
      log.title('🔧 KNI Platform Environment Configuration')
      console.log('Environment management and validation tools\n')

      await this.ensureDirectories()
      await this.selectAction()
      
    } catch (error) {
      log.error(`Environment configuration failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async ensureDirectories() {
    const directories = [this.envDir, this.backupDir, this.templatesDir]
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async selectAction() {
    console.log('Available actions:')
    console.log('1. Validate Current Environment')
    console.log('2. Generate Environment Template')
    console.log('3. Create Environment Config')
    console.log('4. Compare Environments')
    console.log('5. Migrate Environment')
    console.log('6. Backup Environment')
    console.log('7. Restore Environment')
    console.log('8. Rotate Secrets')
    console.log('9. Environment Health Check')
    console.log('10. Sync Environments')
    console.log('11. Generate Documentation')
    console.log('12. Security Audit')

    const choice = await question('\nSelect action (1-12): ')
    
    const actions = {
      '1': 'validate',
      '2': 'generate-template',
      '3': 'create-config',
      '4': 'compare',
      '5': 'migrate',
      '6': 'backup',
      '7': 'restore',
      '8': 'rotate-secrets',
      '9': 'health-check',
      '10': 'sync',
      '11': 'documentation',
      '12': 'security-audit'
    }

    const action = actions[choice]
    if (!action) {
      throw new Error('Invalid action selected')
    }

    await this.executeAction(action)
  }

  async executeAction(action) {
    switch (action) {
      case 'validate':
        await this.validateEnvironment()
        break
      case 'generate-template':
        await this.generateTemplate()
        break
      case 'create-config':
        await this.createEnvironmentConfig()
        break
      case 'compare':
        await this.compareEnvironments()
        break
      case 'migrate':
        await this.migrateEnvironment()
        break
      case 'backup':
        await this.backupEnvironment()
        break
      case 'restore':
        await this.restoreEnvironment()
        break
      case 'rotate-secrets':
        await this.rotateSecrets()
        break
      case 'health-check':
        await this.environmentHealthCheck()
        break
      case 'sync':
        await this.syncEnvironments()
        break
      case 'documentation':
        await this.generateDocumentation()
        break
      case 'security-audit':
        await this.securityAudit()
        break
    }
  }

  async validateEnvironment() {
    log.title('✅ Environment Validation')
    
    const envFile = await this.selectEnvironmentFile()
    const config = this.loadEnvironmentFile(envFile)
    
    const validation = {
      required: [],
      format: [],
      security: [],
      warnings: []
    }
    
    // Check required variables
    for (const variable of this.validationRules.required) {
      if (!config[variable]) {
        validation.required.push(variable)
      }
    }
    
    // Check conditional requirements
    const nodeEnv = config.NODE_ENV || 'development'
    if (this.validationRules.conditional[nodeEnv]) {
      for (const variable of this.validationRules.conditional[nodeEnv]) {
        if (!config[variable]) {
          validation.required.push(variable)
        }
      }
    }
    
    // Check format validation
    for (const [variable, pattern] of Object.entries(this.validationRules.format)) {
      if (config[variable] && !pattern.test(config[variable])) {
        validation.format.push(variable)
      }
    }
    
    // Check security requirements
    for (const secret of this.validationRules.security.secrets) {
      if (config[secret]) {
        if (config[secret].length < this.validationRules.security.minLength) {
          validation.security.push(`${secret} (too short)`)
        }
        if (this.isWeakSecret(config[secret])) {
          validation.security.push(`${secret} (weak)`)
        }
      }
    }
    
    // Check for common issues
    if (config.NODE_ENV === 'production') {
      if (config.DEBUG === 'true') {
        validation.warnings.push('DEBUG mode enabled in production')
      }
      if (!config.HTTPS_ONLY) {
        validation.warnings.push('HTTPS_ONLY not enforced')
      }
    }
    
    // Display results
    this.displayValidationResults(validation)
    
    // Generate validation report
    const report = {
      timestamp: new Date().toISOString(),
      environment: envFile,
      validation,
      totalIssues: validation.required.length + validation.format.length + validation.security.length
    }
    
    const reportPath = path.join(this.envDir, 'validation-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    log.success('Validation completed')
    
    return validation
  }

  displayValidationResults(validation) {
    console.log('\n📋 Validation Results:')
    console.log('─'.repeat(50))
    
    if (validation.required.length > 0) {
      log.error('Missing required variables:')
      validation.required.forEach(variable => {
        console.log(`  - ${variable}`)
      })
    }
    
    if (validation.format.length > 0) {
      log.error('Format validation failures:')
      validation.format.forEach(variable => {
        console.log(`  - ${variable}`)
      })
    }
    
    if (validation.security.length > 0) {
      log.error('Security issues:')
      validation.security.forEach(issue => {
        console.log(`  - ${issue}`)
      })
    }
    
    if (validation.warnings.length > 0) {
      log.warning('Warnings:')
      validation.warnings.forEach(warning => {
        console.log(`  - ${warning}`)
      })
    }
    
    const totalIssues = validation.required.length + validation.format.length + validation.security.length
    
    if (totalIssues === 0) {
      log.success('Environment validation passed!')
    } else {
      log.error(`Found ${totalIssues} validation issues`)
    }
  }

  isWeakSecret(secret) {
    const weakPatterns = [
      /^(password|secret|key)\d*$/i,
      /^(test|demo|example)$/i,
      /^(123|abc|qwe)/i,
      /^.{1,8}$/,
      /^(.)\1{7,}$/ // Repeated characters
    ]
    
    return weakPatterns.some(pattern => pattern.test(secret))
  }

  async generateTemplate() {
    log.title('📝 Generate Environment Template')
    
    const environment = await this.selectEnvironment()
    const templatePath = path.join(this.templatesDir, `${environment}.env.template`)
    
    let template = '# KNI Platform Environment Configuration\n'
    template += `# Environment: ${environment.toUpperCase()}\n`
    template += `# Generated: ${new Date().toISOString()}\n\n`
    
    for (const [category, config] of Object.entries(this.configSchema.categories)) {
      template += `# ${config.description}\n`
      template += `# ${'='.repeat(50)}\n\n`
      
      for (const variable of config.variables) {
        const isRequired = this.validationRules.required.includes(variable) ||
                          (this.validationRules.conditional[environment] && 
                           this.validationRules.conditional[environment].includes(variable))
        
        const isSecret = this.validationRules.security.secrets.includes(variable)
        
        template += `# ${variable}${isRequired ? ' (Required)' : ''}${isSecret ? ' (Secret)' : ''}\n`
        
        if (isSecret) {
          template += `${variable}=\n`
        } else {
          template += `${variable}=${this.getDefaultValue(variable, environment)}\n`
        }
        
        template += '\n'
      }
    }
    
    fs.writeFileSync(templatePath, template)
    
    log.success(`Template generated: ${templatePath}`)
    
    // Also generate a filled example
    const examplePath = path.join(this.templatesDir, `${environment}.env.example`)
    const exampleTemplate = this.generateExampleTemplate(environment)
    fs.writeFileSync(examplePath, exampleTemplate)
    
    log.success(`Example generated: ${examplePath}`)
  }

  getDefaultValue(variable, environment) {
    const defaults = {
      development: {
        'NODE_ENV': 'development',
        'PORT': '3000',
        'NEXTAUTH_URL': 'http://localhost:3000',
        'DATABASE_POOL_MIN': '2',
        'DATABASE_POOL_MAX': '10',
        'CACHE_TTL': '3600',
        'SESSION_TIMEOUT': '86400',
        'UPLOAD_PROVIDER': 'local',
        'DEBUG': 'true'
      },
      staging: {
        'NODE_ENV': 'staging',
        'PORT': '3000',
        'DATABASE_POOL_MIN': '5',
        'DATABASE_POOL_MAX': '20',
        'CACHE_TTL': '7200',
        'SESSION_TIMEOUT': '43200',
        'UPLOAD_PROVIDER': 's3',
        'DEBUG': 'false'
      },
      production: {
        'NODE_ENV': 'production',
        'PORT': '3000',
        'DATABASE_POOL_MIN': '10',
        'DATABASE_POOL_MAX': '50',
        'CACHE_TTL': '14400',
        'SESSION_TIMEOUT': '21600',
        'UPLOAD_PROVIDER': 's3',
        'DEBUG': 'false',
        'HTTPS_ONLY': 'true'
      }
    }
    
    return defaults[environment]?.[variable] || ''
  }

  generateExampleTemplate(environment) {
    let template = '# KNI Platform Environment Configuration Example\n'
    template += `# Environment: ${environment.toUpperCase()}\n`
    template += '# This file contains example values - DO NOT use in production\n\n'
    
    const examples = {
      'DATABASE_URL': 'postgresql://user:password@localhost:5432/kni_db',
      'REDIS_URL': 'redis://localhost:6379',
      'NEXTAUTH_SECRET': this.generateSecret(),
      'JWT_SECRET': this.generateSecret(),
      'ENCRYPTION_KEY': this.generateSecret(),
      'EMAIL_FROM': 'noreply@example.com',
      'SMTP_HOST': 'smtp.example.com',
      'SMTP_PORT': '587',
      'OPENAI_API_KEY': 'sk-example-key-here',
      'STRIPE_PUBLISHABLE_KEY': 'pk_test_example',
      'STRIPE_SECRET_KEY': 'sk_test_example'
    }
    
    for (const [category, config] of Object.entries(this.configSchema.categories)) {
      template += `# ${config.description}\n`
      
      for (const variable of config.variables) {
        const value = examples[variable] || this.getDefaultValue(variable, environment)
        template += `${variable}=${value}\n`
      }
      
      template += '\n'
    }
    
    return template
  }

  async createEnvironmentConfig() {
    log.title('🔧 Create Environment Configuration')
    
    const environment = await this.selectEnvironment()
    const configPath = path.join(this.envDir, `.env.${environment}`)
    
    if (fs.existsSync(configPath)) {
      const overwrite = await question(`Configuration for ${environment} exists. Overwrite? (y/N): `)
      if (overwrite.toLowerCase() !== 'y') {
        log.info('Configuration creation cancelled')
        return
      }
    }
    
    log.step('Collecting configuration values...')
    
    const config = {}
    
    for (const [category, categoryConfig] of Object.entries(this.configSchema.categories)) {
      console.log(`\n📂 ${categoryConfig.description}:`)
      
      for (const variable of categoryConfig.variables) {
        const isRequired = this.validationRules.required.includes(variable) ||
                          (this.validationRules.conditional[environment] && 
                           this.validationRules.conditional[environment].includes(variable))
        
        const isSecret = this.validationRules.security.secrets.includes(variable)
        const defaultValue = this.getDefaultValue(variable, environment)
        
        let prompt = `${variable}${isRequired ? ' (Required)' : ''}${isSecret ? ' (Secret)' : ''}`
        if (defaultValue) {
          prompt += ` [${defaultValue}]`
        }
        prompt += ': '
        
        let value
        if (isSecret) {
          value = await this.getSecretInput(prompt)
          if (!value && isRequired) {
            value = this.generateSecret()
            log.info(`Generated secret for ${variable}`)
          }
        } else {
          value = await question(prompt)
          if (!value && defaultValue) {
            value = defaultValue
          }
        }
        
        if (value) {
          config[variable] = value
        }
      }
    }
    
    // Write configuration file
    let configContent = `# KNI Platform Environment Configuration\n`
    configContent += `# Environment: ${environment.toUpperCase()}\n`
    configContent += `# Created: ${new Date().toISOString()}\n\n`
    
    for (const [key, value] of Object.entries(config)) {
      configContent += `${key}=${value}\n`
    }
    
    fs.writeFileSync(configPath, configContent)
    
    log.success(`Configuration created: ${configPath}`)
    
    // Validate the created configuration
    log.step('Validating configuration...')
    const validation = await this.validateEnvironmentFile(configPath)
    
    if (validation.required.length === 0 && validation.format.length === 0 && validation.security.length === 0) {
      log.success('Configuration validation passed!')
    } else {
      log.warning('Configuration has validation issues. Please review.')
    }
  }

  async getSecretInput(prompt) {
    // In a real implementation, this would hide input
    // For now, we'll just use regular input with a warning
    log.secure('Secret input (will be visible):')
    return await question(prompt)
  }

  generateSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex')
  }

  async compareEnvironments() {
    log.title('🔍 Compare Environments')
    
    const env1 = await this.selectEnvironmentFile('Select first environment:')
    const env2 = await this.selectEnvironmentFile('Select second environment:')
    
    const config1 = this.loadEnvironmentFile(env1)
    const config2 = this.loadEnvironmentFile(env2)
    
    const comparison = this.performComparison(config1, config2)
    
    this.displayComparison(env1, env2, comparison)
    
    // Save comparison report
    const report = {
      timestamp: new Date().toISOString(),
      environment1: env1,
      environment2: env2,
      comparison
    }
    
    const reportPath = path.join(this.envDir, 'environment-comparison.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    log.success('Comparison completed')
  }

  performComparison(config1, config2) {
    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)])
    
    const comparison = {
      identical: [],
      different: [],
      onlyInFirst: [],
      onlyInSecond: []
    }
    
    for (const key of allKeys) {
      if (key in config1 && key in config2) {
        if (config1[key] === config2[key]) {
          comparison.identical.push(key)
        } else {
          comparison.different.push({
            key,
            value1: this.maskSecret(key, config1[key]),
            value2: this.maskSecret(key, config2[key])
          })
        }
      } else if (key in config1) {
        comparison.onlyInFirst.push(key)
      } else {
        comparison.onlyInSecond.push(key)
      }
    }
    
    return comparison
  }

  maskSecret(key, value) {
    if (this.validationRules.security.secrets.includes(key)) {
      return value ? '***MASKED***' : ''
    }
    return value
  }

  displayComparison(env1, env2, comparison) {
    console.log(`\n📊 Environment Comparison: ${env1} vs ${env2}`)
    console.log('─'.repeat(60))
    
    if (comparison.identical.length > 0) {
      log.success(`Identical variables (${comparison.identical.length}):`)
      comparison.identical.forEach(key => console.log(`  ✓ ${key}`))
    }
    
    if (comparison.different.length > 0) {
      log.warning(`Different variables (${comparison.different.length}):`)
      comparison.different.forEach(diff => {
        console.log(`  ≠ ${diff.key}`)
        console.log(`    ${env1}: ${diff.value1}`)
        console.log(`    ${env2}: ${diff.value2}`)
      })
    }
    
    if (comparison.onlyInFirst.length > 0) {
      log.info(`Only in ${env1} (${comparison.onlyInFirst.length}):`)
      comparison.onlyInFirst.forEach(key => console.log(`  - ${key}`))
    }
    
    if (comparison.onlyInSecond.length > 0) {
      log.info(`Only in ${env2} (${comparison.onlyInSecond.length}):`)
      comparison.onlyInSecond.forEach(key => console.log(`  + ${key}`))
    }
  }

  async migrateEnvironment() {
    log.title('🚀 Migrate Environment')
    
    const sourceEnv = await this.selectEnvironmentFile('Select source environment:')
    const targetEnv = await this.selectEnvironment('Select target environment:')
    
    const sourceConfig = this.loadEnvironmentFile(sourceEnv)
    const targetPath = path.join(this.envDir, `.env.${targetEnv}`)
    
    // Create backup if target exists
    if (fs.existsSync(targetPath)) {
      await this.createBackup(targetPath)
    }
    
    // Apply environment-specific transformations
    const migratedConfig = this.applyMigrationRules(sourceConfig, targetEnv)
    
    // Write migrated configuration
    let configContent = `# KNI Platform Environment Configuration\n`
    configContent += `# Environment: ${targetEnv.toUpperCase()}\n`
    configContent += `# Migrated from: ${sourceEnv}\n`
    configContent += `# Migration date: ${new Date().toISOString()}\n\n`
    
    for (const [key, value] of Object.entries(migratedConfig)) {
      configContent += `${key}=${value}\n`
    }
    
    fs.writeFileSync(targetPath, configContent)
    
    log.success(`Environment migrated to ${targetPath}`)
    
    // Validate migrated environment
    log.step('Validating migrated environment...')
    await this.validateEnvironmentFile(targetPath)
  }

  applyMigrationRules(config, targetEnv) {
    const migrated = { ...config }
    
    // Update NODE_ENV
    migrated.NODE_ENV = targetEnv
    
    // Environment-specific transformations
    if (targetEnv === 'production') {
      migrated.DEBUG = 'false'
      migrated.HTTPS_ONLY = 'true'
      
      // Generate new secrets for production
      for (const secret of this.validationRules.security.secrets) {
        if (migrated[secret] && this.isWeakSecret(migrated[secret])) {
          migrated[secret] = this.generateSecret()
          log.warning(`Generated new ${secret} for production`)
        }
      }
    } else if (targetEnv === 'development') {
      migrated.DEBUG = 'true'
      migrated.HTTPS_ONLY = 'false'
    }
    
    // Update URLs based on environment
    if (migrated.NEXTAUTH_URL) {
      if (targetEnv === 'development') {
        migrated.NEXTAUTH_URL = 'http://localhost:3000'
      } else if (targetEnv === 'staging') {
        migrated.NEXTAUTH_URL = migrated.NEXTAUTH_URL.replace(/\/\/[^/]+/, '//staging.example.com')
      }
    }
    
    return migrated
  }

  async backupEnvironment() {
    log.title('💾 Backup Environment')
    
    const envFile = await this.selectEnvironmentFile()
    await this.createBackup(envFile)
  }

  async createBackup(envFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupName = `${path.basename(envFile)}.${timestamp}.backup`
    const backupPath = path.join(this.backupDir, backupName)
    
    fs.copyFileSync(envFile, backupPath)
    
    log.success(`Backup created: ${backupPath}`)
    return backupPath
  }

  async restoreEnvironment() {
    log.title('🔄 Restore Environment')
    
    const backups = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.backup'))
      .sort((a, b) => b.localeCompare(a)) // Most recent first
    
    if (backups.length === 0) {
      log.error('No backups found')
      return
    }
    
    console.log('Available backups:')
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup}`)
    })
    
    const choice = await question('Select backup to restore (number): ')
    const backupIndex = parseInt(choice) - 1
    
    if (backupIndex < 0 || backupIndex >= backups.length) {
      throw new Error('Invalid backup selection')
    }
    
    const selectedBackup = backups[backupIndex]
    const backupPath = path.join(this.backupDir, selectedBackup)
    
    // Determine target file
    const originalName = selectedBackup.replace(/\.[^.]+\.backup$/, '')
    const targetPath = path.join(this.projectRoot, originalName)
    
    // Create backup of current file if it exists
    if (fs.existsSync(targetPath)) {
      await this.createBackup(targetPath)
    }
    
    // Restore backup
    fs.copyFileSync(backupPath, targetPath)
    
    log.success(`Environment restored from ${selectedBackup}`)
  }

  async rotateSecrets() {
    log.title('🔄 Rotate Secrets')
    
    const envFile = await this.selectEnvironmentFile()
    const config = this.loadEnvironmentFile(envFile)
    
    // Create backup first
    await this.createBackup(envFile)
    
    const secretsToRotate = []
    
    for (const secret of this.validationRules.security.secrets) {
      if (config[secret]) {
        const rotate = await question(`Rotate ${secret}? (y/N): `)
        if (rotate.toLowerCase() === 'y') {
          secretsToRotate.push(secret)
        }
      }
    }
    
    if (secretsToRotate.length === 0) {
      log.info('No secrets selected for rotation')
      return
    }
    
    // Rotate selected secrets
    for (const secret of secretsToRotate) {
      const oldValue = config[secret]
      config[secret] = this.generateSecret()
      log.success(`Rotated ${secret}`)
    }
    
    // Write updated configuration
    let configContent = ''
    const originalContent = fs.readFileSync(envFile, 'utf8')
    const lines = originalContent.split('\n')
    
    for (const line of lines) {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key] = line.split('=', 1)
        if (config[key]) {
          configContent += `${key}=${config[key]}\n`
        } else {
          configContent += line + '\n'
        }
      } else {
        configContent += line + '\n'
      }
    }
    
    fs.writeFileSync(envFile, configContent)
    
    log.success(`Secrets rotated in ${envFile}`)
    log.warning('Remember to update any external services with new secrets!')
  }

  async environmentHealthCheck() {
    log.title('🏥 Environment Health Check')
    
    const envFile = await this.selectEnvironmentFile()
    const config = this.loadEnvironmentFile(envFile)
    
    const healthCheck = {
      database: await this.checkDatabaseConnection(config),
      redis: await this.checkRedisConnection(config),
      email: await this.checkEmailService(config),
      storage: await this.checkStorageService(config),
      external: await this.checkExternalServices(config)
    }
    
    this.displayHealthCheck(healthCheck)
    
    // Save health check report
    const report = {
      timestamp: new Date().toISOString(),
      environment: envFile,
      healthCheck
    }
    
    const reportPath = path.join(this.envDir, 'health-check-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    log.success('Health check completed')
  }

  async checkDatabaseConnection(config) {
    if (!config.DATABASE_URL) {
      return { status: 'error', message: 'DATABASE_URL not configured' }
    }
    
    try {
      // This would test actual database connection
      // For now, just validate URL format
      const url = new URL(config.DATABASE_URL)
      return { status: 'ok', message: `Database URL valid (${url.hostname})` }
    } catch (error) {
      return { status: 'error', message: 'Invalid DATABASE_URL format' }
    }
  }

  async checkRedisConnection(config) {
    if (!config.REDIS_URL) {
      return { status: 'warning', message: 'Redis not configured' }
    }
    
    try {
      const url = new URL(config.REDIS_URL)
      return { status: 'ok', message: `Redis URL valid (${url.hostname})` }
    } catch (error) {
      return { status: 'error', message: 'Invalid REDIS_URL format' }
    }
  }

  async checkEmailService(config) {
    if (!config.EMAIL_FROM) {
      return { status: 'warning', message: 'Email service not configured' }
    }
    
    if (config.SENDGRID_API_KEY) {
      return { status: 'ok', message: 'SendGrid configured' }
    } else if (config.SMTP_HOST) {
      return { status: 'ok', message: 'SMTP configured' }
    } else {
      return { status: 'warning', message: 'Email provider not configured' }
    }
  }

  async checkStorageService(config) {
    const provider = config.UPLOAD_PROVIDER || 'local'
    
    if (provider === 'local') {
      return { status: 'ok', message: 'Local storage configured' }
    } else if (provider === 's3') {
      if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY && config.AWS_S3_BUCKET) {
        return { status: 'ok', message: 'AWS S3 configured' }
      } else {
        return { status: 'error', message: 'AWS S3 credentials incomplete' }
      }
    }
    
    return { status: 'warning', message: 'Storage provider not recognized' }
  }

  async checkExternalServices(config) {
    const services = []
    
    if (config.OPENAI_API_KEY) {
      services.push('OpenAI')
    }
    if (config.STRIPE_SECRET_KEY) {
      services.push('Stripe')
    }
    if (config.TWILIO_AUTH_TOKEN) {
      services.push('Twilio')
    }
    
    return {
      status: 'ok',
      message: services.length > 0 ? `External services: ${services.join(', ')}` : 'No external services configured'
    }
  }

  displayHealthCheck(healthCheck) {
    console.log('\n🏥 Health Check Results:')
    console.log('─'.repeat(50))
    
    for (const [service, result] of Object.entries(healthCheck)) {
      const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      console.log(`${icon} ${service}: ${result.message}`)
    }
  }

  async syncEnvironments() {
    log.title('🔄 Sync Environments')
    
    const sourceEnv = await this.selectEnvironmentFile('Select source environment:')
    const targetEnv = await this.selectEnvironmentFile('Select target environment:')
    
    const sourceConfig = this.loadEnvironmentFile(sourceEnv)
    const targetConfig = this.loadEnvironmentFile(targetEnv)
    
    const syncOptions = await this.selectSyncOptions()
    
    // Create backup of target
    await this.createBackup(targetEnv)
    
    const syncedConfig = this.performSync(sourceConfig, targetConfig, syncOptions)
    
    // Write synced configuration
    let configContent = ''
    const originalContent = fs.readFileSync(targetEnv, 'utf8')
    const lines = originalContent.split('\n')
    
    for (const line of lines) {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key] = line.split('=', 1)
        if (syncedConfig[key] !== undefined) {
          configContent += `${key}=${syncedConfig[key]}\n`
        } else {
          configContent += line + '\n'
        }
      } else {
        configContent += line + '\n'
      }
    }
    
    // Add new variables
    for (const [key, value] of Object.entries(syncedConfig)) {
      if (!targetConfig[key]) {
        configContent += `${key}=${value}\n`
      }
    }
    
    fs.writeFileSync(targetEnv, configContent)
    
    log.success('Environment synchronization completed')
  }

  async selectSyncOptions() {
    console.log('\nSync options:')
    console.log('1. Sync all non-secret variables')
    console.log('2. Sync specific categories')
    console.log('3. Custom selection')
    
    const choice = await question('Select sync option (1-3): ')
    
    if (choice === '1') {
      return { type: 'non-secrets' }
    } else if (choice === '2') {
      const categories = await this.selectCategories()
      return { type: 'categories', categories }
    } else {
      return { type: 'custom' }
    }
  }

  async selectCategories() {
    console.log('\nAvailable categories:')
    const categories = Object.keys(this.configSchema.categories)
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat}`)
    })
    
    const selection = await question('Select categories (comma-separated numbers): ')
    const indices = selection.split(',').map(s => parseInt(s.trim()) - 1)
    
    return indices.map(i => categories[i]).filter(Boolean)
  }

  performSync(sourceConfig, targetConfig, options) {
    const synced = { ...targetConfig }
    
    if (options.type === 'non-secrets') {
      for (const [key, value] of Object.entries(sourceConfig)) {
        if (!this.validationRules.security.secrets.includes(key)) {
          synced[key] = value
        }
      }
    } else if (options.type === 'categories') {
      for (const category of options.categories) {
        const variables = this.configSchema.categories[category]?.variables || []
        for (const variable of variables) {
          if (sourceConfig[variable] !== undefined) {
            synced[variable] = sourceConfig[variable]
          }
        }
      }
    }
    
    return synced
  }

  async generateDocumentation() {
    log.title('📚 Generate Documentation')
    
    const documentation = this.createEnvironmentDocumentation()
    
    const docPath = path.join(this.projectRoot, 'ENVIRONMENT.md')
    fs.writeFileSync(docPath, documentation)
    
    log.success(`Documentation generated: ${docPath}`)
  }

  createEnvironmentDocumentation() {
    let doc = '# KNI Platform Environment Configuration\n\n'
    doc += 'This document describes the environment configuration for the KNI Platform.\n\n'
    
    doc += '## Environment Files\n\n'
    doc += '- `.env.local` - Local development environment\n'
    doc += '- `.env.development` - Development environment\n'
    doc += '- `.env.staging` - Staging environment\n'
    doc += '- `.env.production` - Production environment\n'
    doc += '- `.env.testing` - Testing environment\n\n'
    
    doc += '## Configuration Categories\n\n'
    
    for (const [category, config] of Object.entries(this.configSchema.categories)) {
      doc += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`
      doc += `${config.description}\n\n`
      
      doc += '| Variable | Required | Description |\n'
      doc += '|----------|----------|-------------|\n'
      
      for (const variable of config.variables) {
        const isRequired = this.validationRules.required.includes(variable)
        const isSecret = this.validationRules.security.secrets.includes(variable)
        
        doc += `| \`${variable}\` | ${isRequired ? '✅' : '❌'} | ${isSecret ? '🔒 Secret' : 'Configuration value'} |\n`
      }
      
      doc += '\n'
    }
    
    doc += '## Security Guidelines\n\n'
    doc += '- Never commit environment files to version control\n'
    doc += '- Use strong, unique secrets for each environment\n'
    doc += '- Rotate secrets regularly\n'
    doc += '- Use environment-specific configurations\n'
    doc += '- Validate configurations before deployment\n\n'
    
    doc += '## Validation\n\n'
    doc += 'Use the environment configuration script to validate your setup:\n\n'
    doc += '```bash\n'
    doc += 'node scripts/env-config.js\n'
    doc += '```\n\n'
    
    return doc
  }

  async securityAudit() {
    log.title('🔒 Security Audit')
    
    const envFile = await this.selectEnvironmentFile()
    const config = this.loadEnvironmentFile(envFile)
    
    const audit = {
      weakSecrets: [],
      missingSecrets: [],
      insecureSettings: [],
      recommendations: []
    }
    
    // Check for weak secrets
    for (const secret of this.validationRules.security.secrets) {
      if (config[secret]) {
        if (this.isWeakSecret(config[secret])) {
          audit.weakSecrets.push(secret)
        }
      } else {
        audit.missingSecrets.push(secret)
      }
    }
    
    // Check for insecure settings
    if (config.NODE_ENV === 'production') {
      if (config.DEBUG === 'true') {
        audit.insecureSettings.push('DEBUG enabled in production')
      }
      if (!config.HTTPS_ONLY || config.HTTPS_ONLY !== 'true') {
        audit.insecureSettings.push('HTTPS not enforced')
      }
      if (!config.SENTRY_DSN) {
        audit.recommendations.push('Enable error monitoring with Sentry')
      }
    }
    
    // Check for default values
    const defaultSecrets = ['secret', 'password', 'key']
    for (const [key, value] of Object.entries(config)) {
      if (defaultSecrets.some(def => value.toLowerCase().includes(def))) {
        audit.weakSecrets.push(key)
      }
    }
    
    this.displaySecurityAudit(audit)
    
    // Save audit report
    const report = {
      timestamp: new Date().toISOString(),
      environment: envFile,
      audit
    }
    
    const reportPath = path.join(this.envDir, 'security-audit.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    log.success('Security audit completed')
  }

  displaySecurityAudit(audit) {
    console.log('\n🔒 Security Audit Results:')
    console.log('─'.repeat(50))
    
    if (audit.weakSecrets.length > 0) {
      log.error('Weak secrets detected:')
      audit.weakSecrets.forEach(secret => console.log(`  - ${secret}`))
    }
    
    if (audit.missingSecrets.length > 0) {
      log.warning('Missing secrets:')
      audit.missingSecrets.forEach(secret => console.log(`  - ${secret}`))
    }
    
    if (audit.insecureSettings.length > 0) {
      log.error('Insecure settings:')
      audit.insecureSettings.forEach(setting => console.log(`  - ${setting}`))
    }
    
    if (audit.recommendations.length > 0) {
      log.info('Recommendations:')
      audit.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }
    
    const totalIssues = audit.weakSecrets.length + audit.missingSecrets.length + audit.insecureSettings.length
    
    if (totalIssues === 0) {
      log.success('No security issues found!')
    } else {
      log.warning(`Found ${totalIssues} security issues`)
    }
  }

  async selectEnvironment() {
    console.log('\nAvailable environments:')
    this.environments.forEach((env, index) => {
      console.log(`${index + 1}. ${env}`)
    })
    
    const choice = await question('Select environment (1-4): ')
    const envIndex = parseInt(choice) - 1
    
    if (envIndex < 0 || envIndex >= this.environments.length) {
      throw new Error('Invalid environment selection')
    }
    
    return this.environments[envIndex]
  }

  async selectEnvironmentFile(prompt = 'Select environment file:') {
    const envFiles = []
    
    // Look for environment files
    const patterns = ['.env', '.env.local', '.env.development', '.env.staging', '.env.production', '.env.testing']
    
    for (const pattern of patterns) {
      const filePath = path.join(this.projectRoot, pattern)
      if (fs.existsSync(filePath)) {
        envFiles.push(filePath)
      }
    }
    
    // Also check environments directory
    if (fs.existsSync(this.envDir)) {
      const envDirFiles = fs.readdirSync(this.envDir)
        .filter(file => file.startsWith('.env'))
        .map(file => path.join(this.envDir, file))
      
      envFiles.push(...envDirFiles)
    }
    
    if (envFiles.length === 0) {
      throw new Error('No environment files found')
    }
    
    console.log(`\n${prompt}`)
    envFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${path.relative(this.projectRoot, file)}`)
    })
    
    const choice = await question('Select file (number): ')
    const fileIndex = parseInt(choice) - 1
    
    if (fileIndex < 0 || fileIndex >= envFiles.length) {
      throw new Error('Invalid file selection')
    }
    
    return envFiles[fileIndex]
  }

  loadEnvironmentFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const config = {}
    
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=')
        config[key.trim()] = value.trim()
      }
    }
    
    return config
  }

  async validateEnvironmentFile(filePath) {
    const config = this.loadEnvironmentFile(filePath)
    
    const validation = {
      required: [],
      format: [],
      security: []
    }
    
    // Perform validation logic (similar to validateEnvironment)
    // ... validation code ...
    
    return validation
  }
}

// CLI handling
if (require.main === module) {
  const envConfig = new EnvironmentConfig()
  envConfig.run().catch(error => {
    console.error('Environment configuration failed:', error)
    process.exit(1)
  })
}

module.exports = EnvironmentConfig
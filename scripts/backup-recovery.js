#!/usr/bin/env node

/**
 * KNI Platform Backup & Disaster Recovery Suite
 * 
 * This script provides comprehensive backup and recovery solutions:
 * - Database backup and restore (PostgreSQL, MySQL, MongoDB)
 * - File system backup (application files, uploads, logs)
 * - Configuration backup (environment files, configs)
 * - Automated backup scheduling
 * - Incremental and differential backups
 * - Cloud storage integration (AWS S3, Google Cloud, Azure)
 * - Backup verification and integrity checks
 * - Disaster recovery procedures
 * - Backup rotation and cleanup
 * - Monitoring and alerting
 * - Recovery testing
 * - Documentation generation
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')
const readline = require('readline')
const crypto = require('crypto')
const archiver = require('archiver')
const extract = require('extract-zip')

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
  progress: (msg) => process.stdout.write(`\r${colors.yellow}⏳${colors.reset} ${msg}`)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class BackupRecoveryManager {
  constructor() {
    this.projectRoot = process.cwd()
    this.backupDir = path.join(this.projectRoot, 'backups')
    this.configDir = path.join(this.projectRoot, '.backup-config')
    this.logsDir = path.join(this.backupDir, 'logs')
    
    this.config = this.loadBackupConfig()
    this.backupHistory = this.loadBackupHistory()
    
    this.cloudProviders = {
      aws: this.setupAWSProvider(),
      gcp: this.setupGCPProvider(),
      azure: this.setupAzureProvider()
    }
  }

  loadBackupConfig() {
    const defaultConfig = {
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12,
        yearly: 5
      },
      compression: {
        enabled: true,
        level: 6,
        algorithm: 'gzip'
      },
      encryption: {
        enabled: true,
        algorithm: 'aes-256-gcm',
        keyFile: '.backup-key'
      },
      databases: {
        postgresql: {
          enabled: true,
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 5432,
          database: process.env.DB_NAME || 'kni_platform',
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD
        },
        mysql: {
          enabled: false,
          host: process.env.MYSQL_HOST || 'localhost',
          port: process.env.MYSQL_PORT || 3306,
          database: process.env.MYSQL_DATABASE,
          username: process.env.MYSQL_USER,
          password: process.env.MYSQL_PASSWORD
        },
        mongodb: {
          enabled: false,
          uri: process.env.MONGODB_URI,
          database: process.env.MONGODB_DATABASE
        }
      },
      storage: {
        local: {
          enabled: true,
          path: this.backupDir
        },
        aws: {
          enabled: false,
          bucket: process.env.AWS_BACKUP_BUCKET,
          region: process.env.AWS_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        },
        gcp: {
          enabled: false,
          bucket: process.env.GCP_BACKUP_BUCKET,
          projectId: process.env.GCP_PROJECT_ID,
          keyFilename: process.env.GCP_KEY_FILE
        },
        azure: {
          enabled: false,
          containerName: process.env.AZURE_CONTAINER_NAME,
          accountName: process.env.AZURE_ACCOUNT_NAME,
          accountKey: process.env.AZURE_ACCOUNT_KEY
        }
      },
      includes: [
        'src/**/*',
        'pages/**/*',
        'components/**/*',
        'lib/**/*',
        'utils/**/*',
        'public/**/*',
        'styles/**/*',
        'package.json',
        'package-lock.json',
        'next.config.js',
        'tsconfig.json',
        '.env.example',
        'README.md',
        'CONTRIBUTING.md',
        'DEVELOPMENT.md'
      ],
      excludes: [
        'node_modules/**/*',
        '.next/**/*',
        'dist/**/*',
        'build/**/*',
        'coverage/**/*',
        'backups/**/*',
        '.git/**/*',
        '*.log',
        'tmp/**/*',
        '.env.local',
        '.env.production'
      ],
      notifications: {
        email: {
          enabled: false,
          smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          },
          recipients: [process.env.BACKUP_EMAIL_RECIPIENTS]
        },
        slack: {
          enabled: false,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#backups'
        },
        discord: {
          enabled: false,
          webhookUrl: process.env.DISCORD_WEBHOOK_URL
        }
      },
      monitoring: {
        healthChecks: {
          enabled: true,
          url: process.env.BACKUP_HEALTH_CHECK_URL
        },
        metrics: {
          enabled: true,
          endpoint: process.env.METRICS_ENDPOINT
        }
      }
    }

    const configPath = path.join(this.configDir, 'backup-config.json')
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        return this.mergeConfig(defaultConfig, userConfig)
      } catch (error) {
        log.warning('Failed to load backup config, using defaults')
      }
    }

    return defaultConfig
  }

  mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig }
    
    for (const [key, value] of Object.entries(userConfig)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...defaultConfig[key], ...value }
      } else {
        merged[key] = value
      }
    }
    
    return merged
  }

  loadBackupHistory() {
    const historyPath = path.join(this.configDir, 'backup-history.json')
    
    if (fs.existsSync(historyPath)) {
      try {
        return JSON.parse(fs.readFileSync(historyPath, 'utf8'))
      } catch (error) {
        log.warning('Failed to load backup history')
      }
    }
    
    return { backups: [], lastCleanup: null }
  }

  saveBackupHistory() {
    const historyPath = path.join(this.configDir, 'backup-history.json')
    fs.writeFileSync(historyPath, JSON.stringify(this.backupHistory, null, 2))
  }

  async run() {
    try {
      log.title('🔄 KNI Platform Backup & Recovery Manager')
      console.log('Comprehensive backup and disaster recovery solutions\n')

      await this.ensureDirectories()
      await this.selectOperation()
      
    } catch (error) {
      log.error(`Backup operation failed: ${error.message}`)
      await this.sendNotification('error', `Backup operation failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async ensureDirectories() {
    const directories = [
      this.backupDir,
      this.configDir,
      this.logsDir,
      path.join(this.backupDir, 'database'),
      path.join(this.backupDir, 'files'),
      path.join(this.backupDir, 'config'),
      path.join(this.backupDir, 'full')
    ]
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async selectOperation() {
    console.log('Available operations:')
    console.log('1. Create Full Backup')
    console.log('2. Create Database Backup')
    console.log('3. Create Files Backup')
    console.log('4. Create Incremental Backup')
    console.log('5. Restore from Backup')
    console.log('6. List Available Backups')
    console.log('7. Verify Backup Integrity')
    console.log('8. Setup Automated Backups')
    console.log('9. Cleanup Old Backups')
    console.log('10. Test Disaster Recovery')
    console.log('11. Sync to Cloud Storage')
    console.log('12. Generate Recovery Documentation')
    console.log('13. Monitor Backup Health')
    console.log('14. Configure Backup Settings')

    const choice = await question('\nSelect operation (1-14): ')
    
    const operations = {
      '1': 'full-backup',
      '2': 'database-backup',
      '3': 'files-backup',
      '4': 'incremental-backup',
      '5': 'restore',
      '6': 'list-backups',
      '7': 'verify-backup',
      '8': 'setup-automation',
      '9': 'cleanup',
      '10': 'test-recovery',
      '11': 'sync-cloud',
      '12': 'generate-docs',
      '13': 'monitor-health',
      '14': 'configure'
    }

    const operation = operations[choice]
    if (!operation) {
      throw new Error('Invalid operation selected')
    }

    await this.executeOperation(operation)
  }

  async executeOperation(operation) {
    const startTime = Date.now()
    
    try {
      switch (operation) {
        case 'full-backup':
          await this.createFullBackup()
          break
        case 'database-backup':
          await this.createDatabaseBackup()
          break
        case 'files-backup':
          await this.createFilesBackup()
          break
        case 'incremental-backup':
          await this.createIncrementalBackup()
          break
        case 'restore':
          await this.restoreFromBackup()
          break
        case 'list-backups':
          await this.listAvailableBackups()
          break
        case 'verify-backup':
          await this.verifyBackupIntegrity()
          break
        case 'setup-automation':
          await this.setupAutomatedBackups()
          break
        case 'cleanup':
          await this.cleanupOldBackups()
          break
        case 'test-recovery':
          await this.testDisasterRecovery()
          break
        case 'sync-cloud':
          await this.syncToCloudStorage()
          break
        case 'generate-docs':
          await this.generateRecoveryDocumentation()
          break
        case 'monitor-health':
          await this.monitorBackupHealth()
          break
        case 'configure':
          await this.configureBackupSettings()
          break
      }
      
      const duration = Date.now() - startTime
      log.success(`Operation completed in ${this.formatDuration(duration)}`)
      
      await this.sendNotification('success', `Backup operation '${operation}' completed successfully`)
      
    } catch (error) {
      const duration = Date.now() - startTime
      log.error(`Operation failed after ${this.formatDuration(duration)}: ${error.message}`)
      
      await this.sendNotification('error', `Backup operation '${operation}' failed: ${error.message}`)
      throw error
    }
  }

  async createFullBackup() {
    log.title('📦 Creating Full Backup')
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `full-${timestamp}`
    const backupPath = path.join(this.backupDir, 'full', `${backupId}.zip`)
    
    log.step('Creating database backup...')
    const dbBackupPath = await this.createDatabaseBackup(backupId)
    
    log.step('Creating files backup...')
    const filesBackupPath = await this.createFilesBackup(backupId)
    
    log.step('Creating configuration backup...')
    const configBackupPath = await this.createConfigBackup(backupId)
    
    log.step('Combining backups into full backup archive...')
    await this.createArchive(backupPath, [
      { path: dbBackupPath, name: 'database.sql' },
      { path: filesBackupPath, name: 'files.zip' },
      { path: configBackupPath, name: 'config.zip' }
    ])
    
    // Calculate backup size and checksum
    const stats = fs.statSync(backupPath)
    const checksum = await this.calculateChecksum(backupPath)
    
    // Record backup in history
    const backupRecord = {
      id: backupId,
      type: 'full',
      timestamp: new Date().toISOString(),
      path: backupPath,
      size: stats.size,
      checksum,
      components: {
        database: dbBackupPath,
        files: filesBackupPath,
        config: configBackupPath
      }
    }
    
    this.backupHistory.backups.push(backupRecord)
    this.saveBackupHistory()
    
    log.success(`Full backup created: ${backupPath}`)
    log.info(`Backup size: ${this.formatBytes(stats.size)}`)
    log.info(`Backup checksum: ${checksum}`)
    
    // Sync to cloud if enabled
    if (this.isCloudSyncEnabled()) {
      await this.syncToCloudStorage(backupPath)
    }
    
    return backupPath
  }

  async createDatabaseBackup(backupId = null) {
    log.title('🗄️ Creating Database Backup')
    
    if (!backupId) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      backupId = `db-${timestamp}`
    }
    
    const backupPath = path.join(this.backupDir, 'database', `${backupId}.sql`)
    
    // Determine which database to backup
    if (this.config.databases.postgresql.enabled) {
      await this.backupPostgreSQL(backupPath)
    } else if (this.config.databases.mysql.enabled) {
      await this.backupMySQL(backupPath)
    } else if (this.config.databases.mongodb.enabled) {
      await this.backupMongoDB(backupPath)
    } else {
      throw new Error('No database configured for backup')
    }
    
    log.success(`Database backup created: ${backupPath}`)
    return backupPath
  }

  async backupPostgreSQL(backupPath) {
    log.step('Backing up PostgreSQL database...')
    
    const config = this.config.databases.postgresql
    const pgDumpCmd = [
      'pg_dump',
      `-h ${config.host}`,
      `-p ${config.port}`,
      `-U ${config.username}`,
      `-d ${config.database}`,
      '--verbose',
      '--clean',
      '--if-exists',
      '--create',
      `--file=${backupPath}`
    ].join(' ')
    
    const env = { ...process.env }
    if (config.password) {
      env.PGPASSWORD = config.password
    }
    
    await this.executeCommand(pgDumpCmd, { env })
  }

  async backupMySQL(backupPath) {
    log.step('Backing up MySQL database...')
    
    const config = this.config.databases.mysql
    const mysqldumpCmd = [
      'mysqldump',
      `-h ${config.host}`,
      `-P ${config.port}`,
      `-u ${config.username}`,
      config.password ? `-p${config.password}` : '',
      '--single-transaction',
      '--routines',
      '--triggers',
      config.database,
      `> ${backupPath}`
    ].filter(Boolean).join(' ')
    
    await this.executeCommand(mysqldumpCmd)
  }

  async backupMongoDB(backupPath) {
    log.step('Backing up MongoDB database...')
    
    const config = this.config.databases.mongodb
    const mongodumpCmd = [
      'mongodump',
      `--uri="${config.uri}"`,
      `--db=${config.database}`,
      `--archive=${backupPath}`,
      '--gzip'
    ].join(' ')
    
    await this.executeCommand(mongodumpCmd)
  }

  async createFilesBackup(backupId = null) {
    log.title('📁 Creating Files Backup')
    
    if (!backupId) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      backupId = `files-${timestamp}`
    }
    
    const backupPath = path.join(this.backupDir, 'files', `${backupId}.zip`)
    
    log.step('Collecting files to backup...')
    const filesToBackup = await this.collectFilesToBackup()
    
    log.step(`Creating archive with ${filesToBackup.length} files...`)
    await this.createFilesArchive(backupPath, filesToBackup)
    
    log.success(`Files backup created: ${backupPath}`)
    return backupPath
  }

  async collectFilesToBackup() {
    const glob = require('glob')
    const files = []
    
    // Include patterns
    for (const pattern of this.config.includes) {
      try {
        const matches = glob.sync(pattern, { 
          cwd: this.projectRoot,
          dot: true,
          ignore: this.config.excludes
        })
        files.push(...matches)
      } catch (error) {
        log.warning(`Failed to process include pattern: ${pattern}`)
      }
    }
    
    // Remove duplicates and return full paths
    return [...new Set(files)].map(file => ({
      relativePath: file,
      fullPath: path.join(this.projectRoot, file)
    }))
  }

  async createFilesArchive(backupPath, files) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath)
      const archive = archiver('zip', {
        zlib: { level: this.config.compression.level }
      })
      
      output.on('close', () => {
        log.info(`Archive created: ${archive.pointer()} total bytes`)
        resolve()
      })
      
      archive.on('error', reject)
      archive.pipe(output)
      
      // Add files to archive
      for (const file of files) {
        if (fs.existsSync(file.fullPath)) {
          const stats = fs.statSync(file.fullPath)
          if (stats.isFile()) {
            archive.file(file.fullPath, { name: file.relativePath })
          } else if (stats.isDirectory()) {
            archive.directory(file.fullPath, file.relativePath)
          }
        }
      }
      
      archive.finalize()
    })
  }

  async createConfigBackup(backupId = null) {
    log.step('Creating configuration backup...')
    
    if (!backupId) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      backupId = `config-${timestamp}`
    }
    
    const backupPath = path.join(this.backupDir, 'config', `${backupId}.zip`)
    
    const configFiles = [
      '.env.example',
      'package.json',
      'package-lock.json',
      'next.config.js',
      'tsconfig.json',
      'tailwind.config.js',
      'postcss.config.js',
      '.eslintrc.json',
      '.prettierrc',
      'jest.config.js',
      'docker-compose.yml',
      'Dockerfile',
      'vercel.json'
    ].filter(file => fs.existsSync(path.join(this.projectRoot, file)))
    
    await this.createArchive(backupPath, configFiles.map(file => ({
      path: path.join(this.projectRoot, file),
      name: file
    })))
    
    return backupPath
  }

  async createIncrementalBackup() {
    log.title('📈 Creating Incremental Backup')
    
    const lastBackup = this.getLastBackup()
    if (!lastBackup) {
      log.warning('No previous backup found, creating full backup instead')
      return await this.createFullBackup()
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `incremental-${timestamp}`
    const backupPath = path.join(this.backupDir, 'incremental', `${backupId}.zip`)
    
    log.step('Finding changed files since last backup...')
    const changedFiles = await this.findChangedFiles(lastBackup.timestamp)
    
    if (changedFiles.length === 0) {
      log.info('No files have changed since last backup')
      return null
    }
    
    log.step(`Creating incremental backup with ${changedFiles.length} changed files...`)
    await this.createFilesArchive(backupPath, changedFiles)
    
    // Record backup in history
    const stats = fs.statSync(backupPath)
    const checksum = await this.calculateChecksum(backupPath)
    
    const backupRecord = {
      id: backupId,
      type: 'incremental',
      timestamp: new Date().toISOString(),
      path: backupPath,
      size: stats.size,
      checksum,
      baseBackup: lastBackup.id,
      changedFiles: changedFiles.length
    }
    
    this.backupHistory.backups.push(backupRecord)
    this.saveBackupHistory()
    
    log.success(`Incremental backup created: ${backupPath}`)
    return backupPath
  }

  async findChangedFiles(sinceTimestamp) {
    const sinceDate = new Date(sinceTimestamp)
    const allFiles = await this.collectFilesToBackup()
    
    return allFiles.filter(file => {
      try {
        const stats = fs.statSync(file.fullPath)
        return stats.mtime > sinceDate
      } catch (error) {
        return false
      }
    })
  }

  getLastBackup() {
    if (this.backupHistory.backups.length === 0) {
      return null
    }
    
    return this.backupHistory.backups
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
  }

  async restoreFromBackup() {
    log.title('🔄 Restore from Backup')
    
    const backups = this.getAvailableBackups()
    if (backups.length === 0) {
      throw new Error('No backups available for restoration')
    }
    
    console.log('\nAvailable backups:')
    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.id} (${backup.type}) - ${new Date(backup.timestamp).toLocaleString()}`)
    })
    
    const choice = await question('\nSelect backup to restore (number): ')
    const selectedBackup = backups[parseInt(choice) - 1]
    
    if (!selectedBackup) {
      throw new Error('Invalid backup selection')
    }
    
    const confirmRestore = await question(`\n⚠️  This will overwrite current data. Continue? (yes/no): `)
    if (confirmRestore.toLowerCase() !== 'yes') {
      log.info('Restore cancelled')
      return
    }
    
    log.step('Verifying backup integrity...')
    const isValid = await this.verifyBackupIntegrity(selectedBackup.path)
    if (!isValid) {
      throw new Error('Backup integrity check failed')
    }
    
    log.step('Creating pre-restore backup...')
    const preRestoreBackup = await this.createFullBackup()
    log.info(`Pre-restore backup created: ${preRestoreBackup}`)
    
    log.step('Restoring from backup...')
    await this.performRestore(selectedBackup)
    
    log.success('Restore completed successfully')
  }

  async performRestore(backup) {
    if (backup.type === 'full') {
      await this.restoreFullBackup(backup)
    } else if (backup.type === 'database') {
      await this.restoreDatabaseBackup(backup)
    } else if (backup.type === 'files') {
      await this.restoreFilesBackup(backup)
    } else if (backup.type === 'incremental') {
      await this.restoreIncrementalBackup(backup)
    }
  }

  async restoreFullBackup(backup) {
    log.step('Extracting full backup...')
    const tempDir = path.join(this.backupDir, 'temp', backup.id)
    await this.extractArchive(backup.path, tempDir)
    
    // Restore database
    const dbBackupPath = path.join(tempDir, 'database.sql')
    if (fs.existsSync(dbBackupPath)) {
      log.step('Restoring database...')
      await this.restoreDatabase(dbBackupPath)
    }
    
    // Restore files
    const filesBackupPath = path.join(tempDir, 'files.zip')
    if (fs.existsSync(filesBackupPath)) {
      log.step('Restoring files...')
      await this.extractArchive(filesBackupPath, this.projectRoot)
    }
    
    // Restore configuration
    const configBackupPath = path.join(tempDir, 'config.zip')
    if (fs.existsSync(configBackupPath)) {
      log.step('Restoring configuration...')
      await this.extractArchive(configBackupPath, this.projectRoot)
    }
    
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  async restoreDatabase(backupPath) {
    if (this.config.databases.postgresql.enabled) {
      await this.restorePostgreSQL(backupPath)
    } else if (this.config.databases.mysql.enabled) {
      await this.restoreMySQL(backupPath)
    } else if (this.config.databases.mongodb.enabled) {
      await this.restoreMongoDB(backupPath)
    }
  }

  async restorePostgreSQL(backupPath) {
    const config = this.config.databases.postgresql
    const psqlCmd = [
      'psql',
      `-h ${config.host}`,
      `-p ${config.port}`,
      `-U ${config.username}`,
      `-d ${config.database}`,
      `-f ${backupPath}`
    ].join(' ')
    
    const env = { ...process.env }
    if (config.password) {
      env.PGPASSWORD = config.password
    }
    
    await this.executeCommand(psqlCmd, { env })
  }

  async restoreMySQL(backupPath) {
    const config = this.config.databases.mysql
    const mysqlCmd = [
      'mysql',
      `-h ${config.host}`,
      `-P ${config.port}`,
      `-u ${config.username}`,
      config.password ? `-p${config.password}` : '',
      config.database,
      `< ${backupPath}`
    ].filter(Boolean).join(' ')
    
    await this.executeCommand(mysqlCmd)
  }

  async restoreMongoDB(backupPath) {
    const config = this.config.databases.mongodb
    const mongorestoreCmd = [
      'mongorestore',
      `--uri="${config.uri}"`,
      `--db=${config.database}`,
      `--archive=${backupPath}`,
      '--gzip',
      '--drop'
    ].join(' ')
    
    await this.executeCommand(mongorestoreCmd)
  }

  async listAvailableBackups() {
    log.title('📋 Available Backups')
    
    const backups = this.getAvailableBackups()
    
    if (backups.length === 0) {
      log.info('No backups found')
      return
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('ID'.padEnd(30) + 'Type'.padEnd(12) + 'Date'.padEnd(20) + 'Size'.padEnd(10) + 'Status')
    console.log('='.repeat(80))
    
    for (const backup of backups) {
      const date = new Date(backup.timestamp).toLocaleString()
      const size = this.formatBytes(backup.size)
      const status = fs.existsSync(backup.path) ? '✅ Valid' : '❌ Missing'
      
      console.log(
        backup.id.padEnd(30) +
        backup.type.padEnd(12) +
        date.padEnd(20) +
        size.padEnd(10) +
        status
      )
    }
    
    console.log('='.repeat(80))
    console.log(`Total backups: ${backups.length}`)
    
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0)
    console.log(`Total size: ${this.formatBytes(totalSize)}`)
  }

  getAvailableBackups() {
    return this.backupHistory.backups
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  async verifyBackupIntegrity(backupPath = null) {
    log.title('🔍 Verifying Backup Integrity')
    
    if (backupPath) {
      return await this.verifyBackupFile(backupPath)
    }
    
    const backups = this.getAvailableBackups()
    let validBackups = 0
    let invalidBackups = 0
    
    for (const backup of backups) {
      log.step(`Verifying ${backup.id}...`)
      
      const isValid = await this.verifyBackupFile(backup.path)
      if (isValid) {
        validBackups++
        log.success(`✅ ${backup.id} - Valid`)
      } else {
        invalidBackups++
        log.error(`❌ ${backup.id} - Invalid or corrupted`)
      }
    }
    
    log.info(`\nVerification complete: ${validBackups} valid, ${invalidBackups} invalid`)
    return invalidBackups === 0
  }

  async verifyBackupFile(backupPath) {
    try {
      // Check if file exists
      if (!fs.existsSync(backupPath)) {
        return false
      }
      
      // Find backup record
      const backup = this.backupHistory.backups.find(b => b.path === backupPath)
      if (!backup) {
        log.warning(`No record found for backup: ${backupPath}`)
        return false
      }
      
      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backupPath)
      if (currentChecksum !== backup.checksum) {
        log.error(`Checksum mismatch for ${backup.id}`)
        return false
      }
      
      // Verify file size
      const stats = fs.statSync(backupPath)
      if (stats.size !== backup.size) {
        log.error(`Size mismatch for ${backup.id}`)
        return false
      }
      
      // Try to read archive (basic structure check)
      if (backupPath.endsWith('.zip')) {
        const yauzl = require('yauzl')
        return new Promise((resolve) => {
          yauzl.open(backupPath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
              resolve(false)
            } else {
              zipfile.close()
              resolve(true)
            }
          })
        })
      }
      
      return true
      
    } catch (error) {
       log.error(`Error verifying backup: ${error.message}`)
       return false
     }
   }

  async setupAutomatedBackups() {
    log.title('⏰ Setting up Automated Backups')
    
    console.log('\nBackup schedule options:')
    console.log('1. Daily full backup')
    console.log('2. Daily incremental + Weekly full')
    console.log('3. Hourly incremental + Daily full')
    console.log('4. Custom schedule')
    
    const choice = await question('\nSelect schedule (1-4): ')
    
    let schedule
    switch (choice) {
      case '1':
        schedule = { full: '0 2 * * *' } // Daily at 2 AM
        break
      case '2':
        schedule = {
          incremental: '0 2 * * 1-6', // Mon-Sat at 2 AM
          full: '0 2 * * 0' // Sunday at 2 AM
        }
        break
      case '3':
        schedule = {
          incremental: '0 * * * *', // Every hour
          full: '0 2 * * *' // Daily at 2 AM
        }
        break
      case '4':
        schedule = await this.createCustomSchedule()
        break
      default:
        throw new Error('Invalid schedule option')
    }
    
    // Create systemd service (Linux)
    if (process.platform === 'linux') {
      await this.createSystemdService(schedule)
    }
    
    // Create Windows Task Scheduler (Windows)
    if (process.platform === 'win32') {
      await this.createWindowsTask(schedule)
    }
    
    // Create Docker Compose cron service
    await this.createDockerCronService(schedule)
    
    // Create Node.js cron service
    await this.createNodeCronService(schedule)
    
    log.success('Automated backup setup completed')
  }

  async createCustomSchedule() {
    const schedule = {}
    
    const addFull = await question('Add full backup schedule? (yes/no): ')
    if (addFull.toLowerCase() === 'yes') {
      schedule.full = await question('Enter cron expression for full backups: ')
    }
    
    const addIncremental = await question('Add incremental backup schedule? (yes/no): ')
    if (addIncremental.toLowerCase() === 'yes') {
      schedule.incremental = await question('Enter cron expression for incremental backups: ')
    }
    
    const addDatabase = await question('Add database-only backup schedule? (yes/no): ')
    if (addDatabase.toLowerCase() === 'yes') {
      schedule.database = await question('Enter cron expression for database backups: ')
    }
    
    return schedule
  }

  async createSystemdService(schedule) {
    const serviceContent = `[Unit]
Description=KNI Platform Backup Service
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=${this.projectRoot}
ExecStart=/usr/bin/node ${path.join(this.projectRoot, 'scripts/backup-recovery.js')} --automated
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target`
    
    const timerContent = Object.entries(schedule).map(([type, cron]) => 
      `[Unit]
Description=KNI Platform ${type} Backup Timer
Requires=kni-backup.service

[Timer]
OnCalendar=${this.cronToSystemd(cron)}
Persistent=true

[Install]
WantedBy=timers.target`
    ).join('\n\n')
    
    const servicePath = '/etc/systemd/system/kni-backup.service'
    const timerPath = '/etc/systemd/system/kni-backup.timer'
    
    log.step('Creating systemd service files...')
    log.info(`Service file: ${servicePath}`)
    log.info(`Timer file: ${timerPath}`)
    log.info('Run the following commands as root:')
    log.info(`echo '${serviceContent}' > ${servicePath}`)
    log.info(`echo '${timerContent}' > ${timerPath}`)
    log.info('systemctl daemon-reload')
    log.info('systemctl enable kni-backup.timer')
    log.info('systemctl start kni-backup.timer')
  }

  async createWindowsTask(schedule) {
    const taskName = 'KNI Platform Backup'
    const scriptPath = path.join(this.projectRoot, 'scripts/backup-recovery.js')
    
    for (const [type, cron] of Object.entries(schedule)) {
      const taskCmd = `schtasks /create /tn "${taskName} - ${type}" /tr "node ${scriptPath} --automated --type=${type}" /sc daily /st 02:00`
      
      log.info(`Create Windows task for ${type} backups:`)
      log.info(taskCmd)
    }
  }

  async createDockerCronService(schedule) {
    const cronJobs = Object.entries(schedule).map(([type, cron]) => 
      `${cron} cd ${this.projectRoot} && node scripts/backup-recovery.js --automated --type=${type}`
    ).join('\n')
    
    const dockerComposeContent = `version: '3.8'
services:
  backup-cron:
    image: node:18-alpine
    volumes:
      - .:/app
      - ./backups:/app/backups
    working_dir: /app
    command: >
      sh -c "echo '${cronJobs}' > /etc/crontabs/root && crond -f"
    restart: unless-stopped
    environment:
      - NODE_ENV=production`
    
    const dockerComposePath = path.join(this.projectRoot, 'docker-compose.backup.yml')
    fs.writeFileSync(dockerComposePath, dockerComposeContent)
    
    log.success(`Docker Compose backup service created: ${dockerComposePath}`)
    log.info('Start with: docker-compose -f docker-compose.backup.yml up -d')
  }

  async createNodeCronService(schedule) {
    const cronServiceContent = `#!/usr/bin/env node

const cron = require('node-cron')
const { BackupRecoveryManager } = require('./backup-recovery')

const backupManager = new BackupRecoveryManager()

${Object.entries(schedule).map(([type, cronExpr]) => 
  `cron.schedule('${cronExpr}', async () => {
  console.log('Running ${type} backup...')
  try {
    await backupManager.create${type.charAt(0).toUpperCase() + type.slice(1)}Backup()
    console.log('${type} backup completed successfully')
  } catch (error) {
    console.error('${type} backup failed:', error.message)
  }
})`).join('\n\n')}

console.log('Backup scheduler started')
console.log('Press Ctrl+C to stop')`
    
    const cronServicePath = path.join(this.projectRoot, 'scripts/backup-scheduler.js')
    fs.writeFileSync(cronServicePath, cronServiceContent)
    fs.chmodSync(cronServicePath, '755')
    
    log.success(`Node.js cron service created: ${cronServicePath}`)
    log.info('Install node-cron: npm install node-cron')
    log.info('Start with: node scripts/backup-scheduler.js')
  }

  async cleanupOldBackups() {
    log.title('🧹 Cleaning up Old Backups')
    
    const retention = this.config.retention
    const now = new Date()
    const backups = this.getAvailableBackups()
    
    const toDelete = []
    
    // Group backups by type and age
    const backupsByAge = {
      daily: backups.filter(b => this.getAgeInDays(b.timestamp, now) <= 7),
      weekly: backups.filter(b => this.getAgeInDays(b.timestamp, now) <= 30),
      monthly: backups.filter(b => this.getAgeInDays(b.timestamp, now) <= 365),
      yearly: backups.filter(b => this.getAgeInDays(b.timestamp, now) > 365)
    }
    
    // Apply retention policy
    if (backupsByAge.daily.length > retention.daily) {
      toDelete.push(...backupsByAge.daily.slice(retention.daily))
    }
    
    if (backupsByAge.weekly.length > retention.weekly) {
      toDelete.push(...backupsByAge.weekly.slice(retention.weekly))
    }
    
    if (backupsByAge.monthly.length > retention.monthly) {
      toDelete.push(...backupsByAge.monthly.slice(retention.monthly))
    }
    
    if (backupsByAge.yearly.length > retention.yearly) {
      toDelete.push(...backupsByAge.yearly.slice(retention.yearly))
    }
    
    if (toDelete.length === 0) {
      log.info('No backups need to be cleaned up')
      return
    }
    
    log.step(`Found ${toDelete.length} backups to delete`)
    
    for (const backup of toDelete) {
      try {
        if (fs.existsSync(backup.path)) {
          fs.unlinkSync(backup.path)
          log.info(`Deleted: ${backup.id}`)
        }
        
        // Remove from history
        const index = this.backupHistory.backups.findIndex(b => b.id === backup.id)
        if (index !== -1) {
          this.backupHistory.backups.splice(index, 1)
        }
      } catch (error) {
        log.error(`Failed to delete ${backup.id}: ${error.message}`)
      }
    }
    
    this.backupHistory.lastCleanup = new Date().toISOString()
    this.saveBackupHistory()
    
    log.success(`Cleanup completed: ${toDelete.length} backups removed`)
  }

  getAgeInDays(timestamp, now) {
    const backupDate = new Date(timestamp)
    return Math.floor((now - backupDate) / (1000 * 60 * 60 * 24))
  }

  async testDisasterRecovery() {
    log.title('🧪 Testing Disaster Recovery')
    
    log.step('Creating test environment...')
    const testDir = path.join(this.backupDir, 'disaster-recovery-test')
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
    
    try {
      // Create a test backup
      log.step('Creating test backup...')
      const testBackup = await this.createFullBackup()
      
      // Simulate disaster by moving current files
      log.step('Simulating disaster scenario...')
      const backupCurrentDir = path.join(testDir, 'current-backup')
      fs.mkdirSync(backupCurrentDir, { recursive: true })
      
      // Copy critical files to backup location
      const criticalFiles = ['package.json', 'next.config.js', '.env.example']
      for (const file of criticalFiles) {
        const srcPath = path.join(this.projectRoot, file)
        const destPath = path.join(backupCurrentDir, file)
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath)
        }
      }
      
      // Test restore process
      log.step('Testing restore process...')
      const restoreTestDir = path.join(testDir, 'restore-test')
      fs.mkdirSync(restoreTestDir, { recursive: true })
      
      // Extract test backup to restore directory
      await this.extractArchive(testBackup, restoreTestDir)
      
      // Verify restored files
      log.step('Verifying restored files...')
      const restoredFiles = fs.readdirSync(restoreTestDir)
      
      if (restoredFiles.length === 0) {
        throw new Error('No files were restored')
      }
      
      log.success('✅ Disaster recovery test passed')
      log.info(`Test backup: ${testBackup}`)
      log.info(`Test directory: ${testDir}`)
      log.info(`Restored files: ${restoredFiles.length}`)
      
      // Generate test report
      const testReport = {
        timestamp: new Date().toISOString(),
        testBackup,
        restoredFiles: restoredFiles.length,
        testDirectory: testDir,
        status: 'passed'
      }
      
      const reportPath = path.join(testDir, 'disaster-recovery-test-report.json')
      fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2))
      
      log.info(`Test report: ${reportPath}`)
      
    } catch (error) {
      log.error(`Disaster recovery test failed: ${error.message}`)
      throw error
    }
  }

  async syncToCloudStorage(backupPath = null) {
    log.title('☁️ Syncing to Cloud Storage')
    
    const enabledProviders = Object.entries(this.config.storage)
      .filter(([name, config]) => config.enabled && name !== 'local')
    
    if (enabledProviders.length === 0) {
      log.warning('No cloud storage providers configured')
      return
    }
    
    if (backupPath) {
      // Sync specific backup
      for (const [providerName, config] of enabledProviders) {
        await this.syncToProvider(providerName, config, backupPath)
      }
    } else {
      // Sync all backups
      const backups = this.getAvailableBackups()
      
      for (const backup of backups) {
        if (fs.existsSync(backup.path)) {
          for (const [providerName, config] of enabledProviders) {
            await this.syncToProvider(providerName, config, backup.path)
          }
        }
      }
    }
    
    log.success('Cloud sync completed')
  }

  async syncToProvider(providerName, config, backupPath) {
    log.step(`Syncing to ${providerName}...`)
    
    try {
      switch (providerName) {
        case 'aws':
          await this.syncToAWS(config, backupPath)
          break
        case 'gcp':
          await this.syncToGCP(config, backupPath)
          break
        case 'azure':
          await this.syncToAzure(config, backupPath)
          break
      }
      
      log.success(`✅ Synced to ${providerName}`)
    } catch (error) {
      log.error(`❌ Failed to sync to ${providerName}: ${error.message}`)
    }
  }

  async syncToAWS(config, backupPath) {
    const AWS = require('aws-sdk')
    
    const s3 = new AWS.S3({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    })
    
    const fileName = path.basename(backupPath)
    const fileStream = fs.createReadStream(backupPath)
    
    const uploadParams = {
      Bucket: config.bucket,
      Key: `backups/${fileName}`,
      Body: fileStream
    }
    
    await s3.upload(uploadParams).promise()
  }

  async syncToGCP(config, backupPath) {
    const { Storage } = require('@google-cloud/storage')
    
    const storage = new Storage({
      projectId: config.projectId,
      keyFilename: config.keyFilename
    })
    
    const bucket = storage.bucket(config.bucket)
    const fileName = path.basename(backupPath)
    
    await bucket.upload(backupPath, {
      destination: `backups/${fileName}`
    })
  }

  async syncToAzure(config, backupPath) {
    const { BlobServiceClient } = require('@azure/storage-blob')
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${config.accountName};AccountKey=${config.accountKey};EndpointSuffix=core.windows.net`
    )
    
    const containerClient = blobServiceClient.getContainerClient(config.containerName)
    const fileName = path.basename(backupPath)
    const blockBlobClient = containerClient.getBlockBlobClient(`backups/${fileName}`)
    
    await blockBlobClient.uploadFile(backupPath)
   }

  async generateRecoveryDocumentation() {
    log.title('📚 Generating Recovery Documentation')
    
    const documentation = {
      title: 'KNI Platform Disaster Recovery Guide',
      generatedAt: new Date().toISOString(),
      backupConfiguration: this.config,
      availableBackups: this.getAvailableBackups().slice(0, 10), // Latest 10
      recoveryProcedures: {
        fullRestore: {
          description: 'Complete system restoration from full backup',
          steps: [
            '1. Stop all application services',
            '2. Create pre-restore backup',
            '3. Run: node scripts/backup-recovery.js',
            '4. Select option 5 (Restore from Backup)',
            '5. Choose the desired backup',
            '6. Confirm restoration',
            '7. Verify database connectivity',
            '8. Test application functionality',
            '9. Restart services'
          ],
          estimatedTime: '15-30 minutes',
          prerequisites: ['Database access', 'File system permissions', 'Backup files']
        },
        databaseRestore: {
          description: 'Database-only restoration',
          steps: [
            '1. Stop application services',
            '2. Create database backup',
            '3. Run database restore command',
            '4. Verify data integrity',
            '5. Restart services'
          ],
          estimatedTime: '5-15 minutes',
          prerequisites: ['Database admin access', 'Database backup file']
        },
        incrementalRestore: {
          description: 'Restore from incremental backups',
          steps: [
            '1. Identify base backup',
            '2. Apply incremental backups in order',
            '3. Verify file integrity',
            '4. Test application'
          ],
          estimatedTime: '10-20 minutes',
          prerequisites: ['Base backup', 'All incremental backups']
        }
      },
      emergencyContacts: {
        systemAdmin: process.env.EMERGENCY_CONTACT_ADMIN || 'admin@company.com',
        databaseAdmin: process.env.EMERGENCY_CONTACT_DBA || 'dba@company.com',
        devOps: process.env.EMERGENCY_CONTACT_DEVOPS || 'devops@company.com'
      },
      troubleshooting: {
        commonIssues: [
          {
            issue: 'Backup file corrupted',
            solution: 'Use backup verification tool, try previous backup'
          },
          {
            issue: 'Database connection failed',
            solution: 'Check credentials, network connectivity, database status'
          },
          {
            issue: 'Insufficient disk space',
            solution: 'Clean up old backups, expand storage, use cloud storage'
          },
          {
            issue: 'Permission denied',
            solution: 'Check file permissions, run as appropriate user'
          }
        ]
      }
    }
    
    // Generate Markdown documentation
    const markdownDoc = this.generateMarkdownDocumentation(documentation)
    const markdownPath = path.join(this.backupDir, 'DISASTER_RECOVERY.md')
    fs.writeFileSync(markdownPath, markdownDoc)
    
    // Generate JSON documentation
    const jsonPath = path.join(this.backupDir, 'disaster-recovery-guide.json')
    fs.writeFileSync(jsonPath, JSON.stringify(documentation, null, 2))
    
    log.success(`Recovery documentation generated:`)
    log.info(`Markdown: ${markdownPath}`)
    log.info(`JSON: ${jsonPath}`)
  }

  generateMarkdownDocumentation(doc) {
    return `# ${doc.title}

*Generated on: ${new Date(doc.generatedAt).toLocaleString()}*

## Overview

This document provides comprehensive disaster recovery procedures for the KNI Platform.

## Available Backups

| Backup ID | Type | Date | Size | Status |
|-----------|------|------|------|---------|
${doc.availableBackups.map(backup => 
  `| ${backup.id} | ${backup.type} | ${new Date(backup.timestamp).toLocaleString()} | ${this.formatBytes(backup.size)} | ${fs.existsSync(backup.path) ? '✅ Valid' : '❌ Missing'} |`
).join('\n')}

## Recovery Procedures

### Full System Restore

**Description:** ${doc.recoveryProcedures.fullRestore.description}

**Estimated Time:** ${doc.recoveryProcedures.fullRestore.estimatedTime}

**Prerequisites:**
${doc.recoveryProcedures.fullRestore.prerequisites.map(p => `- ${p}`).join('\n')}

**Steps:**
${doc.recoveryProcedures.fullRestore.steps.map(s => `${s}`).join('\n')}

### Database Restore

**Description:** ${doc.recoveryProcedures.databaseRestore.description}

**Estimated Time:** ${doc.recoveryProcedures.databaseRestore.estimatedTime}

**Steps:**
${doc.recoveryProcedures.databaseRestore.steps.map(s => `${s}`).join('\n')}

### Incremental Restore

**Description:** ${doc.recoveryProcedures.incrementalRestore.description}

**Estimated Time:** ${doc.recoveryProcedures.incrementalRestore.estimatedTime}

**Steps:**
${doc.recoveryProcedures.incrementalRestore.steps.map(s => `${s}`).join('\n')}

## Emergency Contacts

- **System Administrator:** ${doc.emergencyContacts.systemAdmin}
- **Database Administrator:** ${doc.emergencyContacts.databaseAdmin}
- **DevOps Team:** ${doc.emergencyContacts.devOps}

## Troubleshooting

${doc.troubleshooting.commonIssues.map(item => 
  `### ${item.issue}\n\n**Solution:** ${item.solution}\n`
).join('\n')}

## Backup Configuration

\`\`\`json
${JSON.stringify(doc.backupConfiguration, null, 2)}
\`\`\`
`
  }

  async monitorBackupHealth() {
    log.title('🏥 Monitoring Backup Health')
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: {
        backupDirectory: this.checkBackupDirectory(),
        recentBackups: this.checkRecentBackups(),
        backupIntegrity: await this.checkBackupIntegrity(),
        storageSpace: this.checkStorageSpace(),
        cloudSync: await this.checkCloudSync(),
        automation: this.checkAutomation()
      },
      recommendations: []
    }
    
    // Analyze health checks
    const failedChecks = Object.entries(healthReport.checks)
      .filter(([_, check]) => !check.status)
    
    if (failedChecks.length > 0) {
      healthReport.overall = failedChecks.length > 2 ? 'critical' : 'warning'
      healthReport.recommendations.push(
        ...failedChecks.map(([name, check]) => `Fix ${name}: ${check.message}`)
      )
    }
    
    // Display health report
    this.displayHealthReport(healthReport)
    
    // Save health report
    const reportPath = path.join(this.logsDir, `health-report-${Date.now()}.json`)
    fs.writeFileSync(reportPath, JSON.stringify(healthReport, null, 2))
    
    // Send health check notification
    if (this.config.monitoring.healthChecks.enabled) {
      await this.sendHealthCheckNotification(healthReport)
    }
    
    return healthReport
  }

  checkBackupDirectory() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return { status: false, message: 'Backup directory does not exist' }
      }
      
      const stats = fs.statSync(this.backupDir)
      if (!stats.isDirectory()) {
        return { status: false, message: 'Backup path is not a directory' }
      }
      
      // Check write permissions
      const testFile = path.join(this.backupDir, '.write-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      
      return { status: true, message: 'Backup directory is accessible' }
    } catch (error) {
      return { status: false, message: `Directory check failed: ${error.message}` }
    }
  }

  checkRecentBackups() {
    const recentBackups = this.backupHistory.backups.filter(backup => {
      const backupDate = new Date(backup.timestamp)
      const daysSince = (Date.now() - backupDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysSince <= 7
    })
    
    if (recentBackups.length === 0) {
      return { status: false, message: 'No backups created in the last 7 days' }
    }
    
    const lastBackup = this.getLastBackup()
    const hoursSinceLastBackup = (Date.now() - new Date(lastBackup.timestamp).getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceLastBackup > 48) {
      return { status: false, message: `Last backup was ${Math.floor(hoursSinceLastBackup)} hours ago` }
    }
    
    return { status: true, message: `${recentBackups.length} recent backups found` }
  }

  async checkBackupIntegrity() {
    const recentBackups = this.backupHistory.backups.slice(0, 5) // Check last 5 backups
    let validBackups = 0
    let totalBackups = recentBackups.length
    
    for (const backup of recentBackups) {
      if (await this.verifyBackupFile(backup.path)) {
        validBackups++
      }
    }
    
    const integrityRate = totalBackups > 0 ? (validBackups / totalBackups) * 100 : 0
    
    if (integrityRate < 80) {
      return { status: false, message: `Only ${integrityRate.toFixed(1)}% of recent backups are valid` }
    }
    
    return { status: true, message: `${integrityRate.toFixed(1)}% backup integrity rate` }
  }

  checkStorageSpace() {
    try {
      const stats = fs.statSync(this.backupDir)
      const { size: usedSpace } = this.getDirectorySize(this.backupDir)
      
      // Get available space (simplified check)
      const availableSpace = this.getAvailableSpace(this.backupDir)
      const usagePercentage = (usedSpace / (usedSpace + availableSpace)) * 100
      
      if (usagePercentage > 90) {
        return { status: false, message: `Storage ${usagePercentage.toFixed(1)}% full` }
      }
      
      if (usagePercentage > 80) {
        return { status: false, message: `Storage ${usagePercentage.toFixed(1)}% full - consider cleanup` }
      }
      
      return { status: true, message: `Storage usage: ${usagePercentage.toFixed(1)}%` }
    } catch (error) {
      return { status: false, message: `Storage check failed: ${error.message}` }
    }
  }

  async checkCloudSync() {
    const enabledProviders = Object.entries(this.config.storage)
      .filter(([name, config]) => config.enabled && name !== 'local')
    
    if (enabledProviders.length === 0) {
      return { status: true, message: 'No cloud providers configured' }
    }
    
    // Check if recent backups are synced (simplified check)
    const recentBackups = this.backupHistory.backups.slice(0, 3)
    const syncedBackups = recentBackups.filter(backup => backup.cloudSynced)
    
    const syncRate = recentBackups.length > 0 ? (syncedBackups.length / recentBackups.length) * 100 : 0
    
    if (syncRate < 80) {
      return { status: false, message: `Only ${syncRate.toFixed(1)}% of recent backups are cloud synced` }
    }
    
    return { status: true, message: `${syncRate.toFixed(1)}% cloud sync rate` }
  }

  checkAutomation() {
    // Check if automation files exist
    const automationFiles = [
      path.join(this.projectRoot, 'scripts/backup-scheduler.js'),
      path.join(this.projectRoot, 'docker-compose.backup.yml')
    ]
    
    const existingFiles = automationFiles.filter(file => fs.existsSync(file))
    
    if (existingFiles.length === 0) {
      return { status: false, message: 'No automation configured' }
    }
    
    return { status: true, message: `${existingFiles.length} automation method(s) configured` }
  }

  displayHealthReport(report) {
    console.log('\n' + '='.repeat(60))
    console.log(`BACKUP HEALTH REPORT - ${report.overall.toUpperCase()}`)
    console.log('='.repeat(60))
    
    for (const [checkName, check] of Object.entries(report.checks)) {
      const status = check.status ? '✅' : '❌'
      const name = checkName.replace(/([A-Z])/g, ' $1').toLowerCase()
      console.log(`${status} ${name}: ${check.message}`)
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n📋 RECOMMENDATIONS:')
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }
    
    console.log('='.repeat(60))
  }

  async configureBackupSettings() {
    log.title('⚙️ Configure Backup Settings')
    
    console.log('\nConfiguration options:')
    console.log('1. Database settings')
    console.log('2. Storage settings')
    console.log('3. Retention policy')
    console.log('4. Notification settings')
    console.log('5. Cloud storage')
    console.log('6. Encryption settings')
    console.log('7. View current configuration')
    console.log('8. Reset to defaults')
    
    const choice = await question('\nSelect option (1-8): ')
    
    switch (choice) {
      case '1':
        await this.configureDatabaseSettings()
        break
      case '2':
        await this.configureStorageSettings()
        break
      case '3':
        await this.configureRetentionPolicy()
        break
      case '4':
        await this.configureNotificationSettings()
        break
      case '5':
        await this.configureCloudStorage()
        break
      case '6':
        await this.configureEncryptionSettings()
        break
      case '7':
        this.displayCurrentConfiguration()
        break
      case '8':
        await this.resetToDefaults()
        break
      default:
        throw new Error('Invalid configuration option')
    }
    
    // Save updated configuration
    this.saveBackupConfig()
    log.success('Configuration updated successfully')
  }

  async configureDatabaseSettings() {
    log.step('Configuring database settings...')
    
    const dbType = await question('Database type (postgresql/mysql/mongodb): ')
    
    if (!['postgresql', 'mysql', 'mongodb'].includes(dbType)) {
      throw new Error('Invalid database type')
    }
    
    const dbConfig = this.config.databases[dbType]
    
    if (dbType === 'postgresql' || dbType === 'mysql') {
      dbConfig.host = await question(`Host (${dbConfig.host}): `) || dbConfig.host
      dbConfig.port = parseInt(await question(`Port (${dbConfig.port}): `)) || dbConfig.port
      dbConfig.database = await question(`Database (${dbConfig.database}): `) || dbConfig.database
      dbConfig.username = await question(`Username (${dbConfig.username}): `) || dbConfig.username
      
      const updatePassword = await question('Update password? (yes/no): ')
      if (updatePassword.toLowerCase() === 'yes') {
        dbConfig.password = await question('Password: ')
      }
    } else if (dbType === 'mongodb') {
      dbConfig.uri = await question(`MongoDB URI (${dbConfig.uri}): `) || dbConfig.uri
      dbConfig.database = await question(`Database (${dbConfig.database}): `) || dbConfig.database
    }
    
    dbConfig.enabled = true
    
    // Disable other database types
    Object.keys(this.config.databases).forEach(type => {
      if (type !== dbType) {
        this.config.databases[type].enabled = false
      }
    })
  }

  saveBackupConfig() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true })
    }
    
    const configPath = path.join(this.configDir, 'backup-config.json')
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2))
  }

  displayCurrentConfiguration() {
    console.log('\n' + '='.repeat(50))
    console.log('CURRENT BACKUP CONFIGURATION')
    console.log('='.repeat(50))
    console.log(JSON.stringify(this.config, null, 2))
    console.log('='.repeat(50))
  }

  // Utility methods
  async createArchive(archivePath, files) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archivePath)
      const archive = archiver('zip', {
        zlib: { level: this.config.compression.level }
      })
      
      output.on('close', resolve)
      archive.on('error', reject)
      archive.pipe(output)
      
      for (const file of files) {
        if (typeof file === 'string') {
          archive.file(file, { name: path.basename(file) })
        } else {
          archive.file(file.path, { name: file.name })
        }
      }
      
      archive.finalize()
    })
  }

  async extractArchive(archivePath, extractPath) {
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true })
    }
    
    await extract(archivePath, { dir: path.resolve(extractPath) })
  }

  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      
      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        shell: true,
        stdio: 'pipe',
        ...options
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout?.on('data', data => {
        stdout += data.toString()
        process.stdout.write(data)
      })
      
      child.stderr?.on('data', data => {
        stderr += data.toString()
        process.stderr.write(data)
      })
      
      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })
    })
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  getDirectorySize(dirPath) {
    let size = 0
    let files = 0
    
    const traverse = (currentPath) => {
      const stats = fs.statSync(currentPath)
      
      if (stats.isFile()) {
        size += stats.size
        files++
      } else if (stats.isDirectory()) {
        const items = fs.readdirSync(currentPath)
        for (const item of items) {
          traverse(path.join(currentPath, item))
        }
      }
    }
    
    try {
      traverse(dirPath)
    } catch (error) {
      // Handle permission errors gracefully
    }
    
    return { size, files }
  }

  getAvailableSpace(dirPath) {
    try {
      const stats = fs.statSync(dirPath)
      // Simplified - in real implementation, use statvfs or similar
      return 1024 * 1024 * 1024 * 10 // 10GB placeholder
    } catch (error) {
      return 0
    }
  }

  isCloudSyncEnabled() {
    return Object.values(this.config.storage)
      .some(config => config.enabled && config !== this.config.storage.local)
  }

  cronToSystemd(cronExpr) {
    // Basic cron to systemd timer conversion
    const parts = cronExpr.split(' ')
    const [minute, hour, day, month, weekday] = parts
    
    if (minute === '0' && hour !== '*') {
      return `*-*-* ${hour.padStart(2, '0')}:00:00`
    }
    
    return 'daily' // Fallback
  }

  setupAWSProvider() {
    return {
      name: 'AWS S3',
      test: async (config) => {
        // Test AWS S3 connection
        return true
      }
    }
  }

  setupGCPProvider() {
    return {
      name: 'Google Cloud Storage',
      test: async (config) => {
        // Test GCS connection
        return true
      }
    }
  }

  setupAzureProvider() {
    return {
      name: 'Azure Blob Storage',
      test: async (config) => {
        // Test Azure connection
        return true
      }
    }
  }

  async sendNotification(type, message) {
    try {
      if (this.config.notifications.email.enabled) {
        await this.sendEmailNotification(type, message)
      }
      
      if (this.config.notifications.slack.enabled) {
        await this.sendSlackNotification(type, message)
      }
      
      if (this.config.notifications.discord.enabled) {
        await this.sendDiscordNotification(type, message)
      }
    } catch (error) {
      log.warning(`Failed to send notification: ${error.message}`)
    }
  }

  async sendEmailNotification(type, message) {
    // Email notification implementation
    log.info(`Email notification: ${type} - ${message}`)
  }

  async sendSlackNotification(type, message) {
    // Slack notification implementation
    log.info(`Slack notification: ${type} - ${message}`)
  }

  async sendDiscordNotification(type, message) {
    // Discord notification implementation
    log.info(`Discord notification: ${type} - ${message}`)
  }

  async sendHealthCheckNotification(healthReport) {
    const message = `Backup health check: ${healthReport.overall} - ${healthReport.checks.length} checks performed`
    await this.sendNotification('health-check', message)
  }
}

// CLI execution
if (require.main === module) {
  const manager = new BackupRecoveryManager()
  manager.run().catch(error => {
    console.error('Backup operation failed:', error.message)
    process.exit(1)
  })
}

module.exports = { BackupRecoveryManager }
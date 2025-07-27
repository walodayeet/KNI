#!/usr/bin/env node

/**
 * KNI Platform Code Quality & Analysis Suite
 * 
 * This script provides comprehensive code quality tools:
 * - Static code analysis and linting
 * - Code formatting and style checking
 * - Security vulnerability scanning
 * - Code complexity analysis
 * - Test coverage analysis
 * - Performance analysis
 * - Dependency analysis
 * - Code duplication detection
 * - Documentation coverage
 * - Quality metrics and reporting
 * - Automated code fixes
 * - Pre-commit hooks setup
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')
const readline = require('readline')
const crypto = require('crypto')

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
  metric: (name, value, unit = '') => {
    const color = value > 80 ? colors.green : value > 60 ? colors.yellow : colors.red
    console.log(`${color}${name}: ${value}${unit}${colors.reset}`)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class CodeQualityAnalyzer {
  constructor() {
    this.projectRoot = process.cwd()
    this.reportsDir = path.join(this.projectRoot, 'quality-reports')
    this.configDir = path.join(this.projectRoot, '.quality-config')
    
    this.analysisResults = {
      linting: {},
      formatting: {},
      security: {},
      complexity: {},
      coverage: {},
      dependencies: {},
      duplication: {},
      documentation: {},
      performance: {}
    }
    
    this.qualityConfig = this.loadQualityConfig()
    this.filePatterns = this.getFilePatterns()
  }

  loadQualityConfig() {
    const defaultConfig = {
      thresholds: {
        coverage: 80,
        complexity: 10,
        duplication: 5,
        maintainability: 70,
        security: 0
      },
      rules: {
        eslint: {
          extends: ['next/core-web-vitals', '@typescript-eslint/recommended'],
          rules: {
            'no-console': 'warn',
            'no-unused-vars': 'error',
            '@typescript-eslint/no-explicit-any': 'warn'
          }
        },
        prettier: {
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5'
        }
      },
      excludePatterns: [
        'node_modules/**',
        '.next/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.min.js'
      ],
      includePatterns: [
        'src/**/*.{js,jsx,ts,tsx}',
        'pages/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'lib/**/*.{js,jsx,ts,tsx}',
        'utils/**/*.{js,jsx,ts,tsx}'
      ]
    }

    const configPath = path.join(this.configDir, 'quality-config.json')
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
        return { ...defaultConfig, ...userConfig }
      } catch (error) {
        log.warning('Failed to load quality config, using defaults')
      }
    }

    return defaultConfig
  }

  getFilePatterns() {
    return {
      javascript: '**/*.{js,jsx}',
      typescript: '**/*.{ts,tsx}',
      styles: '**/*.{css,scss,sass,less}',
      config: '**/*.{json,yaml,yml}',
      markdown: '**/*.md',
      all: '**/*.{js,jsx,ts,tsx,css,scss,sass,less,json,yaml,yml,md}'
    }
  }

  async run() {
    try {
      log.title('🔍 KNI Platform Code Quality Analyzer')
      console.log('Comprehensive code quality analysis and improvement tools\n')

      await this.ensureDirectories()
      await this.selectAnalysisType()
      
    } catch (error) {
      log.error(`Code quality analysis failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async ensureDirectories() {
    const directories = [this.reportsDir, this.configDir]
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async selectAnalysisType() {
    console.log('Available analysis types:')
    console.log('1. Full Quality Analysis')
    console.log('2. Linting & Code Style')
    console.log('3. Security Scan')
    console.log('4. Code Complexity Analysis')
    console.log('5. Test Coverage Analysis')
    console.log('6. Dependency Analysis')
    console.log('7. Code Duplication Detection')
    console.log('8. Documentation Coverage')
    console.log('9. Performance Analysis')
    console.log('10. Auto-fix Issues')
    console.log('11. Setup Pre-commit Hooks')
    console.log('12. Generate Quality Report')

    const choice = await question('\nSelect analysis type (1-12): ')
    
    const analysisTypes = {
      '1': 'full-analysis',
      '2': 'linting',
      '3': 'security',
      '4': 'complexity',
      '5': 'coverage',
      '6': 'dependencies',
      '7': 'duplication',
      '8': 'documentation',
      '9': 'performance',
      '10': 'auto-fix',
      '11': 'setup-hooks',
      '12': 'generate-report'
    }

    const analysisType = analysisTypes[choice]
    if (!analysisType) {
      throw new Error('Invalid analysis type selected')
    }

    await this.executeAnalysis(analysisType)
  }

  async executeAnalysis(analysisType) {
    switch (analysisType) {
      case 'full-analysis':
        await this.runFullAnalysis()
        break
      case 'linting':
        await this.runLintingAnalysis()
        break
      case 'security':
        await this.runSecurityScan()
        break
      case 'complexity':
        await this.runComplexityAnalysis()
        break
      case 'coverage':
        await this.runCoverageAnalysis()
        break
      case 'dependencies':
        await this.runDependencyAnalysis()
        break
      case 'duplication':
        await this.runDuplicationDetection()
        break
      case 'documentation':
        await this.runDocumentationAnalysis()
        break
      case 'performance':
        await this.runPerformanceAnalysis()
        break
      case 'auto-fix':
        await this.runAutoFix()
        break
      case 'setup-hooks':
        await this.setupPreCommitHooks()
        break
      case 'generate-report':
        await this.generateQualityReport()
        break
    }
  }

  async runFullAnalysis() {
    log.title('🔍 Running Full Code Quality Analysis')
    
    const analyses = [
      { name: 'Linting & Code Style', run: () => this.runLintingAnalysis() },
      { name: 'Security Scan', run: () => this.runSecurityScan() },
      { name: 'Code Complexity', run: () => this.runComplexityAnalysis() },
      { name: 'Test Coverage', run: () => this.runCoverageAnalysis() },
      { name: 'Dependency Analysis', run: () => this.runDependencyAnalysis() },
      { name: 'Code Duplication', run: () => this.runDuplicationDetection() },
      { name: 'Documentation Coverage', run: () => this.runDocumentationAnalysis() }
    ]

    const startTime = Date.now()
    
    for (const analysis of analyses) {
      log.step(`Running ${analysis.name}...`)
      try {
        await analysis.run()
        log.success(`${analysis.name} completed`)
      } catch (error) {
        log.error(`${analysis.name} failed: ${error.message}`)
      }
    }

    const duration = Date.now() - startTime
    
    // Generate comprehensive report
    await this.generateQualityReport()
    
    log.success(`Full analysis completed in ${this.formatDuration(duration)}`)
    
    // Display summary
    this.displayQualitySummary()
  }

  async runLintingAnalysis() {
    log.title('📝 Linting & Code Style Analysis')
    
    const lintingResults = {
      eslint: await this.runESLint(),
      prettier: await this.runPrettier(),
      typescript: await this.runTypeScript(),
      stylelint: await this.runStylelint()
    }
    
    this.analysisResults.linting = lintingResults
    
    // Display results
    this.displayLintingResults(lintingResults)
    
    log.success('Linting analysis completed')
  }

  async runESLint() {
    log.step('Running ESLint...')
    
    try {
      // Check if ESLint is installed
      const eslintPath = this.findExecutable('eslint')
      if (!eslintPath) {
        log.warning('ESLint not found, installing...')
        await this.installDependency('eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-next')
      }
      
      // Create ESLint config if it doesn't exist
      await this.ensureESLintConfig()
      
      // Run ESLint
      const result = await this.executeCommand('npx eslint . --ext .js,.jsx,.ts,.tsx --format json', { ignoreErrors: true })
      
      if (result.stdout) {
        const eslintResults = JSON.parse(result.stdout)
        
        const summary = {
          totalFiles: eslintResults.length,
          totalErrors: eslintResults.reduce((sum, file) => sum + file.errorCount, 0),
          totalWarnings: eslintResults.reduce((sum, file) => sum + file.warningCount, 0),
          fixableErrors: eslintResults.reduce((sum, file) => sum + file.fixableErrorCount, 0),
          fixableWarnings: eslintResults.reduce((sum, file) => sum + file.fixableWarningCount, 0),
          files: eslintResults.filter(file => file.errorCount > 0 || file.warningCount > 0)
        }
        
        return summary
      }
      
      return { totalFiles: 0, totalErrors: 0, totalWarnings: 0, files: [] }
    } catch (error) {
      log.error(`ESLint analysis failed: ${error.message}`)
      return { error: error.message }
    }
  }

  async runPrettier() {
    log.step('Running Prettier...')
    
    try {
      const prettierPath = this.findExecutable('prettier')
      if (!prettierPath) {
        log.warning('Prettier not found, installing...')
        await this.installDependency('prettier')
      }
      
      // Create Prettier config if it doesn't exist
      await this.ensurePrettierConfig()
      
      // Check formatting
      const result = await this.executeCommand('npx prettier --check . --ignore-path .gitignore', { ignoreErrors: true })
      
      const unformattedFiles = result.stderr ? result.stderr.split('\n').filter(line => line.trim() && !line.includes('Code style issues')).length : 0
      
      return {
        totalFiles: 0, // Prettier doesn't provide this easily
        unformattedFiles,
        isFormatted: unformattedFiles === 0
      }
    } catch (error) {
      log.error(`Prettier analysis failed: ${error.message}`)
      return { error: error.message }
    }
  }

  async runTypeScript() {
    log.step('Running TypeScript compiler...')
    
    try {
      const tscPath = this.findExecutable('tsc')
      if (!tscPath) {
        log.warning('TypeScript not found, installing...')
        await this.installDependency('typescript @types/node @types/react @types/react-dom')
      }
      
      // Run TypeScript compiler
      const result = await this.executeCommand('npx tsc --noEmit --skipLibCheck', { ignoreErrors: true })
      
      const errors = result.stderr ? result.stderr.split('\n').filter(line => line.includes('error TS')).length : 0
      
      return {
        hasErrors: errors > 0,
        errorCount: errors,
        output: result.stderr
      }
    } catch (error) {
      log.error(`TypeScript analysis failed: ${error.message}`)
      return { error: error.message }
    }
  }

  async runStylelint() {
    log.step('Running Stylelint...')
    
    try {
      const stylelintPath = this.findExecutable('stylelint')
      if (!stylelintPath) {
        log.info('Stylelint not found, skipping CSS analysis')
        return { skipped: true }
      }
      
      // Run Stylelint
      const result = await this.executeCommand('npx stylelint "**/*.{css,scss,sass}" --formatter json', { ignoreErrors: true })
      
      if (result.stdout) {
        const stylelintResults = JSON.parse(result.stdout)
        
        const summary = {
          totalFiles: stylelintResults.length,
          totalErrors: stylelintResults.reduce((sum, file) => sum + file.errored, 0),
          totalWarnings: stylelintResults.reduce((sum, file) => sum + file.warnings.length, 0)
        }
        
        return summary
      }
      
      return { totalFiles: 0, totalErrors: 0, totalWarnings: 0 }
    } catch (error) {
      return { skipped: true, reason: 'No CSS files or Stylelint not configured' }
    }
  }

  async runSecurityScan() {
    log.title('🔒 Security Vulnerability Scan')
    
    const securityResults = {
      npm: await this.runNpmAudit(),
      snyk: await this.runSnykScan(),
      eslintSecurity: await this.runESLintSecurity(),
      secrets: await this.scanForSecrets()
    }
    
    this.analysisResults.security = securityResults
    
    // Display results
    this.displaySecurityResults(securityResults)
    
    log.success('Security scan completed')
  }

  async runNpmAudit() {
    log.step('Running npm audit...')
    
    try {
      const result = await this.executeCommand('npm audit --json', { ignoreErrors: true })
      
      if (result.stdout) {
        const auditResults = JSON.parse(result.stdout)
        
        return {
          vulnerabilities: auditResults.metadata?.vulnerabilities || {},
          totalVulnerabilities: Object.values(auditResults.metadata?.vulnerabilities || {}).reduce((sum, count) => sum + count, 0)
        }
      }
      
      return { vulnerabilities: {}, totalVulnerabilities: 0 }
    } catch (error) {
      log.error(`npm audit failed: ${error.message}`)
      return { error: error.message }
    }
  }

  async runSnykScan() {
    log.step('Running Snyk scan...')
    
    try {
      const snykPath = this.findExecutable('snyk')
      if (!snykPath) {
        log.info('Snyk not found, skipping advanced security scan')
        return { skipped: true }
      }
      
      const result = await this.executeCommand('snyk test --json', { ignoreErrors: true })
      
      if (result.stdout) {
        const snykResults = JSON.parse(result.stdout)
        
        return {
          vulnerabilities: snykResults.vulnerabilities || [],
          totalVulnerabilities: snykResults.vulnerabilities?.length || 0
        }
      }
      
      return { vulnerabilities: [], totalVulnerabilities: 0 }
    } catch (error) {
      return { skipped: true, reason: 'Snyk not configured or authenticated' }
    }
  }

  async runESLintSecurity() {
    log.step('Running ESLint security rules...')
    
    try {
      // Install security plugin if not present
      const securityPlugin = this.findExecutable('eslint-plugin-security')
      if (!securityPlugin) {
        log.info('Installing ESLint security plugin...')
        await this.installDependency('eslint-plugin-security')
      }
      
      // Run ESLint with security rules
      const result = await this.executeCommand('npx eslint . --ext .js,.jsx,.ts,.tsx --config .eslintrc-security.json --format json', { ignoreErrors: true })
      
      // Create temporary security config
      const securityConfig = {
        extends: ['plugin:security/recommended'],
        plugins: ['security'],
        rules: {
          'security/detect-object-injection': 'error',
          'security/detect-non-literal-regexp': 'error',
          'security/detect-unsafe-regex': 'error'
        }
      }
      
      const configPath = path.join(this.projectRoot, '.eslintrc-security.json')
      fs.writeFileSync(configPath, JSON.stringify(securityConfig, null, 2))
      
      if (result.stdout) {
        const eslintResults = JSON.parse(result.stdout)
        const securityIssues = eslintResults.reduce((sum, file) => sum + file.errorCount + file.warningCount, 0)
        
        // Clean up temporary config
        fs.unlinkSync(configPath)
        
        return {
          securityIssues,
          files: eslintResults.filter(file => file.errorCount > 0 || file.warningCount > 0)
        }
      }
      
      return { securityIssues: 0, files: [] }
    } catch (error) {
      return { error: error.message }
    }
  }

  async scanForSecrets() {
    log.step('Scanning for exposed secrets...')
    
    const secretPatterns = [
      { name: 'API Keys', pattern: /api[_-]?key[\s]*[:=][\s]*['"]?([a-zA-Z0-9]{20,})['"]?/gi },
      { name: 'AWS Keys', pattern: /AKIA[0-9A-Z]{16}/gi },
      { name: 'Private Keys', pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----/gi },
      { name: 'Database URLs', pattern: /(?:postgres|mysql|mongodb):\/\/[^\s]+/gi },
      { name: 'JWT Secrets', pattern: /jwt[_-]?secret[\s]*[:=][\s]*['"]?([a-zA-Z0-9]{20,})['"]?/gi }
    ]
    
    const foundSecrets = []
    
    try {
      const files = await this.getSourceFiles()
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern.pattern)
          if (matches) {
            foundSecrets.push({
              file: path.relative(this.projectRoot, file),
              type: pattern.name,
              matches: matches.length
            })
          }
        }
      }
      
      return {
        totalSecrets: foundSecrets.length,
        secrets: foundSecrets
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async runComplexityAnalysis() {
    log.title('🧮 Code Complexity Analysis')
    
    const complexityResults = {
      cyclomaticComplexity: await this.analyzeCyclomaticComplexity(),
      maintainabilityIndex: await this.analyzeMaintainabilityIndex(),
      codeMetrics: await this.analyzeCodeMetrics()
    }
    
    this.analysisResults.complexity = complexityResults
    
    // Display results
    this.displayComplexityResults(complexityResults)
    
    log.success('Complexity analysis completed')
  }

  async analyzeCyclomaticComplexity() {
    log.step('Analyzing cyclomatic complexity...')
    
    try {
      // Install complexity analyzer if not present
      const complexityTool = this.findExecutable('complexity-report')
      if (!complexityTool) {
        log.info('Installing complexity analysis tool...')
        await this.installDependency('complexity-report')
      }
      
      const files = await this.getSourceFiles()
      const complexityData = []
      
      for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
        try {
          const result = await this.executeCommand(`npx complexity-report --format json ${file}`, { ignoreErrors: true })
          
          if (result.stdout) {
            const data = JSON.parse(result.stdout)
            complexityData.push({
              file: path.relative(this.projectRoot, file),
              complexity: data.complexity || 0,
              functions: data.functions || []
            })
          }
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }
      
      const averageComplexity = complexityData.reduce((sum, file) => sum + file.complexity, 0) / complexityData.length
      const highComplexityFiles = complexityData.filter(file => file.complexity > this.qualityConfig.thresholds.complexity)
      
      return {
        averageComplexity: Math.round(averageComplexity * 100) / 100,
        highComplexityFiles,
        totalFiles: complexityData.length
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeMaintainabilityIndex() {
    log.step('Analyzing maintainability index...')
    
    try {
      const files = await this.getSourceFiles()
      const maintainabilityScores = []
      
      for (const file of files.slice(0, 20)) { // Sample for performance
        const content = fs.readFileSync(file, 'utf8')
        const score = this.calculateMaintainabilityIndex(content)
        
        maintainabilityScores.push({
          file: path.relative(this.projectRoot, file),
          score
        })
      }
      
      const averageScore = maintainabilityScores.reduce((sum, file) => sum + file.score, 0) / maintainabilityScores.length
      const lowMaintainabilityFiles = maintainabilityScores.filter(file => file.score < this.qualityConfig.thresholds.maintainability)
      
      return {
        averageScore: Math.round(averageScore * 100) / 100,
        lowMaintainabilityFiles,
        totalFiles: maintainabilityScores.length
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  calculateMaintainabilityIndex(code) {
    // Simplified maintainability index calculation
    const lines = code.split('\n').length
    const complexity = (code.match(/if|for|while|switch|catch/g) || []).length
    const comments = (code.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length
    
    // Simplified formula (real MI is more complex)
    const commentRatio = comments / lines
    const complexityRatio = complexity / lines
    
    return Math.max(0, Math.min(100, 100 - (complexityRatio * 50) + (commentRatio * 20)))
  }

  async analyzeCodeMetrics() {
    log.step('Analyzing code metrics...')
    
    try {
      const files = await this.getSourceFiles()
      let totalLines = 0
      let totalFunctions = 0
      let totalClasses = 0
      let totalComments = 0
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        const lines = content.split('\n')
        
        totalLines += lines.length
        totalFunctions += (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length
        totalClasses += (content.match(/class\s+\w+/g) || []).length
        totalComments += (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length
      }
      
      return {
        totalFiles: files.length,
        totalLines,
        totalFunctions,
        totalClasses,
        totalComments,
        averageLinesPerFile: Math.round(totalLines / files.length),
        commentRatio: Math.round((totalComments / totalLines) * 100 * 100) / 100
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async runCoverageAnalysis() {
    log.title('📊 Test Coverage Analysis')
    
    try {
      // Check if Jest is configured
      const jestConfig = this.findJestConfig()
      if (!jestConfig) {
        log.warning('Jest not configured, setting up basic configuration...')
        await this.setupJestConfig()
      }
      
      // Run tests with coverage
      log.step('Running tests with coverage...')
      const result = await this.executeCommand('npm test -- --coverage --watchAll=false --passWithNoTests', { ignoreErrors: true })
      
      // Parse coverage results
      const coverageResults = await this.parseCoverageResults()
      
      this.analysisResults.coverage = coverageResults
      
      // Display results
      this.displayCoverageResults(coverageResults)
      
      log.success('Coverage analysis completed')
    } catch (error) {
      log.error(`Coverage analysis failed: ${error.message}`)
      this.analysisResults.coverage = { error: error.message }
    }
  }

  async parseCoverageResults() {
    const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json')
    
    if (fs.existsSync(coveragePath)) {
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
      
      return {
        total: coverageData.total,
        files: Object.entries(coverageData)
          .filter(([key]) => key !== 'total')
          .map(([file, data]) => ({
            file: path.relative(this.projectRoot, file),
            ...data
          }))
      }
    }
    
    return { error: 'Coverage data not found' }
  }

  async runDependencyAnalysis() {
    log.title('📦 Dependency Analysis')
    
    const dependencyResults = {
      outdated: await this.analyzeOutdatedDependencies(),
      unused: await this.analyzeUnusedDependencies(),
      duplicates: await this.analyzeDuplicateDependencies(),
      licenses: await this.analyzeLicenses()
    }
    
    this.analysisResults.dependencies = dependencyResults
    
    // Display results
    this.displayDependencyResults(dependencyResults)
    
    log.success('Dependency analysis completed')
  }

  async analyzeOutdatedDependencies() {
    log.step('Checking for outdated dependencies...')
    
    try {
      const result = await this.executeCommand('npm outdated --json', { ignoreErrors: true })
      
      if (result.stdout) {
        const outdatedData = JSON.parse(result.stdout)
        
        return {
          count: Object.keys(outdatedData).length,
          packages: Object.entries(outdatedData).map(([name, info]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            type: info.type
          }))
        }
      }
      
      return { count: 0, packages: [] }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeUnusedDependencies() {
    log.step('Checking for unused dependencies...')
    
    try {
      const depcheckPath = this.findExecutable('depcheck')
      if (!depcheckPath) {
        log.info('Installing depcheck...')
        await this.installDependency('depcheck')
      }
      
      const result = await this.executeCommand('npx depcheck --json', { ignoreErrors: true })
      
      if (result.stdout) {
        const depcheckData = JSON.parse(result.stdout)
        
        return {
          unused: depcheckData.dependencies || [],
          missing: Object.keys(depcheckData.missing || {}),
          devUnused: depcheckData.devDependencies || []
        }
      }
      
      return { unused: [], missing: [], devUnused: [] }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeDuplicateDependencies() {
    log.step('Checking for duplicate dependencies...')
    
    try {
      const result = await this.executeCommand('npm ls --json --depth=0', { ignoreErrors: true })
      
      if (result.stdout) {
        const lsData = JSON.parse(result.stdout)
        const dependencies = lsData.dependencies || {}
        
        // Simple duplicate detection (same package, different versions)
        const packageNames = Object.keys(dependencies)
        const duplicates = []
        
        // This is a simplified check - real duplicate detection is more complex
        for (const pkg of packageNames) {
          const similar = packageNames.filter(p => p.includes(pkg.split('-')[0]) && p !== pkg)
          if (similar.length > 0) {
            duplicates.push({ package: pkg, similar })
          }
        }
        
        return {
          count: duplicates.length,
          duplicates
        }
      }
      
      return { count: 0, duplicates: [] }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeLicenses() {
    log.step('Analyzing package licenses...')
    
    try {
      const licenseCheckerPath = this.findExecutable('license-checker')
      if (!licenseCheckerPath) {
        log.info('Installing license-checker...')
        await this.installDependency('license-checker')
      }
      
      const result = await this.executeCommand('npx license-checker --json', { ignoreErrors: true })
      
      if (result.stdout) {
        const licenseData = JSON.parse(result.stdout)
        const licenses = {}
        
        Object.values(licenseData).forEach(pkg => {
          const license = pkg.licenses || 'Unknown'
          licenses[license] = (licenses[license] || 0) + 1
        })
        
        return {
          totalPackages: Object.keys(licenseData).length,
          licenses,
          potentialIssues: Object.keys(licenses).filter(license => 
            license.includes('GPL') || license.includes('AGPL')
          )
        }
      }
      
      return { totalPackages: 0, licenses: {}, potentialIssues: [] }
    } catch (error) {
      return { error: error.message }
    }
  }

  async runDuplicationDetection() {
    log.title('🔍 Code Duplication Detection')
    
    try {
      const jscpdPath = this.findExecutable('jscpd')
      if (!jscpdPath) {
        log.info('Installing jscpd...')
        await this.installDependency('jscpd')
      }
      
      log.step('Scanning for code duplication...')
      const result = await this.executeCommand('npx jscpd --format json --output ./quality-reports/duplication.json .', { ignoreErrors: true })
      
      const duplicationResults = await this.parseDuplicationResults()
      
      this.analysisResults.duplication = duplicationResults
      
      // Display results
      this.displayDuplicationResults(duplicationResults)
      
      log.success('Duplication detection completed')
    } catch (error) {
      log.error(`Duplication detection failed: ${error.message}`)
      this.analysisResults.duplication = { error: error.message }
    }
  }

  async parseDuplicationResults() {
    const duplicationPath = path.join(this.reportsDir, 'duplication.json')
    
    if (fs.existsSync(duplicationPath)) {
      const duplicationData = JSON.parse(fs.readFileSync(duplicationPath, 'utf8'))
      
      return {
        duplicates: duplicationData.duplicates || [],
        statistics: duplicationData.statistics || {},
        percentage: duplicationData.statistics?.percentage || 0
      }
    }
    
    return { duplicates: [], statistics: {}, percentage: 0 }
  }

  async runDocumentationAnalysis() {
    log.title('📚 Documentation Coverage Analysis')
    
    const documentationResults = {
      jsdoc: await this.analyzeJSDocCoverage(),
      readme: await this.analyzeReadmeQuality(),
      comments: await this.analyzeCommentCoverage(),
      apiDocs: await this.analyzeAPIDocumentation()
    }
    
    this.analysisResults.documentation = documentationResults
    
    // Display results
    this.displayDocumentationResults(documentationResults)
    
    log.success('Documentation analysis completed')
  }

  async analyzeJSDocCoverage() {
    log.step('Analyzing JSDoc coverage...')
    
    try {
      const files = await this.getSourceFiles()
      let totalFunctions = 0
      let documentedFunctions = 0
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        
        // Find functions
        const functionMatches = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*:\s*\()/g) || []
        totalFunctions += functionMatches.length
        
        // Find JSDoc comments
        const jsdocMatches = content.match(/\/\*\*[\s\S]*?\*\//g) || []
        documentedFunctions += jsdocMatches.length
      }
      
      const coverage = totalFunctions > 0 ? (documentedFunctions / totalFunctions) * 100 : 0
      
      return {
        totalFunctions,
        documentedFunctions,
        coverage: Math.round(coverage * 100) / 100
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeReadmeQuality() {
    log.step('Analyzing README quality...')
    
    const readmePath = path.join(this.projectRoot, 'README.md')
    
    if (!fs.existsSync(readmePath)) {
      return { exists: false, score: 0 }
    }
    
    const content = fs.readFileSync(readmePath, 'utf8')
    let score = 0
    const checks = []
    
    // Check for essential sections
    const essentialSections = [
      { name: 'Title', pattern: /^#\s+.+/m, weight: 10 },
      { name: 'Description', pattern: /.{50,}/m, weight: 15 },
      { name: 'Installation', pattern: /install/i, weight: 15 },
      { name: 'Usage', pattern: /usage|example/i, weight: 15 },
      { name: 'API Documentation', pattern: /api|endpoint/i, weight: 10 },
      { name: 'Contributing', pattern: /contribut/i, weight: 10 },
      { name: 'License', pattern: /license/i, weight: 10 },
      { name: 'Code Examples', pattern: /```/g, weight: 15 }
    ]
    
    for (const section of essentialSections) {
      const found = section.pattern.test(content)
      checks.push({ name: section.name, found, weight: section.weight })
      if (found) score += section.weight
    }
    
    return {
      exists: true,
      score,
      maxScore: 100,
      checks,
      wordCount: content.split(/\s+/).length
    }
  }

  async analyzeCommentCoverage() {
    log.step('Analyzing comment coverage...')
    
    try {
      const files = await this.getSourceFiles()
      let totalLines = 0
      let commentLines = 0
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        const lines = content.split('\n')
        
        totalLines += lines.length
        
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            commentLines++
          }
        }
      }
      
      const coverage = totalLines > 0 ? (commentLines / totalLines) * 100 : 0
      
      return {
        totalLines,
        commentLines,
        coverage: Math.round(coverage * 100) / 100
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async analyzeAPIDocumentation() {
    log.step('Analyzing API documentation...')
    
    try {
      // Look for API route files
      const apiFiles = await this.getAPIFiles()
      let totalEndpoints = 0
      let documentedEndpoints = 0
      
      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf8')
        
        // Count HTTP method handlers
        const methodMatches = content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g) || []
        totalEndpoints += methodMatches.length
        
        // Count documented endpoints (with JSDoc or comments)
        const docMatches = content.match(/\/\*\*[\s\S]*?\*\/\s*export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g) || []
        documentedEndpoints += docMatches.length
      }
      
      const coverage = totalEndpoints > 0 ? (documentedEndpoints / totalEndpoints) * 100 : 0
      
      return {
        totalEndpoints,
        documentedEndpoints,
        coverage: Math.round(coverage * 100) / 100,
        apiFiles: apiFiles.length
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async runPerformanceAnalysis() {
    log.title('⚡ Performance Analysis')
    
    const performanceResults = {
      bundleSize: await this.analyzeBundleSize(),
      lighthouse: await this.runLighthouseAudit(),
      webVitals: await this.analyzeWebVitals()
    }
    
    this.analysisResults.performance = performanceResults
    
    // Display results
    this.displayPerformanceResults(performanceResults)
    
    log.success('Performance analysis completed')
  }

  async analyzeBundleSize() {
    log.step('Analyzing bundle size...')
    
    try {
      // Check if Next.js build exists
      const buildDir = path.join(this.projectRoot, '.next')
      if (!fs.existsSync(buildDir)) {
        log.info('Building application for bundle analysis...')
        await this.executeCommand('npm run build')
      }
      
      // Analyze bundle with webpack-bundle-analyzer
      const analyzerPath = this.findExecutable('webpack-bundle-analyzer')
      if (!analyzerPath) {
        log.info('Installing webpack-bundle-analyzer...')
        await this.installDependency('webpack-bundle-analyzer')
      }
      
      // Generate bundle analysis
      await this.executeCommand('npx webpack-bundle-analyzer .next/static/chunks/*.js --mode static --report ./quality-reports/bundle-report.html --no-open', { ignoreErrors: true })
      
      // Get basic bundle info
      const staticDir = path.join(this.projectRoot, '.next', 'static')
      if (fs.existsSync(staticDir)) {
        const bundleInfo = await this.getBundleInfo(staticDir)
        return bundleInfo
      }
      
      return { error: 'Bundle analysis failed' }
    } catch (error) {
      return { error: error.message }
    }
  }

  async getBundleInfo(staticDir) {
    const chunks = []
    let totalSize = 0
    
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir)
      
      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          scanDirectory(itemPath)
        } else if (item.endsWith('.js')) {
          const size = stats.size
          totalSize += size
          chunks.push({
            name: item,
            size,
            sizeKB: Math.round(size / 1024 * 100) / 100
          })
        }
      }
    }
    
    scanDirectory(staticDir)
    
    return {
      totalSize,
      totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      chunkCount: chunks.length,
      largestChunks: chunks.sort((a, b) => b.size - a.size).slice(0, 5)
    }
  }

  async runLighthouseAudit() {
    log.step('Running Lighthouse audit...')
    
    try {
      const lighthousePath = this.findExecutable('lighthouse')
      if (!lighthousePath) {
        log.info('Lighthouse not found, skipping audit')
        return { skipped: true }
      }
      
      // Start development server if not running
      const serverUrl = 'http://localhost:3000'
      
      // Run Lighthouse
      const result = await this.executeCommand(`npx lighthouse ${serverUrl} --output json --output-path ./quality-reports/lighthouse.json --chrome-flags="--headless"`, { ignoreErrors: true })
      
      // Parse Lighthouse results
      const lighthouseResults = await this.parseLighthouseResults()
      
      return lighthouseResults
    } catch (error) {
      return { error: error.message }
    }
  }

  async parseLighthouseResults() {
    const lighthousePath = path.join(this.reportsDir, 'lighthouse.json')
    
    if (fs.existsSync(lighthousePath)) {
      const lighthouseData = JSON.parse(fs.readFileSync(lighthousePath, 'utf8'))
      
      return {
        performance: Math.round(lighthouseData.categories.performance.score * 100),
        accessibility: Math.round(lighthouseData.categories.accessibility.score * 100),
        bestPractices: Math.round(lighthouseData.categories['best-practices'].score * 100),
        seo: Math.round(lighthouseData.categories.seo.score * 100),
        pwa: lighthouseData.categories.pwa ? Math.round(lighthouseData.categories.pwa.score * 100) : null
      }
    }
    
    return { error: 'Lighthouse results not found' }
  }

  async analyzeWebVitals() {
    log.step('Analyzing Web Vitals...')
    
    // This would require actual web vitals data
    // For now, return placeholder
    return {
      note: 'Web Vitals analysis requires real user monitoring data',
      recommendation: 'Implement Web Vitals tracking in your application'
    }
  }

  async runAutoFix() {
    log.title('🔧 Auto-fixing Code Issues')
    
    const fixResults = {
      eslint: await this.autoFixESLint(),
      prettier: await this.autoFixPrettier(),
      imports: await this.autoFixImports()
    }
    
    // Display results
    this.displayAutoFixResults(fixResults)
    
    log.success('Auto-fix completed')
  }

  async autoFixESLint() {
    log.step('Auto-fixing ESLint issues...')
    
    try {
      const result = await this.executeCommand('npx eslint . --ext .js,.jsx,.ts,.tsx --fix', { ignoreErrors: true })
      
      return {
        success: true,
        output: result.stdout || result.stderr
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async autoFixPrettier() {
    log.step('Auto-fixing Prettier formatting...')
    
    try {
      const result = await this.executeCommand('npx prettier --write . --ignore-path .gitignore', { ignoreErrors: true })
      
      return {
        success: true,
        output: result.stdout || result.stderr
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async autoFixImports() {
    log.step('Auto-fixing import organization...')
    
    try {
      // Install import sorter if not present
      const importSortPath = this.findExecutable('import-sort')
      if (!importSortPath) {
        log.info('Installing import-sort...')
        await this.installDependency('import-sort-cli import-sort-parser-typescript import-sort-style-module')
      }
      
      const result = await this.executeCommand('npx import-sort --write "src/**/*.{js,jsx,ts,tsx}"', { ignoreErrors: true })
      
      return {
        success: true,
        output: result.stdout || result.stderr
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async setupPreCommitHooks() {
    log.title('🪝 Setting up Pre-commit Hooks')
    
    try {
      // Install husky and lint-staged
      log.step('Installing husky and lint-staged...')
      await this.installDependency('husky lint-staged --save-dev')
      
      // Initialize husky
      await this.executeCommand('npx husky install')
      
      // Create pre-commit hook
      await this.executeCommand('npx husky add .husky/pre-commit "npx lint-staged"')
      
      // Create lint-staged configuration
      const lintStagedConfig = {
        '*.{js,jsx,ts,tsx}': [
          'eslint --fix',
          'prettier --write'
        ],
        '*.{css,scss,sass}': [
          'stylelint --fix',
          'prettier --write'
        ],
        '*.{json,md}': [
          'prettier --write'
        ]
      }
      
      // Add to package.json
      const packageJsonPath = path.join(this.projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      packageJson['lint-staged'] = lintStagedConfig
      
      // Add prepare script
      if (!packageJson.scripts) packageJson.scripts = {}
      packageJson.scripts.prepare = 'husky install'
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      
      log.success('Pre-commit hooks setup completed')
      log.info('Hooks will run ESLint, Prettier, and Stylelint on staged files')
    } catch (error) {
      log.error(`Pre-commit hooks setup failed: ${error.message}`)
    }
  }

  async generateQualityReport() {
    log.title('📊 Generating Quality Report')
    
    const report = {
      timestamp: new Date().toISOString(),
      project: {
        name: this.getProjectName(),
        version: this.getProjectVersion()
      },
      summary: this.generateQualitySummary(),
      results: this.analysisResults,
      recommendations: this.generateRecommendations(),
      configuration: this.qualityConfig
    }
    
    // Generate JSON report
    const jsonReportPath = path.join(this.reportsDir, 'quality-report.json')
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))
    
    // Generate HTML report
    const htmlReport = this.generateHTMLQualityReport(report)
    const htmlReportPath = path.join(this.reportsDir, 'quality-report.html')
    fs.writeFileSync(htmlReportPath, htmlReport)
    
    // Generate markdown summary
    const markdownReport = this.generateMarkdownQualityReport(report)
    const markdownReportPath = path.join(this.reportsDir, 'quality-summary.md')
    fs.writeFileSync(markdownReportPath, markdownReport)
    
    log.success('Quality reports generated')
    log.info(`JSON Report: ${jsonReportPath}`)
    log.info(`HTML Report: ${htmlReportPath}`)
    log.info(`Markdown Summary: ${markdownReportPath}`)
    
    return report
  }

  generateQualitySummary() {
    const summary = {
      overallScore: 0,
      grades: {},
      metrics: {}
    }
    
    // Calculate grades for each category
    const categories = ['linting', 'security', 'complexity', 'coverage', 'documentation']
    
    for (const category of categories) {
      const result = this.analysisResults[category]
      if (result && !result.error) {
        summary.grades[category] = this.calculateCategoryGrade(category, result)
      }
    }
    
    // Calculate overall score
    const grades = Object.values(summary.grades).filter(grade => typeof grade === 'number')
    summary.overallScore = grades.length > 0 ? Math.round(grades.reduce((sum, grade) => sum + grade, 0) / grades.length) : 0
    
    return summary
  }

  calculateCategoryGrade(category, result) {
    switch (category) {
      case 'linting':
        if (result.eslint && !result.eslint.error) {
          const errorRate = result.eslint.totalErrors / (result.eslint.totalFiles || 1)
          return Math.max(0, 100 - (errorRate * 20))
        }
        break
      case 'security':
        if (result.npm && !result.npm.error) {
          const vulnCount = result.npm.totalVulnerabilities || 0
          return Math.max(0, 100 - (vulnCount * 10))
        }
        break
      case 'complexity':
        if (result.cyclomaticComplexity && !result.cyclomaticComplexity.error) {
          const avgComplexity = result.cyclomaticComplexity.averageComplexity || 0
          return Math.max(0, 100 - (avgComplexity * 5))
        }
        break
      case 'coverage':
        if (result.total && result.total.lines) {
          return result.total.lines.pct || 0
        }
        break
      case 'documentation':
        if (result.jsdoc && !result.jsdoc.error) {
          return result.jsdoc.coverage || 0
        }
        break
    }
    
    return 0
  }

  generateRecommendations() {
    const recommendations = []
    
    // Analyze results and generate recommendations
    if (this.analysisResults.linting?.eslint?.totalErrors > 0) {
      recommendations.push({
        category: 'Code Quality',
        priority: 'High',
        description: `Fix ${this.analysisResults.linting.eslint.totalErrors} ESLint errors`,
        action: 'Run: npx eslint . --fix'
      })
    }
    
    if (this.analysisResults.security?.npm?.totalVulnerabilities > 0) {
      recommendations.push({
        category: 'Security',
        priority: 'Critical',
        description: `Address ${this.analysisResults.security.npm.totalVulnerabilities} security vulnerabilities`,
        action: 'Run: npm audit fix'
      })
    }
    
    if (this.analysisResults.coverage?.total?.lines?.pct < this.qualityConfig.thresholds.coverage) {
      recommendations.push({
        category: 'Testing',
        priority: 'Medium',
        description: `Increase test coverage from ${this.analysisResults.coverage.total.lines.pct}% to ${this.qualityConfig.thresholds.coverage}%`,
        action: 'Write more unit and integration tests'
      })
    }
    
    return recommendations
  }

  generateHTMLQualityReport(report) {
    const overallGrade = this.getGradeLetter(report.summary.overallScore)
    const gradeColor = this.getGradeColor(report.summary.overallScore)
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>KNI Platform Code Quality Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .grade { font-size: 48px; font-weight: bold; margin: 10px 0; }
        .grade.A { color: #4CAF50; }
        .grade.B { color: #8BC34A; }
        .grade.C { color: #FFC107; }
        .grade.D { color: #FF9800; }
        .grade.F { color: #F44336; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
        .metric-title { font-weight: bold; color: #333; margin-bottom: 10px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .recommendation { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .priority-critical { border-left: 4px solid #dc3545; }
        .priority-high { border-left: 4px solid #fd7e14; }
        .priority-medium { border-left: 4px solid #ffc107; }
        .priority-low { border-left: 4px solid #28a745; }
        .details { margin: 20px 0; }
        .category { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .category h3 { color: #333; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f1f3f4; font-weight: bold; }
        .status-pass { color: #28a745; font-weight: bold; }
        .status-fail { color: #dc3545; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>KNI Platform Code Quality Report</h1>
            <div class="grade ${gradeColor}">${overallGrade}</div>
            <p>Overall Quality Score: ${report.summary.overallScore}/100</p>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="metrics">
            ${Object.entries(report.summary.grades).map(([category, grade]) => `
                <div class="metric-card">
                    <div class="metric-title">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
                    <div class="metric-value">${grade}/100</div>
                </div>
            `).join('')}
        </div>
        
        ${report.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>🎯 Recommendations</h2>
            ${report.recommendations.map(rec => `
                <div class="recommendation priority-${rec.priority.toLowerCase()}">
                    <strong>${rec.category}</strong> (${rec.priority} Priority)<br>
                    ${rec.description}<br>
                    <code>${rec.action}</code>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="details">
            <h2>📊 Detailed Results</h2>
            
            ${Object.entries(report.results).map(([category, result]) => {
                if (!result || result.error) return ''
                return `
                <div class="category">
                    <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Analysis</h3>
                    <pre>${JSON.stringify(result, null, 2)}</pre>
                </div>
                `
            }).join('')}
        </div>
    </div>
</body>
</html>
    `
  }

  generateMarkdownQualityReport(report) {
    const overallGrade = this.getGradeLetter(report.summary.overallScore)
    
    return `# KNI Platform Code Quality Report

**Overall Grade:** ${overallGrade} (${report.summary.overallScore}/100)  
**Generated:** ${new Date(report.timestamp).toLocaleString()}

## 📊 Quality Metrics

${Object.entries(report.summary.grades).map(([category, grade]) => 
  `- **${category.charAt(0).toUpperCase() + category.slice(1)}:** ${grade}/100`
).join('\n')}

## 🎯 Recommendations

${report.recommendations.map(rec => 
  `### ${rec.category} (${rec.priority} Priority)\n${rec.description}\n\`\`\`bash\n${rec.action}\n\`\`\`\n`
).join('\n')}

## 📋 Detailed Results

${Object.entries(report.results).map(([category, result]) => {
  if (!result || result.error) return ''
  return `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`
}).join('\n')}

---
*Report generated by KNI Platform Code Quality Analyzer*
`
  }

  getGradeLetter(score) {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  getGradeColor(score) {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  displayQualitySummary() {
    const summary = this.generateQualitySummary()
    
    log.title('📊 Quality Summary')
    log.metric('Overall Score', summary.overallScore, '/100')
    
    Object.entries(summary.grades).forEach(([category, grade]) => {
      log.metric(category.charAt(0).toUpperCase() + category.slice(1), grade, '/100')
    })
  }

  displayLintingResults(results) {
    log.title('📝 Linting Results')
    
    if (results.eslint && !results.eslint.error) {
      log.metric('ESLint Errors', results.eslint.totalErrors)
      log.metric('ESLint Warnings', results.eslint.totalWarnings)
      log.metric('Fixable Issues', results.eslint.fixableErrors + results.eslint.fixableWarnings)
    }
    
    if (results.prettier && !results.prettier.error) {
      const status = results.prettier.isFormatted ? 'All files formatted' : `${results.prettier.unformattedFiles} files need formatting`
      log.info(`Prettier: ${status}`)
    }
    
    if (results.typescript && !results.typescript.error) {
      const status = results.typescript.hasErrors ? `${results.typescript.errorCount} TypeScript errors` : 'No TypeScript errors'
      log.info(`TypeScript: ${status}`)
    }
  }

  displaySecurityResults(results) {
    log.title('🔒 Security Results')
    
    if (results.npm && !results.npm.error) {
      log.metric('Total Vulnerabilities', results.npm.totalVulnerabilities)
      
      if (results.npm.vulnerabilities) {
        Object.entries(results.npm.vulnerabilities).forEach(([severity, count]) => {
          if (count > 0) {
            log.metric(`${severity.charAt(0).toUpperCase() + severity.slice(1)} Vulnerabilities`, count)
          }
        })
      }
    }
    
    if (results.secrets && !results.secrets.error) {
      log.metric('Potential Secrets Found', results.secrets.totalSecrets)
      
      if (results.secrets.totalSecrets > 0) {
        log.warning('Review and remove any exposed secrets!')
      }
    }
  }

  displayComplexityResults(results) {
    log.title('🧮 Complexity Results')
    
    if (results.cyclomaticComplexity && !results.cyclomaticComplexity.error) {
      log.metric('Average Complexity', results.cyclomaticComplexity.averageComplexity)
      log.metric('High Complexity Files', results.cyclomaticComplexity.highComplexityFiles.length)
    }
    
    if (results.maintainabilityIndex && !results.maintainabilityIndex.error) {
      log.metric('Average Maintainability', results.maintainabilityIndex.averageScore, '/100')
      log.metric('Low Maintainability Files', results.maintainabilityIndex.lowMaintainabilityFiles.length)
    }
    
    if (results.codeMetrics && !results.codeMetrics.error) {
      log.metric('Total Lines of Code', results.codeMetrics.totalLines)
      log.metric('Total Functions', results.codeMetrics.totalFunctions)
      log.metric('Comment Ratio', results.codeMetrics.commentRatio, '%')
    }
  }

  displayCoverageResults(results) {
    log.title('📊 Coverage Results')
    
    if (results.total) {
      log.metric('Line Coverage', results.total.lines.pct, '%')
      log.metric('Function Coverage', results.total.functions.pct, '%')
      log.metric('Branch Coverage', results.total.branches.pct, '%')
      log.metric('Statement Coverage', results.total.statements.pct, '%')
    } else if (results.error) {
      log.error(`Coverage analysis failed: ${results.error}`)
    }
  }

  displayDependencyResults(results) {
    log.title('📦 Dependency Results')
    
    if (results.outdated && !results.outdated.error) {
      log.metric('Outdated Packages', results.outdated.count)
    }
    
    if (results.unused && !results.unused.error) {
      log.metric('Unused Dependencies', results.unused.unused.length)
      log.metric('Missing Dependencies', results.unused.missing.length)
    }
    
    if (results.licenses && !results.licenses.error) {
      log.metric('Total Packages', results.licenses.totalPackages)
      log.metric('License Issues', results.licenses.potentialIssues.length)
    }
  }

  displayDuplicationResults(results) {
    log.title('🔍 Duplication Results')
    
    if (results.percentage !== undefined) {
      log.metric('Code Duplication', results.percentage, '%')
      log.metric('Duplicate Blocks', results.duplicates.length)
    } else if (results.error) {
      log.error(`Duplication detection failed: ${results.error}`)
    }
  }

  displayDocumentationResults(results) {
    log.title('📚 Documentation Results')
    
    if (results.jsdoc && !results.jsdoc.error) {
      log.metric('JSDoc Coverage', results.jsdoc.coverage, '%')
      log.metric('Documented Functions', `${results.jsdoc.documentedFunctions}/${results.jsdoc.totalFunctions}`)
    }
    
    if (results.readme) {
      if (results.readme.exists) {
        log.metric('README Quality Score', results.readme.score, '/100')
      } else {
        log.warning('README.md not found')
      }
    }
    
    if (results.comments && !results.comments.error) {
      log.metric('Comment Coverage', results.comments.coverage, '%')
    }
    
    if (results.apiDocs && !results.apiDocs.error) {
      log.metric('API Documentation Coverage', results.apiDocs.coverage, '%')
      log.metric('Documented Endpoints', `${results.apiDocs.documentedEndpoints}/${results.apiDocs.totalEndpoints}`)
    }
  }

  displayPerformanceResults(results) {
    log.title('⚡ Performance Results')
    
    if (results.bundleSize && !results.bundleSize.error) {
      log.metric('Total Bundle Size', results.bundleSize.totalSizeMB, 'MB')
      log.metric('Number of Chunks', results.bundleSize.chunkCount)
    }
    
    if (results.lighthouse && !results.lighthouse.error && !results.lighthouse.skipped) {
      log.metric('Performance Score', results.lighthouse.performance, '/100')
      log.metric('Accessibility Score', results.lighthouse.accessibility, '/100')
      log.metric('Best Practices Score', results.lighthouse.bestPractices, '/100')
      log.metric('SEO Score', results.lighthouse.seo, '/100')
    }
  }

  displayAutoFixResults(results) {
    log.title('🔧 Auto-fix Results')
    
    Object.entries(results).forEach(([tool, result]) => {
      if (result.success) {
        log.success(`${tool.charAt(0).toUpperCase() + tool.slice(1)} auto-fix completed`)
      } else if (result.error) {
        log.error(`${tool.charAt(0).toUpperCase() + tool.slice(1)} auto-fix failed: ${result.error}`)
      }
    })
  }

  // Utility methods
  async getSourceFiles() {
    const glob = require('glob')
    const patterns = [
      'src/**/*.{js,jsx,ts,tsx}',
      'pages/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
      'utils/**/*.{js,jsx,ts,tsx}'
    ]
    
    const files = []
    for (const pattern of patterns) {
      try {
        const matches = glob.sync(pattern, { cwd: this.projectRoot })
        files.push(...matches.map(file => path.join(this.projectRoot, file)))
      } catch (error) {
        // Skip patterns that don't match
      }
    }
    
    return [...new Set(files)] // Remove duplicates
  }

  async getAPIFiles() {
    const glob = require('glob')
    const patterns = [
      'pages/api/**/*.{js,ts}',
      'src/pages/api/**/*.{js,ts}',
      'app/api/**/*.{js,ts}',
      'src/app/api/**/*.{js,ts}'
    ]
    
    const files = []
    for (const pattern of patterns) {
      try {
        const matches = glob.sync(pattern, { cwd: this.projectRoot })
        files.push(...matches.map(file => path.join(this.projectRoot, file)))
      } catch (error) {
        // Skip patterns that don't match
      }
    }
    
    return [...new Set(files)]
  }

  findExecutable(name) {
    try {
      execSync(`which ${name}`, { stdio: 'ignore' })
      return true
    } catch {
      try {
        execSync(`where ${name}`, { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    }
  }

  async installDependency(packages) {
    log.info(`Installing ${packages}...`)
    try {
      await this.executeCommand(`npm install ${packages}`, { ignoreErrors: false })
      log.success(`${packages} installed successfully`)
    } catch (error) {
      log.error(`Failed to install ${packages}: ${error.message}`)
      throw error
    }
  }

  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: this.projectRoot,
        stdio: 'pipe'
      })
      
      let stdout = ''
      let stderr = ''
      
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      child.on('close', (code) => {
        const result = { stdout, stderr, code }
        
        if (code !== 0 && !options.ignoreErrors) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        } else {
          resolve(result)
        }
      })
      
      child.on('error', (error) => {
        if (!options.ignoreErrors) {
          reject(error)
        } else {
          resolve({ stdout: '', stderr: error.message, code: 1 })
        }
      })
    })
  }

  async ensureESLintConfig() {
    const configPath = path.join(this.projectRoot, '.eslintrc.json')
    
    if (!fs.existsSync(configPath)) {
      const config = {
        extends: [
          'next/core-web-vitals',
          '@typescript-eslint/recommended'
        ],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        rules: {
          'no-console': 'warn',
          'no-unused-vars': 'error',
          '@typescript-eslint/no-explicit-any': 'warn',
          '@typescript-eslint/no-unused-vars': 'error'
        }
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      log.info('Created .eslintrc.json configuration')
    }
  }

  async ensurePrettierConfig() {
    const configPath = path.join(this.projectRoot, '.prettierrc')
    
    if (!fs.existsSync(configPath)) {
      const config = {
        semi: true,
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'avoid'
      }
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      log.info('Created .prettierrc configuration')
    }
  }

  findJestConfig() {
    const configFiles = [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.json'
    ]
    
    for (const configFile of configFiles) {
      if (fs.existsSync(path.join(this.projectRoot, configFile))) {
        return configFile
      }
    }
    
    // Check package.json for jest config
    const packageJsonPath = path.join(this.projectRoot, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      if (packageJson.jest) {
        return 'package.json'
      }
    }
    
    return null
  }

  async setupJestConfig() {
    const configPath = path.join(this.projectRoot, 'jest.config.js')
    
    const config = `
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './'
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1'
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
`
    
    fs.writeFileSync(configPath, config)
    
    // Create jest.setup.js
    const setupPath = path.join(this.projectRoot, 'jest.setup.js')
    const setupConfig = `
import '@testing-library/jest-dom'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/'
    }
  }
}))
`
    
    fs.writeFileSync(setupPath, setupConfig)
    
    log.info('Created Jest configuration files')
  }

  getProjectName() {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        return packageJson.name || 'Unknown Project'
      }
    } catch (error) {
      // Ignore error
    }
    
    return 'Unknown Project'
  }

  getProjectVersion() {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
        return packageJson.version || '1.0.0'
      }
    } catch (error) {
      // Ignore error
    }
    
    return '1.0.0'
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    
    return `${seconds}s`
  }
}

// CLI execution
if (require.main === module) {
  const analyzer = new CodeQualityAnalyzer()
  analyzer.run().catch(error => {
    console.error('Code quality analysis failed:', error)
    process.exit(1)
  })
}

module.exports = CodeQualityAnalyzer
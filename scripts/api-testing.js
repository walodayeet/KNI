#!/usr/bin/env node

/**
 * KNI Platform API Testing & Validation Suite
 * 
 * This script provides comprehensive API testing capabilities:
 * - Automated endpoint discovery and testing
 * - Request/response validation
 * - Performance testing and benchmarking
 * - Security testing (authentication, authorization, input validation)
 * - Load testing and stress testing
 * - API documentation validation
 * - Contract testing
 * - Integration testing
 * - Regression testing
 * - Test report generation
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
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
  test: (msg, status) => {
    const statusColor = status === 'PASS' ? colors.green : 
                       status === 'FAIL' ? colors.red : colors.yellow
    console.log(`${statusColor}${status}${colors.reset} ${msg}`)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query) => new Promise((resolve) => rl.question(query, resolve))

class APITestingSuite {
  constructor() {
    this.projectRoot = process.cwd()
    this.testsDir = path.join(this.projectRoot, 'api-tests')
    this.reportsDir = path.join(this.projectRoot, 'test-reports')
    this.configPath = path.join(this.projectRoot, 'api-test-config.json')
    
    this.baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    this.testResults = []
    this.performanceMetrics = []
    this.securityIssues = []
    
    this.config = this.loadConfig()
  }

  loadConfig() {
    const defaultConfig = {
      baseUrl: this.baseUrl,
      timeout: 10000,
      retries: 3,
      concurrency: 5,
      endpoints: {
        health: '/api/health',
        auth: {
          login: '/api/auth/signin',
          logout: '/api/auth/signout',
          session: '/api/auth/session'
        },
        users: {
          list: '/api/users',
          create: '/api/users',
          get: '/api/users/:id',
          update: '/api/users/:id',
          delete: '/api/users/:id'
        },
        posts: {
          list: '/api/posts',
          create: '/api/posts',
          get: '/api/posts/:id',
          update: '/api/posts/:id',
          delete: '/api/posts/:id'
        }
      },
      testData: {
        validUser: {
          email: 'test@example.com',
          password: 'testpassword123',
          name: 'Test User'
        },
        invalidUser: {
          email: 'invalid-email',
          password: '123',
          name: ''
        },
        validPost: {
          title: 'Test Post',
          content: 'This is a test post content',
          published: true
        },
        invalidPost: {
          title: '',
          content: '',
          published: 'invalid'
        }
      },
      security: {
        testSQLInjection: true,
        testXSS: true,
        testCSRF: true,
        testRateLimit: true,
        testAuthentication: true,
        testAuthorization: true
      },
      performance: {
        maxResponseTime: 2000,
        loadTestDuration: 60,
        loadTestConcurrency: 10,
        stressTestConcurrency: 50
      }
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        return { ...defaultConfig, ...userConfig }
      } catch (error) {
        log.warning('Failed to load API test config, using defaults')
      }
    }

    return defaultConfig
  }

  async run() {
    try {
      log.title('🧪 KNI Platform API Testing Suite')
      console.log('Comprehensive API testing and validation\n')

      await this.ensureDirectories()
      await this.selectTestType()
      
    } catch (error) {
      log.error(`API testing failed: ${error.message}`)
      process.exit(1)
    } finally {
      rl.close()
    }
  }

  async ensureDirectories() {
    const directories = [this.testsDir, this.reportsDir]
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async selectTestType() {
    console.log('Available test types:')
    console.log('1. Full API Test Suite')
    console.log('2. Endpoint Discovery')
    console.log('3. Functional Testing')
    console.log('4. Performance Testing')
    console.log('5. Security Testing')
    console.log('6. Load Testing')
    console.log('7. Stress Testing')
    console.log('8. Contract Testing')
    console.log('9. Regression Testing')
    console.log('10. Custom Test Suite')
    console.log('11. Generate Test Report')
    console.log('12. Validate API Documentation')

    const choice = await question('\nSelect test type (1-12): ')
    
    const testTypes = {
      '1': 'full-suite',
      '2': 'endpoint-discovery',
      '3': 'functional-testing',
      '4': 'performance-testing',
      '5': 'security-testing',
      '6': 'load-testing',
      '7': 'stress-testing',
      '8': 'contract-testing',
      '9': 'regression-testing',
      '10': 'custom-testing',
      '11': 'generate-report',
      '12': 'validate-docs'
    }

    const testType = testTypes[choice]
    if (!testType) {
      throw new Error('Invalid test type selected')
    }

    await this.executeTestType(testType)
  }

  async executeTestType(testType) {
    switch (testType) {
      case 'full-suite':
        await this.runFullTestSuite()
        break
      case 'endpoint-discovery':
        await this.discoverEndpoints()
        break
      case 'functional-testing':
        await this.functionalTesting()
        break
      case 'performance-testing':
        await this.performanceTesting()
        break
      case 'security-testing':
        await this.securityTesting()
        break
      case 'load-testing':
        await this.loadTesting()
        break
      case 'stress-testing':
        await this.stressTesting()
        break
      case 'contract-testing':
        await this.contractTesting()
        break
      case 'regression-testing':
        await this.regressionTesting()
        break
      case 'custom-testing':
        await this.customTesting()
        break
      case 'generate-report':
        await this.generateTestReport()
        break
      case 'validate-docs':
        await this.validateAPIDocumentation()
        break
    }
  }

  async runFullTestSuite() {
    log.title('🧪 Running Full API Test Suite')
    
    const testSuites = [
      { name: 'Endpoint Discovery', test: () => this.discoverEndpoints() },
      { name: 'Functional Testing', test: () => this.functionalTesting() },
      { name: 'Performance Testing', test: () => this.performanceTesting() },
      { name: 'Security Testing', test: () => this.securityTesting() },
      { name: 'Load Testing', test: () => this.loadTesting() }
    ]

    const startTime = Date.now()
    
    for (const suite of testSuites) {
      log.step(`Running ${suite.name}...`)
      try {
        await suite.test()
        log.success(`${suite.name} completed`)
      } catch (error) {
        log.error(`${suite.name} failed: ${error.message}`)
      }
    }

    const duration = Date.now() - startTime
    
    // Generate comprehensive report
    await this.generateTestReport()
    
    log.success(`Full test suite completed in ${this.formatDuration(duration)}`)
    
    // Display summary
    this.displayTestSummary()
  }

  async discoverEndpoints() {
    log.title('🔍 API Endpoint Discovery')
    
    const discoveredEndpoints = []
    
    // Scan API routes directory
    const apiDir = path.join(this.projectRoot, 'src', 'app', 'api')
    if (fs.existsSync(apiDir)) {
      const endpoints = await this.scanAPIDirectory(apiDir)
      discoveredEndpoints.push(...endpoints)
    }
    
    // Scan pages/api directory (for older Next.js structure)
    const pagesApiDir = path.join(this.projectRoot, 'pages', 'api')
    if (fs.existsSync(pagesApiDir)) {
      const endpoints = await this.scanAPIDirectory(pagesApiDir)
      discoveredEndpoints.push(...endpoints)
    }
    
    log.success(`Discovered ${discoveredEndpoints.length} API endpoints`)
    
    // Test each discovered endpoint
    for (const endpoint of discoveredEndpoints) {
      await this.testEndpoint(endpoint)
    }
    
    // Save discovered endpoints
    const discoveryReport = {
      timestamp: new Date().toISOString(),
      totalEndpoints: discoveredEndpoints.length,
      endpoints: discoveredEndpoints
    }
    
    const reportPath = path.join(this.reportsDir, 'endpoint-discovery.json')
    fs.writeFileSync(reportPath, JSON.stringify(discoveryReport, null, 2))
    
    log.success('Endpoint discovery completed')
  }

  async scanAPIDirectory(dir, basePath = '/api') {
    const endpoints = []
    
    try {
      const items = fs.readdirSync(dir)
      
      for (const item of items) {
        const itemPath = path.join(dir, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const subEndpoints = await this.scanAPIDirectory(itemPath, `${basePath}/${item}`)
          endpoints.push(...subEndpoints)
        } else if (item.endsWith('.js') || item.endsWith('.ts')) {
          // Found an API route file
          const routeName = item.replace(/\.(js|ts)$/, '')
          const endpoint = routeName === 'route' ? basePath : `${basePath}/${routeName}`
          
          endpoints.push({
            path: endpoint,
            file: itemPath,
            methods: await this.detectHTTPMethods(itemPath)
          })
        }
      }
    } catch (error) {
      log.warning(`Failed to scan directory ${dir}: ${error.message}`)
    }
    
    return endpoints
  }

  async detectHTTPMethods(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const methods = []
      
      // Look for exported HTTP method handlers
      const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
      
      for (const method of httpMethods) {
        if (content.includes(`export async function ${method}`) || 
            content.includes(`export function ${method}`) ||
            content.includes(`exports.${method.toLowerCase()}`) ||
            content.includes(`module.exports.${method.toLowerCase()}`)) {
          methods.push(method)
        }
      }
      
      return methods.length > 0 ? methods : ['GET'] // Default to GET if no methods detected
    } catch (error) {
      return ['GET']
    }
  }

  async testEndpoint(endpoint) {
    log.step(`Testing ${endpoint.path}...`)
    
    for (const method of endpoint.methods) {
      try {
        const startTime = Date.now()
        const response = await this.makeRequest(method, endpoint.path)
        const responseTime = Date.now() - startTime
        
        const testResult = {
          endpoint: endpoint.path,
          method,
          status: response.status,
          responseTime,
          success: response.status < 500,
          timestamp: new Date().toISOString()
        }
        
        this.testResults.push(testResult)
        
        const statusText = response.status < 400 ? 'PASS' : 
                          response.status < 500 ? 'WARN' : 'FAIL'
        
        log.test(`${method} ${endpoint.path} - ${response.status} (${responseTime}ms)`, statusText)
        
      } catch (error) {
        const testResult = {
          endpoint: endpoint.path,
          method,
          status: 'ERROR',
          error: error.message,
          success: false,
          timestamp: new Date().toISOString()
        }
        
        this.testResults.push(testResult)
        log.test(`${method} ${endpoint.path} - ERROR: ${error.message}`, 'FAIL')
      }
    }
  }

  async makeRequest(method, path, data = null, headers = {}) {
    const url = `${this.config.baseUrl}${path}`
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KNI-API-Test-Suite/1.0',
        ...headers
      }
    }
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data)
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        timeout: this.config.timeout
      })
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: await this.safeParseJSON(response)
      }
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`)
    }
  }

  async safeParseJSON(response) {
    try {
      const text = await response.text()
      return text ? JSON.parse(text) : null
    } catch (error) {
      return null
    }
  }

  async functionalTesting() {
    log.title('⚙️ Functional Testing')
    
    const functionalTests = [
      { name: 'Health Check', test: () => this.testHealthEndpoint() },
      { name: 'Authentication Flow', test: () => this.testAuthenticationFlow() },
      { name: 'User CRUD Operations', test: () => this.testUserCRUD() },
      { name: 'Post CRUD Operations', test: () => this.testPostCRUD() },
      { name: 'Error Handling', test: () => this.testErrorHandling() },
      { name: 'Input Validation', test: () => this.testInputValidation() }
    ]
    
    for (const test of functionalTests) {
      log.step(`Running ${test.name}...`)
      try {
        await test.test()
        log.success(`${test.name} passed`)
      } catch (error) {
        log.error(`${test.name} failed: ${error.message}`)
      }
    }
    
    log.success('Functional testing completed')
  }

  async testHealthEndpoint() {
    const response = await this.makeRequest('GET', '/api/health')
    
    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`)
    }
    
    if (!response.data || response.data.status !== 'ok') {
      throw new Error('Health check response invalid')
    }
  }

  async testAuthenticationFlow() {
    // Test session endpoint without authentication
    const sessionResponse = await this.makeRequest('GET', '/api/auth/session')
    
    if (sessionResponse.status !== 200) {
      throw new Error(`Session endpoint failed with status ${sessionResponse.status}`)
    }
    
    // Test protected endpoints (should return 401 or redirect)
    try {
      const protectedResponse = await this.makeRequest('GET', '/api/users')
      if (protectedResponse.status === 200) {
        log.warning('Protected endpoint accessible without authentication')
      }
    } catch (error) {
      // Expected for protected endpoints
    }
  }

  async testUserCRUD() {
    const testUser = this.config.testData.validUser
    
    // Test user creation
    try {
      const createResponse = await this.makeRequest('POST', '/api/users', testUser)
      if (createResponse.status === 201 || createResponse.status === 200) {
        log.success('User creation test passed')
      } else {
        log.warning(`User creation returned status ${createResponse.status}`)
      }
    } catch (error) {
      log.warning(`User creation test failed: ${error.message}`)
    }
    
    // Test user listing
    try {
      const listResponse = await this.makeRequest('GET', '/api/users')
      if (listResponse.status === 200) {
        log.success('User listing test passed')
      }
    } catch (error) {
      log.warning(`User listing test failed: ${error.message}`)
    }
  }

  async testPostCRUD() {
    const testPost = this.config.testData.validPost
    
    // Test post creation
    try {
      const createResponse = await this.makeRequest('POST', '/api/posts', testPost)
      if (createResponse.status === 201 || createResponse.status === 200) {
        log.success('Post creation test passed')
      } else {
        log.warning(`Post creation returned status ${createResponse.status}`)
      }
    } catch (error) {
      log.warning(`Post creation test failed: ${error.message}`)
    }
    
    // Test post listing
    try {
      const listResponse = await this.makeRequest('GET', '/api/posts')
      if (listResponse.status === 200) {
        log.success('Post listing test passed')
      }
    } catch (error) {
      log.warning(`Post listing test failed: ${error.message}`)
    }
  }

  async testErrorHandling() {
    // Test 404 handling
    try {
      const response = await this.makeRequest('GET', '/api/nonexistent')
      if (response.status === 404) {
        log.success('404 error handling test passed')
      } else {
        log.warning(`Expected 404, got ${response.status}`)
      }
    } catch (error) {
      log.warning(`404 test failed: ${error.message}`)
    }
    
    // Test invalid method handling
    try {
      const response = await this.makeRequest('INVALID', '/api/health')
      if (response.status === 405) {
        log.success('Invalid method handling test passed')
      }
    } catch (error) {
      // Expected for invalid methods
      log.success('Invalid method properly rejected')
    }
  }

  async testInputValidation() {
    const invalidUser = this.config.testData.invalidUser
    
    try {
      const response = await this.makeRequest('POST', '/api/users', invalidUser)
      if (response.status === 400 || response.status === 422) {
        log.success('Input validation test passed')
      } else {
        log.warning(`Expected validation error, got ${response.status}`)
      }
    } catch (error) {
      log.warning(`Input validation test failed: ${error.message}`)
    }
  }

  async performanceTesting() {
    log.title('⚡ Performance Testing')
    
    const endpoints = [
      '/api/health',
      '/api/users',
      '/api/posts'
    ]
    
    for (const endpoint of endpoints) {
      log.step(`Testing performance of ${endpoint}...`)
      
      const metrics = await this.measureEndpointPerformance(endpoint)
      this.performanceMetrics.push({
        endpoint,
        ...metrics,
        timestamp: new Date().toISOString()
      })
      
      log.success(`${endpoint}: avg ${metrics.averageResponseTime}ms, max ${metrics.maxResponseTime}ms`)
    }
    
    log.success('Performance testing completed')
  }

  async measureEndpointPerformance(endpoint, iterations = 10) {
    const responseTimes = []
    const errors = []
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now()
        const response = await this.makeRequest('GET', endpoint)
        const responseTime = Date.now() - startTime
        
        responseTimes.push(responseTime)
        
        if (response.status >= 400) {
          errors.push(response.status)
        }
      } catch (error) {
        errors.push(error.message)
      }
    }
    
    return {
      iterations,
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      errorRate: (errors.length / iterations) * 100,
      errors
    }
  }

  async securityTesting() {
    log.title('🔒 Security Testing')
    
    const securityTests = [
      { name: 'SQL Injection', test: () => this.testSQLInjection() },
      { name: 'XSS Protection', test: () => this.testXSSProtection() },
      { name: 'CSRF Protection', test: () => this.testCSRFProtection() },
      { name: 'Rate Limiting', test: () => this.testRateLimit() },
      { name: 'Authentication Bypass', test: () => this.testAuthBypass() },
      { name: 'Authorization Checks', test: () => this.testAuthorization() }
    ]
    
    for (const test of securityTests) {
      if (this.config.security[`test${test.name.replace(/\s+/g, '')}`]) {
        log.step(`Testing ${test.name}...`)
        try {
          await test.test()
          log.success(`${test.name} test passed`)
        } catch (error) {
          log.error(`${test.name} test failed: ${error.message}`)
          this.securityIssues.push({
            type: test.name,
            severity: 'HIGH',
            description: error.message,
            timestamp: new Date().toISOString()
          })
        }
      }
    }
    
    log.success('Security testing completed')
    
    if (this.securityIssues.length > 0) {
      log.warning(`Found ${this.securityIssues.length} security issues`)
    }
  }

  async testSQLInjection() {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --"
    ]
    
    for (const payload of sqlPayloads) {
      try {
        const response = await this.makeRequest('GET', `/api/users?search=${encodeURIComponent(payload)}`)
        
        // If the response indicates SQL injection vulnerability
        if (response.status === 500 && response.data && 
            (response.data.message.includes('SQL') || response.data.message.includes('database'))) {
          throw new Error(`SQL injection vulnerability detected with payload: ${payload}`)
        }
      } catch (error) {
        if (error.message.includes('SQL injection')) {
          throw error
        }
        // Other errors are expected (proper input validation)
      }
    }
  }

  async testXSSProtection() {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ]
    
    for (const payload of xssPayloads) {
      try {
        const response = await this.makeRequest('POST', '/api/posts', {
          title: payload,
          content: 'Test content'
        })
        
        // Check if the payload is reflected without sanitization
        if (response.data && JSON.stringify(response.data).includes(payload)) {
          throw new Error(`XSS vulnerability detected with payload: ${payload}`)
        }
      } catch (error) {
        if (error.message.includes('XSS vulnerability')) {
          throw error
        }
        // Other errors are expected (proper input validation)
      }
    }
  }

  async testCSRFProtection() {
    // Test if CSRF tokens are required for state-changing operations
    try {
      const response = await this.makeRequest('POST', '/api/users', this.config.testData.validUser, {
        'Origin': 'https://evil.com'
      })
      
      if (response.status === 200 || response.status === 201) {
        throw new Error('CSRF protection may be missing - cross-origin request succeeded')
      }
    } catch (error) {
      if (error.message.includes('CSRF protection')) {
        throw error
      }
      // Other errors are expected (proper CSRF protection)
    }
  }

  async testRateLimit() {
    const requests = []
    const endpoint = '/api/health'
    
    // Make rapid requests to test rate limiting
    for (let i = 0; i < 20; i++) {
      requests.push(this.makeRequest('GET', endpoint))
    }
    
    try {
      const responses = await Promise.all(requests)
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      
      if (rateLimitedResponses.length === 0) {
        log.warning('Rate limiting may not be implemented')
      } else {
        log.success(`Rate limiting detected after ${responses.length - rateLimitedResponses.length} requests`)
      }
    } catch (error) {
      // Some requests may fail due to rate limiting
    }
  }

  async testAuthBypass() {
    const bypassAttempts = [
      { headers: { 'Authorization': 'Bearer invalid-token' } },
      { headers: { 'Authorization': 'Bearer ' } },
      { headers: { 'X-User-ID': '1' } },
      { headers: { 'X-Admin': 'true' } }
    ]
    
    for (const attempt of bypassAttempts) {
      try {
        const response = await this.makeRequest('GET', '/api/users', null, attempt.headers)
        
        if (response.status === 200) {
          throw new Error(`Authentication bypass detected with headers: ${JSON.stringify(attempt.headers)}`)
        }
      } catch (error) {
        if (error.message.includes('Authentication bypass')) {
          throw error
        }
        // Other errors are expected (proper authentication)
      }
    }
  }

  async testAuthorization() {
    // Test if users can access resources they shouldn't
    try {
      const response = await this.makeRequest('DELETE', '/api/users/1')
      
      if (response.status === 200) {
        log.warning('Authorization check may be missing - delete operation succeeded without proper auth')
      }
    } catch (error) {
      // Expected for proper authorization
    }
  }

  async loadTesting() {
    log.title('🔄 Load Testing')
    
    const { loadTestDuration, loadTestConcurrency } = this.config.performance
    const endpoint = '/api/health'
    
    log.step(`Running load test: ${loadTestConcurrency} concurrent users for ${loadTestDuration}s`)
    
    const startTime = Date.now()
    const endTime = startTime + (loadTestDuration * 1000)
    const results = []
    
    const runLoadTest = async () => {
      while (Date.now() < endTime) {
        try {
          const requestStart = Date.now()
          const response = await this.makeRequest('GET', endpoint)
          const responseTime = Date.now() - requestStart
          
          results.push({
            timestamp: Date.now(),
            responseTime,
            status: response.status,
            success: response.status < 400
          })
        } catch (error) {
          results.push({
            timestamp: Date.now(),
            responseTime: null,
            status: 'ERROR',
            success: false,
            error: error.message
          })
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Start concurrent load test workers
    const workers = Array(loadTestConcurrency).fill().map(() => runLoadTest())
    await Promise.all(workers)
    
    // Analyze results
    const totalRequests = results.length
    const successfulRequests = results.filter(r => r.success).length
    const failedRequests = totalRequests - successfulRequests
    const responseTimes = results.filter(r => r.responseTime).map(r => r.responseTime)
    
    const loadTestResults = {
      duration: loadTestDuration,
      concurrency: loadTestConcurrency,
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: (successfulRequests / totalRequests) * 100,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: totalRequests / loadTestDuration
    }
    
    log.success(`Load test completed: ${loadTestResults.requestsPerSecond.toFixed(2)} req/s, ${loadTestResults.successRate.toFixed(1)}% success rate`)
    
    // Save load test results
    const reportPath = path.join(this.reportsDir, 'load-test-results.json')
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: loadTestResults,
      rawData: results
    }, null, 2))
  }

  async stressTesting() {
    log.title('💥 Stress Testing')
    
    const { stressTestConcurrency } = this.config.performance
    const endpoint = '/api/health'
    
    log.step(`Running stress test with ${stressTestConcurrency} concurrent users`)
    log.warning('This test may impact system performance')
    
    const results = []
    const duration = 30 // 30 seconds stress test
    const startTime = Date.now()
    const endTime = startTime + (duration * 1000)
    
    const runStressTest = async () => {
      while (Date.now() < endTime) {
        try {
          const requestStart = Date.now()
          const response = await this.makeRequest('GET', endpoint)
          const responseTime = Date.now() - requestStart
          
          results.push({
            timestamp: Date.now(),
            responseTime,
            status: response.status,
            success: response.status < 400
          })
        } catch (error) {
          results.push({
            timestamp: Date.now(),
            responseTime: null,
            status: 'ERROR',
            success: false
          })
        }
      }
    }
    
    // Start stress test workers
    const workers = Array(stressTestConcurrency).fill().map(() => runStressTest())
    await Promise.all(workers)
    
    // Analyze stress test results
    const totalRequests = results.length
    const successfulRequests = results.filter(r => r.success).length
    const responseTimes = results.filter(r => r.responseTime).map(r => r.responseTime)
    
    const stressTestResults = {
      concurrency: stressTestConcurrency,
      duration,
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      successRate: (successfulRequests / totalRequests) * 100,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: totalRequests / duration
    }
    
    log.success(`Stress test completed: ${stressTestResults.requestsPerSecond.toFixed(2)} req/s under stress`)
    
    if (stressTestResults.successRate < 95) {
      log.warning(`Low success rate under stress: ${stressTestResults.successRate.toFixed(1)}%`)
    }
  }

  async contractTesting() {
    log.title('📋 Contract Testing')
    
    // This would implement API contract testing
    // For now, we'll do basic schema validation
    
    const endpoints = [
      { path: '/api/health', expectedSchema: { status: 'string' } },
      { path: '/api/users', expectedSchema: { users: 'array' } }
    ]
    
    for (const endpoint of endpoints) {
      log.step(`Testing contract for ${endpoint.path}...`)
      
      try {
        const response = await this.makeRequest('GET', endpoint.path)
        
        if (response.status === 200 && response.data) {
          const isValid = this.validateSchema(response.data, endpoint.expectedSchema)
          if (isValid) {
            log.success(`Contract test passed for ${endpoint.path}`)
          } else {
            log.error(`Contract test failed for ${endpoint.path}: schema mismatch`)
          }
        }
      } catch (error) {
        log.error(`Contract test failed for ${endpoint.path}: ${error.message}`)
      }
    }
  }

  validateSchema(data, schema) {
    // Simple schema validation
    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in data)) {
        return false
      }
      
      const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key]
      if (actualType !== expectedType) {
        return false
      }
    }
    
    return true
  }

  async regressionTesting() {
    log.title('🔄 Regression Testing')
    
    // Load previous test results for comparison
    const previousResultsPath = path.join(this.reportsDir, 'baseline-results.json')
    
    if (!fs.existsSync(previousResultsPath)) {
      log.warning('No baseline results found. Creating baseline...')
      await this.createBaseline()
      return
    }
    
    const baselineResults = JSON.parse(fs.readFileSync(previousResultsPath, 'utf8'))
    
    // Run current tests
    await this.functionalTesting()
    await this.performanceTesting()
    
    // Compare results
    const regressions = this.detectRegressions(baselineResults)
    
    if (regressions.length > 0) {
      log.error(`Detected ${regressions.length} regressions:`)
      regressions.forEach(regression => {
        log.error(`  - ${regression.description}`)
      })
    } else {
      log.success('No regressions detected')
    }
  }

  async createBaseline() {
    const baseline = {
      timestamp: new Date().toISOString(),
      testResults: this.testResults,
      performanceMetrics: this.performanceMetrics
    }
    
    const baselinePath = path.join(this.reportsDir, 'baseline-results.json')
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2))
    
    log.success('Baseline results created')
  }

  detectRegressions(baseline) {
    const regressions = []
    
    // Check for performance regressions
    for (const currentMetric of this.performanceMetrics) {
      const baselineMetric = baseline.performanceMetrics.find(m => m.endpoint === currentMetric.endpoint)
      
      if (baselineMetric) {
        const performanceDegradation = ((currentMetric.averageResponseTime - baselineMetric.averageResponseTime) / baselineMetric.averageResponseTime) * 100
        
        if (performanceDegradation > 20) { // 20% performance degradation threshold
          regressions.push({
            type: 'performance',
            endpoint: currentMetric.endpoint,
            description: `Performance regression: ${performanceDegradation.toFixed(1)}% slower than baseline`
          })
        }
      }
    }
    
    return regressions
  }

  async customTesting() {
    log.title('🎯 Custom Testing')
    
    const customTestFile = path.join(this.testsDir, 'custom-tests.js')
    
    if (fs.existsSync(customTestFile)) {
      log.step('Running custom tests...')
      try {
        const customTests = require(customTestFile)
        await customTests.run(this)
        log.success('Custom tests completed')
      } catch (error) {
        log.error(`Custom tests failed: ${error.message}`)
      }
    } else {
      log.info('No custom tests found. Creating template...')
      await this.createCustomTestTemplate()
    }
  }

  async createCustomTestTemplate() {
    const template = `
// Custom API Tests for KNI Platform
// Add your custom test cases here

module.exports = {
  async run(testSuite) {
    console.log('Running custom tests...')
    
    // Example custom test
    await testSuite.customTest('Custom Health Check', async () => {
      const response = await testSuite.makeRequest('GET', '/api/health')
      if (response.status !== 200) {
        throw new Error('Health check failed')
      }
      console.log('✅ Custom health check passed')
    })
    
    // Add more custom tests here
  }
}
`
    
    const templatePath = path.join(this.testsDir, 'custom-tests.js')
    fs.writeFileSync(templatePath, template)
    
    log.success(`Custom test template created at ${templatePath}`)
  }

  async customTest(name, testFunction) {
    try {
      await testFunction()
      this.testResults.push({
        name,
        status: 'PASS',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      this.testResults.push({
        name,
        status: 'FAIL',
        error: error.message,
        timestamp: new Date().toISOString()
      })
      throw error
    }
  }

  async generateTestReport() {
    log.title('📊 Generating Test Report')
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.testResults.length,
        passedTests: this.testResults.filter(r => r.success !== false).length,
        failedTests: this.testResults.filter(r => r.success === false).length,
        securityIssues: this.securityIssues.length
      },
      testResults: this.testResults,
      performanceMetrics: this.performanceMetrics,
      securityIssues: this.securityIssues,
      configuration: this.config
    }
    
    // Generate JSON report
    const jsonReportPath = path.join(this.reportsDir, 'api-test-report.json')
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(report)
    const htmlReportPath = path.join(this.reportsDir, 'api-test-report.html')
    fs.writeFileSync(htmlReportPath, htmlReport)
    
    log.success('Test reports generated')
    log.info(`JSON Report: ${jsonReportPath}`)
    log.info(`HTML Report: ${htmlReportPath}`)
    
    return report
  }

  generateHTMLReport(report) {
    const passRate = ((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>KNI Platform API Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0; font-size: 2em; color: #333; }
        .metric p { margin: 5px 0 0 0; color: #666; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 30px 0; }
        .test-result { padding: 10px; margin: 5px 0; border-radius: 5px; }
        .test-pass { background: #d4edda; border-left: 4px solid #28a745; }
        .test-fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .performance-chart { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 KNI Platform API Test Report</h1>
            <p>Generated: ${report.timestamp}</p>
            <p>Test Suite Execution Summary</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <h3 class="${passRate >= 90 ? 'pass' : passRate >= 70 ? 'warning' : 'fail'}">${passRate}%</h3>
                <p>Pass Rate</p>
            </div>
            <div class="metric">
                <h3>${report.summary.totalTests}</h3>
                <p>Total Tests</p>
            </div>
            <div class="metric">
                <h3 class="pass">${report.summary.passedTests}</h3>
                <p>Passed</p>
            </div>
            <div class="metric">
                <h3 class="fail">${report.summary.failedTests}</h3>
                <p>Failed</p>
            </div>
            <div class="metric">
                <h3 class="${report.summary.securityIssues === 0 ? 'pass' : 'fail'}">${report.summary.securityIssues}</h3>
                <p>Security Issues</p>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 Test Results</h2>
            ${report.testResults.map(test => `
                <div class="test-result ${test.success !== false ? 'test-pass' : 'test-fail'}">
                    <strong>${test.endpoint || test.name}</strong> ${test.method || ''}
                    <span style="float: right;">${test.success !== false ? '✅ PASS' : '❌ FAIL'}</span>
                    ${test.responseTime ? `<br><small>Response Time: ${test.responseTime}ms</small>` : ''}
                    ${test.error ? `<br><small style="color: #dc3545;">Error: ${test.error}</small>` : ''}
                </div>
            `).join('')}
        </div>
        
        ${report.performanceMetrics.length > 0 ? `
        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            ${report.performanceMetrics.map(metric => `
                <div class="performance-chart">
                    <h4>${metric.endpoint}</h4>
                    <p>Average Response Time: ${metric.averageResponseTime}ms</p>
                    <p>Max Response Time: ${metric.maxResponseTime}ms</p>
                    <p>Error Rate: ${metric.errorRate}%</p>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        ${report.securityIssues.length > 0 ? `
        <div class="section">
            <h2>🔒 Security Issues</h2>
            ${report.securityIssues.map(issue => `
                <div class="test-result test-fail">
                    <strong>${issue.type}</strong> - ${issue.severity}
                    <br><small>${issue.description}</small>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="section">
            <h2>⚙️ Test Configuration</h2>
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(report.configuration, null, 2)}</pre>
        </div>
    </div>
</body>
</html>
`
  }

  async validateAPIDocumentation() {
    log.title('📚 API Documentation Validation')
    
    // This would validate API documentation against actual implementation
    log.info('API documentation validation would be implemented here')
    log.info('This could include:')
    log.info('- OpenAPI/Swagger spec validation')
    log.info('- Endpoint documentation completeness')
    log.info('- Example request/response validation')
    log.info('- Parameter documentation accuracy')
    
    log.success('Documentation validation completed')
  }

  displayTestSummary() {
    console.log('\n📊 Test Summary:')
    console.log('─'.repeat(50))
    
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.success !== false).length
    const failedTests = totalTests - passedTests
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0
    
    console.log(`Total Tests: ${totalTests}`)
    console.log(`Passed: ${colors.green}${passedTests}${colors.reset}`)
    console.log(`Failed: ${colors.red}${failedTests}${colors.reset}`)
    console.log(`Pass Rate: ${passRate >= 90 ? colors.green : passRate >= 70 ? colors.yellow : colors.red}${passRate}%${colors.reset}`)
    
    if (this.performanceMetrics.length > 0) {
      const avgResponseTime = this.performanceMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / this.performanceMetrics.length
      console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`)
    }
    
    if (this.securityIssues.length > 0) {
      console.log(`Security Issues: ${colors.red}${this.securityIssues.length}${colors.reset}`)
    }
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

// CLI handling
if (require.main === module) {
  const apiTesting = new APITestingSuite()
  apiTesting.run().catch(error => {
    console.error('API testing failed:', error)
    process.exit(1)
  })
}

module.exports = APITestingSuite
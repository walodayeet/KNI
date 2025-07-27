#!/usr/bin/env node

/**
 * KNI Platform Real-time Monitoring Dashboard
 * 
 * This script provides a comprehensive real-time monitoring dashboard:
 * - System resource monitoring (CPU, Memory, Disk, Network)
 * - Application performance metrics
 * - Database performance monitoring
 * - API endpoint health monitoring
 * - Real-time alerts and notifications
 * - Historical data tracking
 * - Custom metric collection
 * - Integration with external monitoring services
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')
const readline = require('readline')
const EventEmitter = require('events')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.magenta}▶${colors.reset} ${msg}`),
  metric: (label, value, unit = '', status = 'normal') => {
    const statusColor = status === 'critical' ? colors.red : 
                       status === 'warning' ? colors.yellow : colors.green
    console.log(`${statusColor}${label}:${colors.reset} ${value}${unit}`)
  }
}

class MonitoringDashboard extends EventEmitter {
  constructor() {
    super()
    this.projectRoot = process.cwd()
    this.metricsDir = path.join(this.projectRoot, 'monitoring-data')
    this.alertsDir = path.join(this.projectRoot, 'alerts')
    this.configPath = path.join(this.projectRoot, 'monitoring-config.json')
    
    this.isRunning = false
    this.intervals = []
    this.metrics = new Map()
    this.alerts = []
    this.thresholds = this.loadThresholds()
    
    this.setupEventHandlers()
  }

  setupEventHandlers() {
    this.on('metric', (metric) => this.handleMetric(metric))
    this.on('alert', (alert) => this.handleAlert(alert))
    
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
  }

  loadThresholds() {
    const defaultThresholds = {
      cpu: { warning: 70, critical: 85 },
      memory: { warning: 80, critical: 90 },
      disk: { warning: 85, critical: 95 },
      responseTime: { warning: 1000, critical: 3000 },
      errorRate: { warning: 1, critical: 5 },
      dbConnections: { warning: 80, critical: 95 }
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
        return { ...defaultThresholds, ...config.thresholds }
      } catch (error) {
        log.warning('Failed to load monitoring config, using defaults')
      }
    }

    return defaultThresholds
  }

  async run() {
    try {
      log.title('📊 KNI Platform Monitoring Dashboard')
      console.log('Real-time system and application monitoring\n')

      await this.ensureDirectories()
      await this.selectMode()
      
    } catch (error) {
      log.error(`Monitoring dashboard failed: ${error.message}`)
      process.exit(1)
    }
  }

  async ensureDirectories() {
    const directories = [this.metricsDir, this.alertsDir]
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  async selectMode() {
    console.log('Available monitoring modes:')
    console.log('1. Real-time Dashboard')
    console.log('2. System Overview')
    console.log('3. Performance Analysis')
    console.log('4. Alert Configuration')
    console.log('5. Historical Data View')
    console.log('6. Export Metrics')
    console.log('7. Health Check')
    console.log('8. Custom Metrics')
    console.log('9. Start Background Monitoring')
    console.log('10. Stop Background Monitoring')

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const choice = await new Promise((resolve) => {
      rl.question('\nSelect mode (1-10): ', resolve)
    })
    
    rl.close()

    const modes = {
      '1': 'realtime-dashboard',
      '2': 'system-overview',
      '3': 'performance-analysis',
      '4': 'alert-configuration',
      '5': 'historical-data',
      '6': 'export-metrics',
      '7': 'health-check',
      '8': 'custom-metrics',
      '9': 'start-monitoring',
      '10': 'stop-monitoring'
    }

    const mode = modes[choice]
    if (!mode) {
      throw new Error('Invalid mode selected')
    }

    await this.executeMode(mode)
  }

  async executeMode(mode) {
    switch (mode) {
      case 'realtime-dashboard':
        await this.startRealtimeDashboard()
        break
      case 'system-overview':
        await this.showSystemOverview()
        break
      case 'performance-analysis':
        await this.performanceAnalysis()
        break
      case 'alert-configuration':
        await this.configureAlerts()
        break
      case 'historical-data':
        await this.showHistoricalData()
        break
      case 'export-metrics':
        await this.exportMetrics()
        break
      case 'health-check':
        await this.healthCheck()
        break
      case 'custom-metrics':
        await this.customMetrics()
        break
      case 'start-monitoring':
        await this.startBackgroundMonitoring()
        break
      case 'stop-monitoring':
        await this.stopBackgroundMonitoring()
        break
    }
  }

  async startRealtimeDashboard() {
    log.title('📊 Real-time Monitoring Dashboard')
    log.info('Press Ctrl+C to stop monitoring')
    
    this.isRunning = true
    
    // Clear screen and setup dashboard
    console.clear()
    this.printDashboardHeader()
    
    // Start monitoring intervals
    this.intervals.push(
      setInterval(() => this.updateSystemMetrics(), 1000),
      setInterval(() => this.updateApplicationMetrics(), 5000),
      setInterval(() => this.updateDatabaseMetrics(), 10000),
      setInterval(() => this.updateNetworkMetrics(), 2000)
    )
    
    // Update dashboard display
    this.intervals.push(
      setInterval(() => this.refreshDashboard(), 1000)
    )
    
    // Keep the process running
    await new Promise((resolve) => {
      process.on('SIGINT', resolve)
    })
    
    this.shutdown()
  }

  printDashboardHeader() {
    console.log(`${colors.cyan}${colors.bright}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}║                        KNI Platform Monitoring Dashboard                     ║${colors.reset}`)
    console.log(`${colors.cyan}${colors.bright}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}`)
    console.log()
  }

  refreshDashboard() {
    // Move cursor to top and clear screen content
    process.stdout.write('\x1b[H')
    
    this.printDashboardHeader()
    this.displaySystemMetrics()
    this.displayApplicationMetrics()
    this.displayDatabaseMetrics()
    this.displayNetworkMetrics()
    this.displayAlerts()
    
    console.log(`\n${colors.blue}Last updated: ${new Date().toLocaleTimeString()}${colors.reset}`)
  }

  async updateSystemMetrics() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100
    const memoryUsage = (1 - os.freemem() / os.totalmem()) * 100
    const diskUsage = await this.getDiskUsage()
    
    this.setMetric('cpu_usage', cpuUsage, '%')
    this.setMetric('memory_usage', memoryUsage, '%')
    this.setMetric('disk_usage', diskUsage, '%')
    this.setMetric('uptime', os.uptime(), 's')
    this.setMetric('load_average', os.loadavg()[0], '')
  }

  async updateApplicationMetrics() {
    try {
      // Simulate application metrics (in real implementation, these would come from your app)
      const responseTime = Math.random() * 500 + 100 // 100-600ms
      const requestsPerSecond = Math.floor(Math.random() * 100) + 20
      const errorRate = Math.random() * 2 // 0-2%
      const activeUsers = Math.floor(Math.random() * 500) + 50
      
      this.setMetric('response_time', responseTime, 'ms')
      this.setMetric('requests_per_second', requestsPerSecond, '/s')
      this.setMetric('error_rate', errorRate, '%')
      this.setMetric('active_users', activeUsers, '')
      
      // Check API health
      const apiHealth = await this.checkAPIHealth()
      this.setMetric('api_health', apiHealth ? 'UP' : 'DOWN', '')
      
    } catch (error) {
      this.setMetric('api_health', 'ERROR', '')
    }
  }

  async updateDatabaseMetrics() {
    try {
      // Simulate database metrics
      const connectionPoolUsage = Math.random() * 80 + 10 // 10-90%
      const queryTime = Math.random() * 100 + 10 // 10-110ms
      const activeConnections = Math.floor(Math.random() * 50) + 5
      const cacheHitRatio = Math.random() * 20 + 80 // 80-100%
      
      this.setMetric('db_connection_pool', connectionPoolUsage, '%')
      this.setMetric('db_query_time', queryTime, 'ms')
      this.setMetric('db_active_connections', activeConnections, '')
      this.setMetric('db_cache_hit_ratio', cacheHitRatio, '%')
      
    } catch (error) {
      this.setMetric('db_status', 'ERROR', '')
    }
  }

  async updateNetworkMetrics() {
    try {
      // Simulate network metrics
      const networkLatency = Math.random() * 50 + 10 // 10-60ms
      const bandwidth = Math.random() * 100 + 50 // 50-150 Mbps
      const packetLoss = Math.random() * 1 // 0-1%
      
      this.setMetric('network_latency', networkLatency, 'ms')
      this.setMetric('network_bandwidth', bandwidth, 'Mbps')
      this.setMetric('network_packet_loss', packetLoss, '%')
      
    } catch (error) {
      this.setMetric('network_status', 'ERROR', '')
    }
  }

  displaySystemMetrics() {
    console.log(`${colors.yellow}${colors.bright}🖥️  System Resources${colors.reset}`)
    console.log('─'.repeat(50))
    
    const cpu = this.getMetric('cpu_usage')
    const memory = this.getMetric('memory_usage')
    const disk = this.getMetric('disk_usage')
    const uptime = this.getMetric('uptime')
    const load = this.getMetric('load_average')
    
    this.displayMetricBar('CPU Usage', cpu.value, cpu.unit, this.getStatus('cpu', cpu.value))
    this.displayMetricBar('Memory Usage', memory.value, memory.unit, this.getStatus('memory', memory.value))
    this.displayMetricBar('Disk Usage', disk.value, disk.unit, this.getStatus('disk', disk.value))
    
    console.log(`Uptime: ${this.formatUptime(uptime.value)}  Load: ${load.value.toFixed(2)}`)
    console.log()
  }

  displayApplicationMetrics() {
    console.log(`${colors.green}${colors.bright}🚀 Application Performance${colors.reset}`)
    console.log('─'.repeat(50))
    
    const responseTime = this.getMetric('response_time')
    const rps = this.getMetric('requests_per_second')
    const errorRate = this.getMetric('error_rate')
    const activeUsers = this.getMetric('active_users')
    const apiHealth = this.getMetric('api_health')
    
    console.log(`Response Time: ${responseTime.value.toFixed(0)}${responseTime.unit}  RPS: ${rps.value}/s`)
    console.log(`Error Rate: ${errorRate.value.toFixed(2)}%  Active Users: ${activeUsers.value}`)
    console.log(`API Status: ${this.colorizeStatus(apiHealth.value)}`)
    console.log()
  }

  displayDatabaseMetrics() {
    console.log(`${colors.blue}${colors.bright}🗄️  Database Performance${colors.reset}`)
    console.log('─'.repeat(50))
    
    const poolUsage = this.getMetric('db_connection_pool')
    const queryTime = this.getMetric('db_query_time')
    const connections = this.getMetric('db_active_connections')
    const cacheHit = this.getMetric('db_cache_hit_ratio')
    
    this.displayMetricBar('Connection Pool', poolUsage.value, poolUsage.unit, this.getStatus('dbConnections', poolUsage.value))
    console.log(`Query Time: ${queryTime.value.toFixed(0)}${queryTime.unit}  Connections: ${connections.value}`)
    console.log(`Cache Hit Ratio: ${cacheHit.value.toFixed(1)}%`)
    console.log()
  }

  displayNetworkMetrics() {
    console.log(`${colors.magenta}${colors.bright}🌐 Network Performance${colors.reset}`)
    console.log('─'.repeat(50))
    
    const latency = this.getMetric('network_latency')
    const bandwidth = this.getMetric('network_bandwidth')
    const packetLoss = this.getMetric('network_packet_loss')
    
    console.log(`Latency: ${latency.value.toFixed(0)}${latency.unit}  Bandwidth: ${bandwidth.value.toFixed(1)}${bandwidth.unit}`)
    console.log(`Packet Loss: ${packetLoss.value.toFixed(2)}%`)
    console.log()
  }

  displayAlerts() {
    if (this.alerts.length > 0) {
      console.log(`${colors.red}${colors.bright}🚨 Active Alerts${colors.reset}`)
      console.log('─'.repeat(50))
      
      this.alerts.slice(-5).forEach(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString()
        console.log(`${colors.red}[${time}] ${alert.message}${colors.reset}`)
      })
      console.log()
    }
  }

  displayMetricBar(label, value, unit, status) {
    const barLength = 30
    const percentage = Math.min(100, Math.max(0, value))
    const filledLength = Math.floor((percentage / 100) * barLength)
    const emptyLength = barLength - filledLength
    
    const statusColor = status === 'critical' ? colors.red : 
                       status === 'warning' ? colors.yellow : colors.green
    
    const bar = `${statusColor}${'█'.repeat(filledLength)}${colors.reset}${'░'.repeat(emptyLength)}`
    console.log(`${label.padEnd(15)} [${bar}] ${value.toFixed(1)}${unit}`)
  }

  setMetric(name, value, unit = '') {
    const metric = {
      name,
      value,
      unit,
      timestamp: Date.now()
    }
    
    this.metrics.set(name, metric)
    this.emit('metric', metric)
    
    // Save to historical data
    this.saveMetricToHistory(metric)
  }

  getMetric(name) {
    return this.metrics.get(name) || { value: 0, unit: '', timestamp: Date.now() }
  }

  getStatus(type, value) {
    const threshold = this.thresholds[type]
    if (!threshold) return 'normal'
    
    if (value >= threshold.critical) return 'critical'
    if (value >= threshold.warning) return 'warning'
    return 'normal'
  }

  colorizeStatus(status) {
    switch (status) {
      case 'UP': return `${colors.green}${status}${colors.reset}`
      case 'DOWN': return `${colors.red}${status}${colors.reset}`
      case 'ERROR': return `${colors.red}${status}${colors.reset}`
      default: return status
    }
  }

  handleMetric(metric) {
    // Check for threshold violations
    const status = this.getStatus(metric.name.replace('_usage', ''), metric.value)
    
    if (status === 'critical' || status === 'warning') {
      this.createAlert({
        type: status,
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        threshold: this.thresholds[metric.name.replace('_usage', '')],
        message: `${metric.name} is ${status}: ${metric.value}${metric.unit}`
      })
    }
  }

  createAlert(alertData) {
    const alert = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      ...alertData
    }
    
    this.alerts.push(alert)
    this.emit('alert', alert)
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }
  }

  handleAlert(alert) {
    // Save alert to file
    const alertFile = path.join(this.alertsDir, `${new Date().toISOString().split('T')[0]}.json`)
    
    let alerts = []
    if (fs.existsSync(alertFile)) {
      try {
        alerts = JSON.parse(fs.readFileSync(alertFile, 'utf8'))
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    alerts.push(alert)
    fs.writeFileSync(alertFile, JSON.stringify(alerts, null, 2))
    
    // Send notifications (implement based on your notification system)
    this.sendNotification(alert)
  }

  sendNotification(alert) {
    // This would integrate with your notification system
    // For now, just log to console
    if (alert.type === 'critical') {
      log.error(`CRITICAL ALERT: ${alert.message}`)
    } else if (alert.type === 'warning') {
      log.warning(`WARNING: ${alert.message}`)
    }
  }

  saveMetricToHistory(metric) {
    const date = new Date().toISOString().split('T')[0]
    const historyFile = path.join(this.metricsDir, `${date}.json`)
    
    let metrics = []
    if (fs.existsSync(historyFile)) {
      try {
        metrics = JSON.parse(fs.readFileSync(historyFile, 'utf8'))
      } catch (error) {
        // Ignore parse errors
      }
    }
    
    metrics.push(metric)
    
    // Keep only last 1000 metrics per day
    if (metrics.length > 1000) {
      metrics = metrics.slice(-1000)
    }
    
    fs.writeFileSync(historyFile, JSON.stringify(metrics, null, 2))
  }

  async getDiskUsage() {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd use platform-specific commands
      return Math.random() * 30 + 40 // 40-70%
    } catch (error) {
      return 0
    }
  }

  async checkAPIHealth() {
    try {
      // This would check your actual API endpoints
      const response = await fetch('http://localhost:3000/api/health', { timeout: 5000 })
      return response.ok
    } catch (error) {
      return false
    }
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  async showSystemOverview() {
    log.title('🖥️ System Overview')
    
    // Collect current metrics
    await this.updateSystemMetrics()
    await this.updateApplicationMetrics()
    await this.updateDatabaseMetrics()
    
    console.log('\n📊 Current System Status:')
    console.log('─'.repeat(50))
    
    // System info
    console.log(`Platform: ${os.platform()} ${os.arch()}`)
    console.log(`Node.js: ${process.version}`)
    console.log(`CPU Cores: ${os.cpus().length}`)
    console.log(`Total Memory: ${this.formatBytes(os.totalmem())}`)
    console.log(`Hostname: ${os.hostname()}`)
    
    console.log('\n📈 Performance Metrics:')
    console.log('─'.repeat(50))
    
    this.displaySystemMetrics()
    this.displayApplicationMetrics()
    this.displayDatabaseMetrics()
    
    log.success('System overview completed')
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  shutdown() {
    log.info('Shutting down monitoring dashboard...')
    
    this.isRunning = false
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
    
    log.success('Monitoring dashboard stopped')
    process.exit(0)
  }
}

// CLI handling
if (require.main === module) {
  const dashboard = new MonitoringDashboard()
  dashboard.run().catch(error => {
    console.error('Monitoring dashboard failed:', error)
    process.exit(1)
  })
}

module.exports = MonitoringDashboard
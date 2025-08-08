import { z } from 'zod'
import { logger } from './logger'
import { CacheService } from './cache'
import { EventEmitter } from 'events'
import { format, subDays } from 'date-fns'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { createCanvas } from 'canvas'
import Chart from 'chart.js/auto'

// Reporting configuration
interface ReportingConfig {
  enableCaching: boolean
  enableScheduling: boolean
  enableExports: boolean
  cacheTimeout: number
  maxReportSize: number
  defaultPageSize: number
  enableCharts: boolean
  chartDefaults: ChartDefaults
}

interface ChartDefaults {
  width: number
  height: number
  backgroundColor: string
  fontFamily: string
  fontSize: number
}

const defaultReportingConfig: ReportingConfig = {
  enableCaching: process.env.REPORTING_ENABLE_CACHING !== 'false',
  enableScheduling: process.env.REPORTING_ENABLE_SCHEDULING !== 'false',
  enableExports: true,
  cacheTimeout: parseInt(process.env.REPORTING_CACHE_TIMEOUT || '3600'), // 1 hour
  maxReportSize: parseInt(process.env.REPORTING_MAX_SIZE || '10000'), // 10k records
  defaultPageSize: parseInt(process.env.REPORTING_PAGE_SIZE || '100'),
  enableCharts: true,
  chartDefaults: {
    width: 800,
    height: 400,
    backgroundColor: '#ffffff',
    fontFamily: 'Arial',
    fontSize: 12,
  },
}

// Reporting interfaces
interface ReportDefinition {
  id: string
  name: string
  description?: string
  type: 'table' | 'chart' | 'dashboard' | 'summary'
  category: 'users' | 'tests' | 'performance' | 'analytics' | 'system' | 'custom'
  dataSource: ReportDataSource
  visualization: ReportVisualization
  filters: ReportFilter[]
  parameters: ReportParameter[]
  schedule?: ReportSchedule
  permissions: ReportPermissions
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

interface ReportDataSource {
  type: 'database' | 'api' | 'file' | 'cache'
  connection: string
  query: string
  parameters?: Record<string, any>
  transformations?: DataTransformation[]
}

interface DataTransformation {
  type: 'filter' | 'aggregate' | 'sort' | 'group' | 'calculate' | 'format'
  config: Record<string, any>
}

interface ReportVisualization {
  type: 'table' | 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'scatter' | 'heatmap' | 'gauge' | 'metric'
  config: VisualizationConfig
}

interface VisualizationConfig {
  title?: string
  subtitle?: string
  xAxis?: AxisConfig
  yAxis?: AxisConfig
  legend?: LegendConfig
  colors?: string[]
  series?: SeriesConfig[]
  options?: Record<string, any>
}

interface AxisConfig {
  label: string
  field: string
  type: 'category' | 'numeric' | 'datetime'
  format?: string
  min?: number
  max?: number
}

interface LegendConfig {
  show: boolean
  position: 'top' | 'bottom' | 'left' | 'right'
}

interface SeriesConfig {
  name: string
  field: string
  type?: string
  color?: string
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max'
}

interface ReportFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'between' | 'is_null' | 'is_not_null'
  value?: any
  values?: any[]
  required: boolean
  defaultValue?: any
}

interface ReportParameter {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect'
  label: string
  description?: string
  required: boolean
  defaultValue?: any
  options?: ParameterOption[]
  validation?: ParameterValidation
}

interface ParameterOption {
  label: string
  value: any
}

interface ParameterValidation {
  min?: number
  max?: number
  pattern?: string
  message?: string
}

interface ReportSchedule {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  cronExpression?: string
  timezone: string
  recipients: string[]
  format: 'pdf' | 'excel' | 'csv' | 'json'
  nextRun?: Date
  lastRun?: Date
}

interface ReportPermissions {
  view: string[]
  edit: string[]
  delete: string[]
  export: string[]
  schedule: string[]
}

interface ReportResult {
  id: string
  reportId: string
  data: any[]
  metadata: ReportMetadata
  visualization?: ReportVisualizationResult
  generatedAt: Date
  generatedBy?: string
  parameters: Record<string, any>
  filters: Record<string, any>
}

interface ReportMetadata {
  totalRecords: number
  pageSize: number
  currentPage: number
  totalPages: number
  executionTime: number
  dataSource: string
  lastUpdated: Date
}

interface ReportVisualizationResult {
  type: string
  chartData: any
  chartOptions: any
  imageUrl?: string
  svgContent?: string
}

interface DashboardDefinition {
  id: string
  name: string
  description?: string
  layout: DashboardLayout
  widgets: DashboardWidget[]
  filters: DashboardFilter[]
  permissions: ReportPermissions
  refreshInterval?: number
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

interface DashboardLayout {
  columns: number
  rows: number
  gap: number
}

interface DashboardWidget {
  id: string
  reportId: string
  position: WidgetPosition
  size: WidgetSize
  title?: string
  refreshInterval?: number
}

interface WidgetPosition {
  x: number
  y: number
}

interface WidgetSize {
  width: number
  height: number
}

interface DashboardFilter {
  field: string
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'text'
  label: string
  options?: ParameterOption[]
  defaultValue?: any
  affectedWidgets: string[]
}

interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'png' | 'svg'
  filename?: string
  includeCharts: boolean
  includeData: boolean
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
  compression?: boolean
}

// Zod schemas
const reportDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['table', 'chart', 'dashboard', 'summary']),
  category: z.enum(['users', 'tests', 'performance', 'analytics', 'system', 'custom']),
  dataSource: z.object({
    type: z.enum(['database', 'api', 'file', 'cache']),
    connection: z.string(),
    query: z.string(),
    parameters: z.record(z.any()).optional(),
  }),
  visualization: z.object({
    type: z.enum(['table', 'line', 'bar', 'pie', 'doughnut', 'area', 'scatter', 'heatmap', 'gauge', 'metric']),
    config: z.record(z.any()),
  }),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'between', 'is_null', 'is_not_null']),
    value: z.any().optional(),
    values: z.array(z.any()).optional(),
    required: z.boolean(),
    defaultValue: z.any().optional(),
  })),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean', 'select', 'multiselect']),
    label: z.string(),
    required: z.boolean(),
    defaultValue: z.any().optional(),
  })),
})

const exportOptionsSchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv', 'json', 'png', 'svg']),
  filename: z.string().optional(),
  includeCharts: z.boolean(),
  includeData: z.boolean(),
  pageSize: z.enum(['A4', 'A3', 'Letter', 'Legal']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  compression: z.boolean().optional(),
})

// Data aggregation utilities
class DataAggregator {
  static groupBy(data: any[], field: string): Record<string, any[]> {
    return data.reduce((groups, item) => {
      const key = item[field]
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    }, {})
  }

  static aggregate(data: any[], field: string, operation: 'sum' | 'avg' | 'count' | 'min' | 'max'): number {
    const values = data.map(item => Number(item[field])).filter(val => !isNaN(val))
    
    switch (operation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0)
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0
      case 'count':
        return values.length
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0
      default:
        return 0
    }
  }

  static pivot(data: any[], rowField: string, columnField: string, valueField: string, aggregation: 'sum' | 'avg' | 'count' = 'sum'): any[] {
    const grouped = this.groupBy(data, rowField)
    const columns = [...new Set(data.map(item => item[columnField]))]
    
    return Object.entries(grouped).map(([rowValue, items]) => {
      const row: any = { [rowField]: rowValue }
      
      for (const column of columns) {
        const columnItems = items.filter(item => item[columnField] === column)
        row[column] = this.aggregate(columnItems, valueField, aggregation)
      }
      
      return row
    })
  }

  static filter(data: any[], filters: ReportFilter[]): any[] {
    return data.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field]
        
        switch (filter.operator) {
          case 'eq':
            return value === filter.value
          case 'ne':
            return value !== filter.value
          case 'gt':
            return value > filter.value
          case 'gte':
            return value >= filter.value
          case 'lt':
            return value < filter.value
          case 'lte':
            return value <= filter.value
          case 'in':
            return filter.values?.includes(value)
          case 'nin':
            return !filter.values?.includes(value)
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'between':
            return value >= filter.values?.[0] && value <= filter.values?.[1]
          case 'is_null':
            return value === null || value === undefined
          case 'is_not_null':
            return value !== null && value !== undefined
          default:
            return true
        }
      })
    })
  }

  static sort(data: any[], field: string, direction: 'asc' | 'desc' = 'asc'): any[] {
    return [...data].sort((a, b) => {
      const aValue = a[field]
      const bValue = b[field]
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1
      if (aValue > bValue) return direction === 'asc' ? 1 : -1
      return 0
    })
  }
}

// Chart generator
class ChartGenerator {
  private config: ChartDefaults

  constructor(config: ChartDefaults) {
    this.config = config
  }

  async generateChart(type: string, data: any[], options: VisualizationConfig): Promise<ReportVisualizationResult> {
    const canvas = createCanvas(this.config.width, this.config.height)
    const ctx = canvas.getContext('2d')

    const chartData = this.prepareChartData(type, data, options)
    const chartOptions = this.prepareChartOptions(type, options)

    new Chart(ctx as any, {
      type: type as any,
      data: chartData,
      options: chartOptions,
    })

    // Generate image
    const imageBuffer = canvas.toBuffer('image/png')
    const imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`

    return {
      type,
      chartData,
      chartOptions,
      imageUrl,
    }
  }

  private prepareChartData(type: string, data: any[], options: VisualizationConfig): any {
    const labels = data.map(item => item[options.xAxis?.field || 'label'])
    
    if (type === 'pie' || type === 'doughnut') {
      return {
        labels,
        datasets: [{
          data: data.map(item => item[options.series?.[0]?.field || 'value']),
          backgroundColor: options.colors || this.getDefaultColors(data.length),
        }]
      }
    }

    const datasets = options.series?.map((series, index) => ({
      label: series.name,
      data: data.map(item => item[series.field]),
      backgroundColor: series.color || options.colors?.[index] || this.getDefaultColors(1)[0],
      borderColor: series.color || options.colors?.[index] || this.getDefaultColors(1)[0],
      fill: type === 'area',
    })) || []

    return { labels, datasets }
  }

  private prepareChartOptions(type: string, options: VisualizationConfig): any {
    return {
      responsive: true,
      plugins: {
        title: {
          display: !!options.title,
          text: options.title,
        },
        legend: {
          display: options.legend?.show !== false,
          position: options.legend?.position || 'top',
        },
      },
      scales: type !== 'pie' && type !== 'doughnut' ? {
        x: {
          title: {
            display: !!options.xAxis?.label,
            text: options.xAxis?.label,
          },
        },
        y: {
          title: {
            display: !!options.yAxis?.label,
            text: options.yAxis?.label,
          },
          min: options.yAxis?.min,
          max: options.yAxis?.max,
        },
      } : undefined,
      ...options.options,
    }
  }

  private getDefaultColors(count: number): string[] {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6B7280'
    ]
    
    const result: string[] = []
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]!)
    }
    return result
  }
}

// Export utilities
class ExportManager {
  async exportToPDF(result: ReportResult, options: ExportOptions): Promise<Buffer> {
    const doc = new PDFDocument({
      size: options.pageSize || 'A4',
      layout: options.orientation || 'portrait',
    })

    const buffers: Buffer[] = []
    doc.on('data', buffers.push.bind(buffers))
    
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })

      doc.on('error', reject)

      // Add title
      doc.fontSize(20).text('Report', { align: 'center' })
      doc.moveDown()

      // Add metadata
      doc.fontSize(12)
      doc.text(`Generated: ${format(result.generatedAt, 'yyyy-MM-dd HH:mm:ss')}`)
      doc.text(`Records: ${result.metadata.totalRecords}`)
      doc.text(`Execution Time: ${result.metadata.executionTime}ms`)
      doc.moveDown()

      // Add chart if available
      if (options.includeCharts && result.visualization?.imageUrl) {
        const [, base64Data] = result.visualization.imageUrl.split(',')
        if (base64Data) {
          const imageBuffer = Buffer.from(base64Data, 'base64')
          doc.image(imageBuffer, { width: 400 })
          doc.moveDown()
        }
      }

      // Add data table
      if (options.includeData && result.data.length > 0) {
        const headers = Object.keys(result.data[0])
        const tableTop = doc.y
        const itemHeight = 20
        const columnWidth = 80

        // Headers
        headers.forEach((header, i) => {
          doc.text(header, 50 + i * columnWidth, tableTop, { width: columnWidth })
        })

        // Data rows
        result.data.slice(0, 50).forEach((row, rowIndex) => {
          const y = tableTop + (rowIndex + 1) * itemHeight
          headers.forEach((header, colIndex) => {
            doc.text(String(row[header] || ''), 50 + colIndex * columnWidth, y, { width: columnWidth })
          })
        })
      }

      doc.end()
    })
  }

  async exportToExcel(result: ReportResult, _options: ExportOptions): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Report')

    if (result.data.length > 0) {
      const headers = Object.keys(result.data[0])
      
      // Add headers
      worksheet.addRow(headers)
      
      // Style headers
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }

      // Add data
      result.data.forEach(row => {
        const values = headers.map(header => row[header])
        worksheet.addRow(values)
      })

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = 15
      })
    }

    return await workbook.xlsx.writeBuffer() as Buffer
  }

  async exportToCSV(result: ReportResult): Promise<string> {
    if (result.data.length === 0) {
      return ''
    }

    const headers = Object.keys(result.data[0])
    const csvRows = [headers.join(',')]

    result.data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : String(value || '')
      })
      csvRows.push(values.join(','))
    })

    return csvRows.join('\n')
  }

  async exportToJSON(result: ReportResult): Promise<string> {
    return JSON.stringify({
      metadata: result.metadata,
      data: result.data,
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      filters: result.filters,
    }, null, 2)
  }
}

// Reporting engine
export class ReportingEngine extends EventEmitter {
  private static instance: ReportingEngine
  private config: ReportingConfig
  private chartGenerator: ChartGenerator
  private exportManager: ExportManager
  private reports: Map<string, ReportDefinition> = new Map()
  private dashboards: Map<string, DashboardDefinition> = new Map()

  private constructor(config: Partial<ReportingConfig> = {}) {
    super()
    this.config = { ...defaultReportingConfig, ...config }
    this.chartGenerator = new ChartGenerator(this.config.chartDefaults)
    this.exportManager = new ExportManager()
  }

  static getInstance(config?: Partial<ReportingConfig>): ReportingEngine {
    if (!ReportingEngine.instance) {
      ReportingEngine.instance = new ReportingEngine(config)
    }
    return ReportingEngine.instance
  }

  // Register report definition
  async registerReport(definition: Omit<ReportDefinition, 'createdAt' | 'updatedAt'>): Promise<void> {
    // Validate definition
    reportDefinitionSchema.parse(definition)

    const report: ReportDefinition = {
      ...definition,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.reports.set(report.id, report)

    await logger.info('Report registered', {
      reportId: report.id,
      name: report.name,
      type: report.type,
      category: report.category,
    })

    this.emit('report:registered', report)
  }

  // Generate report
  async generateReport(
    reportId: string,
    parameters: Record<string, any> = {},
    filters: Record<string, any> = {},
    pagination?: { page: number; size: number }
  ): Promise<ReportResult> {
    const startTime = Date.now()
    
    const report = this.reports.get(reportId)
    if (!report) {
      throw new Error(`Report not found: ${reportId}`)
    }

    // Check cache
    const cacheKey = `report:${reportId}:${JSON.stringify({ parameters, filters, pagination })}`
    if (this.config.enableCaching) {
      const cachedResult = await CacheService.get<ReportResult>(cacheKey)
      if (cachedResult) {
        return cachedResult
      }
    }

    // Execute data source query
    let data = await this.executeDataSource(report.dataSource, parameters)

    // Apply filters
    const reportFilters = report.filters.map(filter => ({
      ...filter,
      value: filters[filter.field] || filter.defaultValue,
    }))
    data = DataAggregator.filter(data, reportFilters)

    // Apply transformations
    if (report.dataSource.transformations) {
      data = await this.applyTransformations(data, report.dataSource.transformations)
    }

    // Apply pagination
    const pageSize = pagination?.size || this.config.defaultPageSize
    const currentPage = pagination?.page || 1
    const totalRecords = data.length
    const totalPages = Math.ceil(totalRecords / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const paginatedData = data.slice(startIndex, startIndex + pageSize)

    // Generate visualization
    let visualization: ReportVisualizationResult | undefined
    if (this.config.enableCharts && report.visualization.type !== 'table') {
      visualization = await this.chartGenerator.generateChart(
        report.visualization.type,
        data,
        report.visualization.config
      )
    }

    const executionTime = Date.now() - startTime

    const result: ReportResult = {
      id: `${reportId}_${Date.now()}`,
      reportId,
      data: paginatedData,
      metadata: {
        totalRecords,
        pageSize,
        currentPage,
        totalPages,
        executionTime,
        dataSource: report.dataSource.type,
        lastUpdated: new Date(),
      },
      ...(visualization && { visualization }),
      generatedAt: new Date(),
      parameters,
      filters,
    }

    // Cache result
    if (this.config.enableCaching) {
      await CacheService.set(cacheKey, result, this.config.cacheTimeout)
    }

    await logger.info('Report generated', {
      reportId,
      executionTime,
      totalRecords,
      currentPage,
    })

    this.emit('report:generated', result)
    return result
  }

  // Execute data source
  private async executeDataSource(dataSource: ReportDataSource, parameters: Record<string, any>): Promise<any[]> {
    switch (dataSource.type) {
      case 'database':
        // Implement database query execution
        // This would typically use Prisma or another ORM
        throw new Error('Database data source not implemented')
      
      case 'api':
        // Implement API call
        const response = await fetch(dataSource.connection, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: dataSource.query, parameters }),
        })
        return await response.json()
      
      case 'cache':
        // Get data from cache
        const cachedData = await CacheService.get<any[]>(dataSource.connection)
        return cachedData || []
      
      case 'file':
        // Implement file reading
        throw new Error('File data source not implemented')
      
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`)
    }
  }

  // Apply data transformations
  private async applyTransformations(data: any[], transformations: DataTransformation[]): Promise<any[]> {
    let result = data

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'filter':
          result = DataAggregator.filter(result, transformation.config.filters)
          break
        
        case 'sort':
          result = DataAggregator.sort(result, transformation.config.field, transformation.config.direction)
          break
        
        case 'group':
          result = Object.values(DataAggregator.groupBy(result, transformation.config.field))
            .map(group => ({
              [transformation.config.field]: group[0][transformation.config.field],
              count: group.length,
              ...transformation.config.aggregations?.reduce((acc: any, agg: any) => {
                acc[agg.field] = DataAggregator.aggregate(group, agg.field, agg.operation)
                return acc
              }, {})
            }))
          break
        
        case 'aggregate':
          const aggregated = DataAggregator.aggregate(result, transformation.config.field, transformation.config.operation)
          result = [{ [transformation.config.field]: aggregated }]
          break
        
        case 'calculate':
          result = result.map(item => ({
            ...item,
            [transformation.config.field]: this.evaluateExpression(transformation.config.expression, item)
          }))
          break
      }
    }

    return result
  }

  // Evaluate expression for calculated fields
  private evaluateExpression(expression: string, context: Record<string, any>): any {
    try {
      // Simple expression evaluator - only supports basic field access
      // For security, we only allow simple field access like 'field' or 'field.subfield'
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(expression)) {
        logger.warn('Invalid expression format', { expression })
        return null
      }
      
      const parts = expression.split('.')
      let result = context
      for (const part of parts) {
        if (result && typeof result === 'object' && part in result) {
          result = result[part]
        } else {
          return null
        }
      }
      return result
    } catch (error) {
      logger.warn('Failed to evaluate expression', { expression, error })
      return null
    }
  }

  // Export report
  async exportReport(reportId: string, options: ExportOptions, parameters?: Record<string, any>): Promise<Buffer | string> {
    // Validate options
    exportOptionsSchema.parse(options)

    const result = await this.generateReport(reportId, parameters)

    switch (options.format) {
      case 'pdf':
        return await this.exportManager.exportToPDF(result, options)
      case 'excel':
        return await this.exportManager.exportToExcel(result, options)
      case 'csv':
        return await this.exportManager.exportToCSV(result)
      case 'json':
        return await this.exportManager.exportToJSON(result)
      case 'png':
        if (result.visualization?.imageUrl) {
          const [, base64Data] = result.visualization.imageUrl.split(',')
          if (base64Data) {
            return Buffer.from(base64Data, 'base64')
          }
        }
        throw new Error('No chart available for PNG export')
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  // Get report definition
  getReport(reportId: string): ReportDefinition | null {
    return this.reports.get(reportId) || null
  }

  // List reports
  listReports(category?: string): ReportDefinition[] {
    const reports = Array.from(this.reports.values())
    return category ? reports.filter(r => r.category === category) : reports
  }

  // Register dashboard
  async registerDashboard(definition: Omit<DashboardDefinition, 'createdAt' | 'updatedAt'>): Promise<void> {
    const dashboard: DashboardDefinition = {
      ...definition,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.dashboards.set(dashboard.id, dashboard)

    await logger.info('Dashboard registered', {
      dashboardId: dashboard.id,
      name: dashboard.name,
      widgetCount: dashboard.widgets.length,
    })

    this.emit('dashboard:registered', dashboard)
  }

  // Get dashboard
  getDashboard(dashboardId: string): DashboardDefinition | null {
    return this.dashboards.get(dashboardId) || null
  }

  // List dashboards
  listDashboards(): DashboardDefinition[] {
    return Array.from(this.dashboards.values())
  }
}

// Predefined reports
export const PredefinedReports = {
  USER_STATISTICS: {
    id: 'user_statistics',
    name: 'User Statistics',
    description: 'Overview of user registrations and activity',
    type: 'chart' as const,
    category: 'users' as const,
    dataSource: {
      type: 'database' as const,
      connection: 'main',
      query: 'SELECT DATE(createdAt) as date, COUNT(*) as count FROM users GROUP BY DATE(createdAt) ORDER BY date',
    },
    visualization: {
      type: 'line' as const,
      config: {
        title: 'User Registrations Over Time',
        xAxis: { label: 'Date', field: 'date', type: 'datetime' as const },
        yAxis: { label: 'Users', field: 'count', type: 'numeric' as const },
        series: [{ name: 'Registrations', field: 'count' }],
      },
    },
    filters: [],
    parameters: [],
    permissions: {
      view: ['admin', 'manager'],
      edit: ['admin'],
      delete: ['admin'],
      export: ['admin', 'manager'],
      schedule: ['admin'],
    },
  },
  
  TEST_PERFORMANCE: {
    id: 'test_performance',
    name: 'Test Performance',
    description: 'Analysis of test scores and completion rates',
    type: 'dashboard' as const,
    category: 'tests' as const,
    dataSource: {
      type: 'database' as const,
      connection: 'main',
      query: 'SELECT t.title, AVG(ts.score) as avg_score, COUNT(ts.id) as attempts FROM tests t LEFT JOIN test_sessions ts ON t.id = ts.testId GROUP BY t.id, t.title',
    },
    visualization: {
      type: 'bar' as const,
      config: {
        title: 'Average Test Scores',
        xAxis: { label: 'Test', field: 'title', type: 'category' as const },
        yAxis: { label: 'Average Score', field: 'avg_score', type: 'numeric' as const },
        series: [{ name: 'Average Score', field: 'avg_score' }],
      },
    },
    filters: [
      {
        field: 'createdAt',
        operator: 'between' as const,
        required: false,
        defaultValue: [subDays(new Date(), 30), new Date()],
      },
    ],
    parameters: [
      {
        name: 'dateRange',
        type: 'date' as const,
        label: 'Date Range',
        required: false,
        defaultValue: subDays(new Date(), 30),
      },
    ],
    permissions: {
      view: ['admin', 'teacher'],
      edit: ['admin'],
      delete: ['admin'],
      export: ['admin', 'teacher'],
      schedule: ['admin'],
    },
  },
} as const

// Export singleton instance
export const reportingEngine = ReportingEngine.getInstance()

export default reportingEngine
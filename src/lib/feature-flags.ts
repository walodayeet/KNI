import { logger } from './logger'
import { CacheService } from './cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// Feature flag configuration
interface FeatureFlagConfig {
  provider: 'database' | 'redis' | 'file' | 'remote'
  caching: {
    enabled: boolean
    ttl: number
    keyPrefix: string
  }
  evaluation: {
    defaultValue: boolean
    enableLogging: boolean
    enableMetrics: boolean
  }
  rollout: {
    enableGradual: boolean
    enableTargeting: boolean
    enableABTesting: boolean
  }
  remote: {
    endpoint?: string
    apiKey?: string
    timeout: number
    retries: number
  }
}

const defaultConfig: FeatureFlagConfig = {
  provider: (process.env.FEATURE_FLAG_PROVIDER as any) || 'database',
  caching: {
    enabled: process.env.FEATURE_FLAG_CACHING !== 'false',
    ttl: parseInt(process.env.FEATURE_FLAG_CACHE_TTL || '300'), // 5 minutes
    keyPrefix: process.env.FEATURE_FLAG_CACHE_PREFIX || 'ff:',
  },
  evaluation: {
    defaultValue: process.env.FEATURE_FLAG_DEFAULT_VALUE === 'true',
    enableLogging: process.env.FEATURE_FLAG_LOGGING !== 'false',
    enableMetrics: process.env.FEATURE_FLAG_METRICS !== 'false',
  },
  rollout: {
    enableGradual: process.env.FEATURE_FLAG_GRADUAL_ROLLOUT !== 'false',
    enableTargeting: process.env.FEATURE_FLAG_TARGETING !== 'false',
    enableABTesting: process.env.FEATURE_FLAG_AB_TESTING !== 'false',
  },
  remote: {
    endpoint: process.env.FEATURE_FLAG_REMOTE_ENDPOINT,
    apiKey: process.env.FEATURE_FLAG_REMOTE_API_KEY,
    timeout: parseInt(process.env.FEATURE_FLAG_REMOTE_TIMEOUT || '5000'),
    retries: parseInt(process.env.FEATURE_FLAG_REMOTE_RETRIES || '3'),
  },
}

// Feature flag types
export type FeatureFlagType = 'boolean' | 'string' | 'number' | 'json'
export type RolloutStrategy = 'percentage' | 'user_id' | 'email' | 'custom'
export type TargetingOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'regex'

// Interfaces
export interface FeatureFlag {
  id: string
  name: string
  description?: string
  type: FeatureFlagType
  enabled: boolean
  defaultValue: any
  rollout?: RolloutConfig
  targeting?: TargetingRule[]
  variants?: VariantConfig[]
  environment: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  createdBy: string
  lastModifiedBy: string
}

export interface RolloutConfig {
  strategy: RolloutStrategy
  percentage?: number
  userIds?: string[]
  emails?: string[]
  customRules?: CustomRule[]
  gradual?: GradualRollout
}

export interface TargetingRule {
  id: string
  attribute: string
  operator: TargetingOperator
  value: any
  enabled: boolean
}

export interface VariantConfig {
  id: string
  name: string
  value: any
  weight: number
  enabled: boolean
}

export interface CustomRule {
  id: string
  name: string
  condition: string // JavaScript expression
  enabled: boolean
}

export interface GradualRollout {
  enabled: boolean
  startPercentage: number
  endPercentage: number
  incrementPercentage: number
  incrementInterval: number // minutes
  startDate: Date
  endDate?: Date
}

export interface EvaluationContext {
  userId?: string
  email?: string
  userAgent?: string
  ipAddress?: string
  country?: string
  region?: string
  city?: string
  device?: string
  browser?: string
  os?: string
  customAttributes?: Record<string, any>
  timestamp: Date
}

export interface EvaluationResult {
  flagId: string
  value: any
  variant?: string
  reason: string
  ruleId?: string
  timestamp: Date
  context: EvaluationContext
}

export interface FeatureFlagMetrics {
  flagId: string
  evaluations: number
  uniqueUsers: number
  variantDistribution: Record<string, number>
  conversionRate?: number
  lastEvaluated: Date
}

// Validation schemas
const featureFlagSchemas = {
  flagId: z.string().min(1, 'Flag ID is required'),
  
  featureFlag: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(['boolean', 'string', 'number', 'json']),
    enabled: z.boolean(),
    defaultValue: z.any(),
    rollout: z.object({
      strategy: z.enum(['percentage', 'user_id', 'email', 'custom']),
      percentage: z.number().min(0).max(100).optional(),
      userIds: z.array(z.string()).optional(),
      emails: z.array(z.string().email()).optional(),
      customRules: z.array(z.object({
        id: z.string(),
        name: z.string(),
        condition: z.string(),
        enabled: z.boolean(),
      })).optional(),
    }).optional(),
    targeting: z.array(z.object({
      id: z.string(),
      attribute: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in', 'greater_than', 'less_than', 'regex']),
      value: z.any(),
      enabled: z.boolean(),
    })).optional(),
    variants: z.array(z.object({
      id: z.string(),
      name: z.string(),
      value: z.any(),
      weight: z.number().min(0).max(100),
      enabled: z.boolean(),
    })).optional(),
    environment: z.string(),
    tags: z.array(z.string()),
  }),
  
  evaluationContext: z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    device: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    customAttributes: z.record(z.any()).optional(),
    timestamp: z.date(),
  }),
}

// Feature flag provider interface
export interface FeatureFlagProvider {
  getFlag(flagId: string): Promise<FeatureFlag | null>
  getAllFlags(): Promise<FeatureFlag[]>
  createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag>
  updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null>
  deleteFlag(flagId: string): Promise<boolean>
  getFlagsByEnvironment(environment: string): Promise<FeatureFlag[]>
  getFlagsByTags(tags: string[]): Promise<FeatureFlag[]>
}

// Database provider implementation
export class DatabaseFeatureFlagProvider implements FeatureFlagProvider {
  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    try {
      // Implement database query
      // This is a placeholder - implement with your database
      return null
    } catch (error) {
      await logger.error('Failed to get feature flag from database', {
        flagId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    try {
      // Implement database query
      return []
    } catch (error) {
      await logger.error('Failed to get all feature flags from database', {
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    try {
      const now = new Date()
      const newFlag: FeatureFlag = {
        ...flag,
        createdAt: now,
        updatedAt: now,
      }
      
      // Implement database insert
      return newFlag
    } catch (error) {
      await logger.error('Failed to create feature flag in database', {
        flag,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    try {
      // Implement database update
      return null
    } catch (error) {
      await logger.error('Failed to update feature flag in database', {
        flagId,
        updates,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async deleteFlag(flagId: string): Promise<boolean> {
    try {
      // Implement database delete
      return false
    } catch (error) {
      await logger.error('Failed to delete feature flag from database', {
        flagId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  async getFlagsByEnvironment(environment: string): Promise<FeatureFlag[]> {
    try {
      // Implement database query with environment filter
      return []
    } catch (error) {
      await logger.error('Failed to get feature flags by environment from database', {
        environment,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  async getFlagsByTags(tags: string[]): Promise<FeatureFlag[]> {
    try {
      // Implement database query with tags filter
      return []
    } catch (error) {
      await logger.error('Failed to get feature flags by tags from database', {
        tags,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }
}

// File provider implementation
export class FileFeatureFlagProvider implements FeatureFlagProvider {
  private flags: Map<string, FeatureFlag> = new Map()
  private filePath: string

  constructor(filePath: string = './feature-flags.json') {
    this.filePath = filePath
    this.loadFlags()
  }

  private async loadFlags(): Promise<void> {
    try {
      // In a real implementation, load from file system
      // For now, use sample flags
      const sampleFlags = this.getSampleFlags()
      sampleFlags.forEach(flag => this.flags.set(flag.id, flag))
    } catch (error) {
      await logger.error('Failed to load feature flags from file', {
        filePath: this.filePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private getSampleFlags(): FeatureFlag[] {
    const now = new Date()
    return [
      {
        id: 'new-dashboard',
        name: 'New Dashboard',
        description: 'Enable the new dashboard design',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        rollout: {
          strategy: 'percentage',
          percentage: 50,
        },
        environment: 'production',
        tags: ['ui', 'dashboard'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        lastModifiedBy: 'system',
      },
      {
        id: 'ai-recommendations',
        name: 'AI Recommendations',
        description: 'Enable AI-powered test recommendations',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        targeting: [
          {
            id: 'premium-users',
            attribute: 'subscription',
            operator: 'equals',
            value: 'premium',
            enabled: true,
          },
        ],
        environment: 'production',
        tags: ['ai', 'recommendations'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        lastModifiedBy: 'system',
      },
      {
        id: 'test-timer-variant',
        name: 'Test Timer Variant',
        description: 'A/B test for different timer displays',
        type: 'string',
        enabled: true,
        defaultValue: 'classic',
        variants: [
          {
            id: 'classic',
            name: 'Classic Timer',
            value: 'classic',
            weight: 50,
            enabled: true,
          },
          {
            id: 'modern',
            name: 'Modern Timer',
            value: 'modern',
            weight: 50,
            enabled: true,
          },
        ],
        environment: 'production',
        tags: ['ui', 'timer', 'ab-test'],
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        lastModifiedBy: 'system',
      },
    ]
  }

  async getFlag(flagId: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagId) || null
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values())
  }

  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const now = new Date()
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now,
    }
    
    this.flags.set(newFlag.id, newFlag)
    await this.saveFlags()
    
    return newFlag
  }

  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    const existingFlag = this.flags.get(flagId)
    if (!existingFlag) return null
    
    const updatedFlag: FeatureFlag = {
      ...existingFlag,
      ...updates,
      updatedAt: new Date(),
    }
    
    this.flags.set(flagId, updatedFlag)
    await this.saveFlags()
    
    return updatedFlag
  }

  async deleteFlag(flagId: string): Promise<boolean> {
    const deleted = this.flags.delete(flagId)
    if (deleted) {
      await this.saveFlags()
    }
    return deleted
  }

  async getFlagsByEnvironment(environment: string): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values()).filter(flag => flag.environment === environment)
  }

  async getFlagsByTags(tags: string[]): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values()).filter(flag => 
      tags.some(tag => flag.tags.includes(tag))
    )
  }

  private async saveFlags(): Promise<void> {
    try {
      // In a real implementation, save to file system
      await logger.info('Feature flags saved to file', {
        filePath: this.filePath,
        count: this.flags.size,
      })
    } catch (error) {
      await logger.error('Failed to save feature flags to file', {
        filePath: this.filePath,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

// Feature flag evaluator
export class FeatureFlagEvaluator {
  private config: FeatureFlagConfig

  constructor(config: FeatureFlagConfig) {
    this.config = config
  }

  // Evaluate feature flag
  async evaluate(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    const startTime = Date.now()
    
    try {
      // Check if flag is enabled
      if (!flag.enabled) {
        return this.createResult(flag, flag.defaultValue, 'flag_disabled', context)
      }

      // Check targeting rules
      const targetingResult = await this.evaluateTargeting(flag, context)
      if (targetingResult !== null) {
        return this.createResult(flag, targetingResult.value, targetingResult.reason, context, targetingResult.ruleId)
      }

      // Check rollout rules
      const rolloutResult = await this.evaluateRollout(flag, context)
      if (rolloutResult !== null) {
        return this.createResult(flag, rolloutResult.value, rolloutResult.reason, context)
      }

      // Check variants (A/B testing)
      const variantResult = await this.evaluateVariants(flag, context)
      if (variantResult !== null) {
        return this.createResult(flag, variantResult.value, variantResult.reason, context, undefined, variantResult.variant)
      }

      // Return default value
      return this.createResult(flag, flag.defaultValue, 'default_value', context)
    } catch (error) {
      await logger.error('Failed to evaluate feature flag', {
        flagId: flag.id,
        context,
        error: error instanceof Error ? error.message : String(error),
      })
      
      return this.createResult(flag, flag.defaultValue, 'evaluation_error', context)
    } finally {
      if (this.config.evaluation.enableMetrics) {
        const duration = Date.now() - startTime
        await logger.info('Feature flag evaluated', {
          flagId: flag.id,
          duration,
          userId: context.userId,
        })
      }
    }
  }

  // Evaluate targeting rules
  private async evaluateTargeting(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<{ value: any; reason: string; ruleId: string } | null> {
    if (!flag.targeting || flag.targeting.length === 0) {
      return null
    }

    for (const rule of flag.targeting) {
      if (!rule.enabled) continue

      const matches = await this.evaluateTargetingRule(rule, context)
      if (matches) {
        return {
          value: true, // Targeting rules typically enable the flag
          reason: 'targeting_rule_match',
          ruleId: rule.id,
        }
      }
    }

    return null
  }

  // Evaluate single targeting rule
  private async evaluateTargetingRule(
    rule: TargetingRule,
    context: EvaluationContext
  ): Promise<boolean> {
    const contextValue = this.getContextValue(context, rule.attribute)
    if (contextValue === undefined) return false

    switch (rule.operator) {
      case 'equals':
        return contextValue === rule.value
      case 'not_equals':
        return contextValue !== rule.value
      case 'contains':
        return String(contextValue).includes(String(rule.value))
      case 'not_contains':
        return !String(contextValue).includes(String(rule.value))
      case 'in':
        return Array.isArray(rule.value) && rule.value.includes(contextValue)
      case 'not_in':
        return Array.isArray(rule.value) && !rule.value.includes(contextValue)
      case 'greater_than':
        return Number(contextValue) > Number(rule.value)
      case 'less_than':
        return Number(contextValue) < Number(rule.value)
      case 'regex':
        try {
          const regex = new RegExp(rule.value)
          return regex.test(String(contextValue))
        } catch {
          return false
        }
      default:
        return false
    }
  }

  // Get value from context
  private getContextValue(context: EvaluationContext, attribute: string): any {
    const standardAttributes: Record<string, any> = {
      userId: context.userId,
      email: context.email,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      country: context.country,
      region: context.region,
      city: context.city,
      device: context.device,
      browser: context.browser,
      os: context.os,
    }

    if (attribute in standardAttributes) {
      return standardAttributes[attribute]
    }

    return context.customAttributes?.[attribute]
  }

  // Evaluate rollout rules
  private async evaluateRollout(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<{ value: any; reason: string } | null> {
    if (!flag.rollout) return null

    const { strategy } = flag.rollout

    switch (strategy) {
      case 'percentage':
        return this.evaluatePercentageRollout(flag.rollout, context)
      case 'user_id':
        return this.evaluateUserIdRollout(flag.rollout, context)
      case 'email':
        return this.evaluateEmailRollout(flag.rollout, context)
      case 'custom':
        return this.evaluateCustomRollout(flag.rollout, context)
      default:
        return null
    }
  }

  // Evaluate percentage rollout
  private evaluatePercentageRollout(
    rollout: RolloutConfig,
    context: EvaluationContext
  ): { value: any; reason: string } | null {
    if (rollout.percentage === undefined) return null

    // Use consistent hashing based on user ID or IP
    const identifier = context.userId || context.ipAddress || 'anonymous'
    const hash = this.hashString(identifier)
    const percentage = hash % 100

    const isIncluded = percentage < rollout.percentage
    return {
      value: isIncluded,
      reason: `percentage_rollout_${isIncluded ? 'included' : 'excluded'}`,
    }
  }

  // Evaluate user ID rollout
  private evaluateUserIdRollout(
    rollout: RolloutConfig,
    context: EvaluationContext
  ): { value: any; reason: string } | null {
    if (!rollout.userIds || !context.userId) return null

    const isIncluded = rollout.userIds.includes(context.userId)
    return {
      value: isIncluded,
      reason: `user_id_rollout_${isIncluded ? 'included' : 'excluded'}`,
    }
  }

  // Evaluate email rollout
  private evaluateEmailRollout(
    rollout: RolloutConfig,
    context: EvaluationContext
  ): { value: any; reason: string } | null {
    if (!rollout.emails || !context.email) return null

    const isIncluded = rollout.emails.includes(context.email)
    return {
      value: isIncluded,
      reason: `email_rollout_${isIncluded ? 'included' : 'excluded'}`,
    }
  }

  // Evaluate custom rollout
  private evaluateCustomRollout(
    rollout: RolloutConfig,
    context: EvaluationContext
  ): { value: any; reason: string } | null {
    if (!rollout.customRules) return null

    for (const rule of rollout.customRules) {
      if (!rule.enabled) continue

      try {
        // In a real implementation, you would safely evaluate the condition
        // This is a simplified example - use a proper expression evaluator
        const isMatch = this.evaluateCustomCondition(rule.condition, context)
        if (isMatch) {
          return {
            value: true,
            reason: `custom_rule_match_${rule.id}`,
          }
        }
      } catch (error) {
        await logger.error('Failed to evaluate custom rollout rule', {
          ruleId: rule.id,
          condition: rule.condition,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return null
  }

  // Evaluate custom condition (simplified)
  private evaluateCustomCondition(condition: string, context: EvaluationContext): boolean {
    // This is a simplified implementation
    // In production, use a proper expression evaluator like JSONLogic
    try {
      // Replace context variables in condition
      let evaluatedCondition = condition
      
      // Replace common variables
      evaluatedCondition = evaluatedCondition.replace(/\$userId/g, `"${context.userId || ''}"`)
      evaluatedCondition = evaluatedCondition.replace(/\$email/g, `"${context.email || ''}"`)
      evaluatedCondition = evaluatedCondition.replace(/\$country/g, `"${context.country || ''}"`)
      
      // WARNING: eval is dangerous - use a proper expression evaluator in production
      // return eval(evaluatedCondition)
      return false // Disabled for security
    } catch {
      return false
    }
  }

  // Evaluate variants (A/B testing)
  private async evaluateVariants(
    flag: FeatureFlag,
    context: EvaluationContext
  ): Promise<{ value: any; reason: string; variant: string } | null> {
    if (!flag.variants || flag.variants.length === 0) return null

    const enabledVariants = flag.variants.filter(v => v.enabled)
    if (enabledVariants.length === 0) return null

    // Calculate total weight
    const totalWeight = enabledVariants.reduce((sum, variant) => sum + variant.weight, 0)
    if (totalWeight === 0) return null

    // Use consistent hashing for variant selection
    const identifier = context.userId || context.ipAddress || 'anonymous'
    const hash = this.hashString(`${flag.id}:${identifier}`)
    const randomValue = (hash % 10000) / 100 // 0-99.99

    // Select variant based on weight
    let currentWeight = 0
    for (const variant of enabledVariants) {
      currentWeight += (variant.weight / totalWeight) * 100
      if (randomValue < currentWeight) {
        return {
          value: variant.value,
          reason: 'variant_selected',
          variant: variant.id,
        }
      }
    }

    // Fallback to first variant
    const firstVariant = enabledVariants[0]
    return {
      value: firstVariant.value,
      reason: 'variant_fallback',
      variant: firstVariant.id,
    }
  }

  // Create evaluation result
  private createResult(
    flag: FeatureFlag,
    value: any,
    reason: string,
    context: EvaluationContext,
    ruleId?: string,
    variant?: string
  ): EvaluationResult {
    return {
      flagId: flag.id,
      value,
      variant,
      reason,
      ruleId,
      timestamp: new Date(),
      context,
    }
  }

  // Simple hash function
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

// Feature flag manager
export class FeatureFlagManager {
  private static instance: FeatureFlagManager
  private config: FeatureFlagConfig
  private provider: FeatureFlagProvider
  private evaluator: FeatureFlagEvaluator
  private metrics: Map<string, FeatureFlagMetrics> = new Map()

  private constructor(config: Partial<FeatureFlagConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.provider = this.createProvider()
    this.evaluator = new FeatureFlagEvaluator(this.config)
  }

  public static getInstance(config?: Partial<FeatureFlagConfig>): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager(config)
    }
    return FeatureFlagManager.instance
  }

  // Create provider based on configuration
  private createProvider(): FeatureFlagProvider {
    switch (this.config.provider) {
      case 'database':
        return new DatabaseFeatureFlagProvider()
      case 'file':
        return new FileFeatureFlagProvider()
      default:
        return new FileFeatureFlagProvider()
    }
  }

  // Get feature flag value
  async isEnabled(
    flagId: string,
    context: Partial<EvaluationContext> = {},
    defaultValue?: boolean
  ): Promise<boolean> {
    const result = await this.evaluate(flagId, context, defaultValue)
    return Boolean(result)
  }

  // Get feature flag value with type
  async getValue<T = any>(
    flagId: string,
    context: Partial<EvaluationContext> = {},
    defaultValue?: T
  ): Promise<T> {
    const result = await this.evaluate(flagId, context, defaultValue)
    return result as T
  }

  // Evaluate feature flag
  async evaluate(
    flagId: string,
    context: Partial<EvaluationContext> = {},
    defaultValue?: any
  ): Promise<any> {
    try {
      // Validate flag ID
      featureFlagSchemas.flagId.parse(flagId)

      // Get flag from cache or provider
      const flag = await this.getFlag(flagId)
      if (!flag) {
        if (this.config.evaluation.enableLogging) {
          await logger.warn('Feature flag not found', { flagId })
        }
        return defaultValue ?? this.config.evaluation.defaultValue
      }

      // Create full evaluation context
      const fullContext: EvaluationContext = {
        timestamp: new Date(),
        ...context,
      }

      // Evaluate flag
      const result = await this.evaluator.evaluate(flag, fullContext)

      // Log evaluation
      if (this.config.evaluation.enableLogging) {
        await logger.info('Feature flag evaluated', {
          flagId,
          value: result.value,
          reason: result.reason,
          variant: result.variant,
          userId: context.userId,
        })
      }

      // Update metrics
      if (this.config.evaluation.enableMetrics) {
        await this.updateMetrics(result)
      }

      return result.value
    } catch (error) {
      await logger.error('Failed to evaluate feature flag', {
        flagId,
        context,
        error: error instanceof Error ? error.message : String(error),
      })
      
      return defaultValue ?? this.config.evaluation.defaultValue
    }
  }

  // Get feature flag
  private async getFlag(flagId: string): Promise<FeatureFlag | null> {
    const cacheKey = `${this.config.caching.keyPrefix}${flagId}`
    
    // Try cache first
    if (this.config.caching.enabled) {
      const cached = await CacheService.get<FeatureFlag>(cacheKey)
      if (cached) {
        return cached
      }
    }

    // Get from provider
    const flag = await this.provider.getFlag(flagId)
    if (!flag) return null

    // Cache the flag
    if (this.config.caching.enabled) {
      await CacheService.set(cacheKey, flag, this.config.caching.ttl)
    }

    return flag
  }

  // Update metrics
  private async updateMetrics(result: EvaluationResult): Promise<void> {
    try {
      const existing = this.metrics.get(result.flagId) || {
        flagId: result.flagId,
        evaluations: 0,
        uniqueUsers: 0,
        variantDistribution: {},
        lastEvaluated: new Date(),
      }

      existing.evaluations++
      existing.lastEvaluated = result.timestamp

      if (result.variant) {
        existing.variantDistribution[result.variant] = 
          (existing.variantDistribution[result.variant] || 0) + 1
      }

      this.metrics.set(result.flagId, existing)

      // Periodically flush metrics to storage
      // This could be done in a background job
    } catch (error) {
      await logger.error('Failed to update feature flag metrics', {
        flagId: result.flagId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Get all flags
  async getAllFlags(): Promise<FeatureFlag[]> {
    return this.provider.getAllFlags()
  }

  // Create flag
  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    // Validate flag
    featureFlagSchemas.featureFlag.parse({
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const newFlag = await this.provider.createFlag(flag)
    
    // Clear cache
    if (this.config.caching.enabled) {
      const cacheKey = `${this.config.caching.keyPrefix}${newFlag.id}`
      await CacheService.delete(cacheKey)
    }

    return newFlag
  }

  // Update flag
  async updateFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
    const updatedFlag = await this.provider.updateFlag(flagId, updates)
    
    // Clear cache
    if (this.config.caching.enabled) {
      const cacheKey = `${this.config.caching.keyPrefix}${flagId}`
      await CacheService.delete(cacheKey)
    }

    return updatedFlag
  }

  // Delete flag
  async deleteFlag(flagId: string): Promise<boolean> {
    const deleted = await this.provider.deleteFlag(flagId)
    
    // Clear cache
    if (this.config.caching.enabled) {
      const cacheKey = `${this.config.caching.keyPrefix}${flagId}`
      await CacheService.delete(cacheKey)
    }

    return deleted
  }

  // Get metrics
  getMetrics(flagId?: string): FeatureFlagMetrics | FeatureFlagMetrics[] {
    if (flagId) {
      return this.metrics.get(flagId) || {
        flagId,
        evaluations: 0,
        uniqueUsers: 0,
        variantDistribution: {},
        lastEvaluated: new Date(),
      }
    }
    
    return Array.from(this.metrics.values())
  }

  // Clear cache
  async clearCache(flagId?: string): Promise<void> {
    if (flagId) {
      const cacheKey = `${this.config.caching.keyPrefix}${flagId}`
      await CacheService.delete(cacheKey)
    } else {
      // Clear all feature flag cache
      // await CacheService.deletePattern(`${this.config.caching.keyPrefix}*`)
    }
  }
}

// Utility functions
export function createEvaluationContext(
  request?: NextRequest,
  additionalContext?: Partial<EvaluationContext>
): EvaluationContext {
  const context: EvaluationContext = {
    timestamp: new Date(),
    ...additionalContext,
  }

  if (request) {
    context.userAgent = request.headers.get('user-agent') || undefined
    context.ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined
    
    // Parse user agent for device/browser info
    if (context.userAgent) {
      // Simple user agent parsing - use a proper library in production
      context.browser = context.userAgent.includes('Chrome') ? 'Chrome' : 
                       context.userAgent.includes('Firefox') ? 'Firefox' : 
                       context.userAgent.includes('Safari') ? 'Safari' : 'Unknown'
      
      context.device = context.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
      
      context.os = context.userAgent.includes('Windows') ? 'Windows' :
                   context.userAgent.includes('Mac') ? 'macOS' :
                   context.userAgent.includes('Linux') ? 'Linux' : 'Unknown'
    }
  }

  return context
}

export async function getServerFeatureFlag(
  flagId: string,
  context?: Partial<EvaluationContext>,
  defaultValue?: any
): Promise<any> {
  const manager = FeatureFlagManager.getInstance()
  return manager.evaluate(flagId, context, defaultValue)
}

// React hook for client-side usage
export function useFeatureFlag(flagId: string, defaultValue?: any) {
  // This would be implemented as a React hook
  // For now, return a placeholder
  return {
    isEnabled: false,
    value: defaultValue,
    loading: false,
    error: null,
  }
}

// Export singleton instance
export const featureFlagManager = FeatureFlagManager.getInstance()

// Export configuration
export { defaultConfig as featureFlagConfig }

// Export default
export default FeatureFlagManager
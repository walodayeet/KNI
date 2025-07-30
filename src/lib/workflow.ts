import { z } from 'zod'
import { logger } from './logger'
import { CacheService } from './cache'
import { QueueManager } from './queue'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

// Workflow configuration
interface WorkflowConfig {
  enablePersistence: boolean
  enableMetrics: boolean
  enableLogging: boolean
  maxConcurrentWorkflows: number
  defaultTimeout: number
  retryAttempts: number
  retryDelay: number
}

const defaultWorkflowConfig: WorkflowConfig = {
  enablePersistence: process.env.WORKFLOW_ENABLE_PERSISTENCE === 'true',
  enableMetrics: true,
  enableLogging: process.env.NODE_ENV !== 'production',
  maxConcurrentWorkflows: parseInt(process.env.WORKFLOW_MAX_CONCURRENT || '100'),
  defaultTimeout: parseInt(process.env.WORKFLOW_DEFAULT_TIMEOUT || '300000'), // 5 minutes
  retryAttempts: parseInt(process.env.WORKFLOW_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.WORKFLOW_RETRY_DELAY || '5000'), // 5 seconds
}

// Workflow interfaces
interface WorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'parallel' | 'sequential' | 'delay' | 'webhook' | 'email' | 'notification'
  config: Record<string, any>
  nextSteps?: string[]
  errorSteps?: string[]
  timeout?: number
  retryAttempts?: number
  condition?: string // JavaScript expression for conditional steps
}

interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  version: string
  trigger: WorkflowTrigger
  steps: WorkflowStep[]
  variables?: Record<string, any>
  timeout?: number
  tags?: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}

interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'event' | 'webhook' | 'api'
  config: Record<string, any>
  condition?: string
}

interface WorkflowInstance {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
  currentStep?: string
  context: Record<string, any>
  variables: Record<string, any>
  startedAt: Date
  completedAt?: Date
  error?: string
  executionLog: WorkflowExecutionLog[]
  triggeredBy?: string
  metadata?: Record<string, any>
}

interface WorkflowExecutionLog {
  stepId: string
  stepName: string
  status: 'started' | 'completed' | 'failed' | 'skipped'
  startedAt: Date
  completedAt?: Date
  input?: any
  output?: any
  error?: string
  duration?: number
}

interface WorkflowMetrics {
  totalWorkflows: number
  activeWorkflows: number
  completedWorkflows: number
  failedWorkflows: number
  averageExecutionTime: number
  successRate: number
  stepMetrics: Map<string, StepMetrics>
}

interface StepMetrics {
  stepId: string
  stepName: string
  executionCount: number
  successCount: number
  failureCount: number
  averageExecutionTime: number
  lastExecuted?: Date
}

// Zod schemas
const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['action', 'condition', 'parallel', 'sequential', 'delay', 'webhook', 'email', 'notification']),
  config: z.record(z.any()),
  nextSteps: z.array(z.string()).optional(),
  errorSteps: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  retryAttempts: z.number().optional(),
  condition: z.string().optional(),
})

const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'event', 'webhook', 'api']),
  config: z.record(z.any()),
  condition: z.string().optional(),
})

const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema),
  variables: z.record(z.any()).optional(),
  timeout: z.number().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean(),
  createdBy: z.string().optional(),
})

// Step executors
abstract class StepExecutor {
  abstract execute(step: WorkflowStep, context: Record<string, any>): Promise<any>
  
  protected evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      // Simple expression evaluator (in production, use a proper expression engine)
      const func = new Function('context', `with(context) { return ${condition}; }`)
      return Boolean(func(context))
    } catch (error) {
      logger.warn('Failed to evaluate condition', { condition, error })
      return false
    }
  }
}

class ActionStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { action, params } = step.config
    
    switch (action) {
      case 'log':
        await logger.info('Workflow action log', { message: params.message, context })
        return { success: true, message: params.message }
      
      case 'set_variable':
        return { [params.name]: params.value }
      
      case 'http_request':
        // Implement HTTP request logic
        const response = await fetch(params.url, {
          method: params.method || 'GET',
          headers: params.headers || {},
          body: params.body ? JSON.stringify(params.body) : undefined,
        })
        return await response.json()
      
      case 'database_query':
        // Implement database query logic
        throw new Error('Database query action not implemented')
      
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }
}

class ConditionStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { condition } = step.config
    const result = this.evaluateCondition(condition, context)
    return { condition: result }
  }
}

class DelayStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { duration } = step.config
    await new Promise(resolve => setTimeout(resolve, duration))
    return { delayed: duration }
  }
}

class EmailStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { to, subject, template, data } = step.config
    
    // Queue email for sending
    const queueManager = QueueManager.getInstance()
    await queueManager.addJob('email', {
      to,
      subject,
      template,
      data: { ...data, ...context },
    })
    
    return { emailQueued: true, to, subject }
  }
}

class NotificationStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { userId, type, title, message, data } = step.config
    
    // Queue notification for sending
    const queueManager = QueueManager.getInstance()
    await queueManager.addJob('notification', {
      userId,
      type,
      title,
      message,
      data: { ...data, ...context },
    })
    
    return { notificationQueued: true, userId, type }
  }
}

class WebhookStepExecutor extends StepExecutor {
  async execute(step: WorkflowStep, context: Record<string, any>): Promise<any> {
    const { url, method, headers, payload } = step.config
    
    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ ...payload, context }),
    })
    
    return {
      status: response.status,
      data: await response.json(),
    }
  }
}

// Workflow engine
export class WorkflowEngine extends EventEmitter {
  private static instance: WorkflowEngine
  private config: WorkflowConfig
  private queueManager: QueueManager
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private instances: Map<string, WorkflowInstance> = new Map()
  private stepExecutors: Map<string, StepExecutor> = new Map()
  private metrics: WorkflowMetrics
  private runningInstances = 0

  private constructor(config: Partial<WorkflowConfig> = {}) {
    super()
    this.config = { ...defaultWorkflowConfig, ...config }
    this.queueManager = QueueManager.getInstance()
    this.metrics = {
      totalWorkflows: 0,
      activeWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      averageExecutionTime: 0,
      successRate: 0,
      stepMetrics: new Map(),
    }

    this.setupStepExecutors()
  }

  static getInstance(config?: Partial<WorkflowConfig>): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine(config)
    }
    return WorkflowEngine.instance
  }

  private setupStepExecutors(): void {
    this.stepExecutors.set('action', new ActionStepExecutor())
    this.stepExecutors.set('condition', new ConditionStepExecutor())
    this.stepExecutors.set('delay', new DelayStepExecutor())
    this.stepExecutors.set('email', new EmailStepExecutor())
    this.stepExecutors.set('notification', new NotificationStepExecutor())
    this.stepExecutors.set('webhook', new WebhookStepExecutor())
  }

  // Register workflow
  async registerWorkflow(definition: Omit<WorkflowDefinition, 'createdAt' | 'updatedAt'>): Promise<void> {
    // Validate workflow definition
    workflowDefinitionSchema.parse({
      ...definition,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const workflow: WorkflowDefinition = {
      ...definition,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.workflows.set(workflow.id, workflow)
    this.metrics.totalWorkflows++

    if (this.config.enablePersistence) {
      await CacheService.set(`workflow:${workflow.id}`, workflow)
    }

    await logger.info('Workflow registered', {
      workflowId: workflow.id,
      name: workflow.name,
      version: workflow.version,
    })

    this.emit('workflow:registered', workflow)
  }

  // Start workflow instance
  async startWorkflow(
    workflowId: string,
    context: Record<string, any> = {},
    triggeredBy?: string
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`)
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow is not active: ${workflowId}`)
    }

    if (this.runningInstances >= this.config.maxConcurrentWorkflows) {
      throw new Error('Maximum concurrent workflows reached')
    }

    const instanceId = uuidv4()
    const instance: WorkflowInstance = {
      id: instanceId,
      workflowId,
      status: 'pending',
      context,
      variables: { ...workflow.variables },
      startedAt: new Date(),
      executionLog: [],
      triggeredBy,
    }

    this.instances.set(instanceId, instance)
    this.metrics.activeWorkflows++
    this.runningInstances++

    // Start execution asynchronously
    this.executeWorkflow(instanceId).catch(async (error) => {
      await logger.error('Workflow execution failed', { instanceId, workflowId }, error)
    })

    await logger.info('Workflow started', {
      instanceId,
      workflowId,
      triggeredBy,
    })

    this.emit('workflow:started', instance)
    return instanceId
  }

  // Execute workflow
  private async executeWorkflow(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`)
    }

    const workflow = this.workflows.get(instance.workflowId)
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${instance.workflowId}`)
    }

    try {
      instance.status = 'running'
      
      // Find starting step (first step without dependencies)
      const startingSteps = workflow.steps.filter(step => 
        !workflow.steps.some(s => s.nextSteps?.includes(step.id))
      )

      if (startingSteps.length === 0) {
        throw new Error('No starting step found in workflow')
      }

      // Execute steps
      for (const step of startingSteps) {
        await this.executeStep(instance, workflow, step)
      }

      // Mark as completed if no errors
      if (instance.status === 'running') {
        instance.status = 'completed'
        instance.completedAt = new Date()
        this.metrics.completedWorkflows++
      }

    } catch (error) {
      instance.status = 'failed'
      instance.completedAt = new Date()
      instance.error = error instanceof Error ? error.message : String(error)
      this.metrics.failedWorkflows++
      
      await logger.error('Workflow execution failed', {
        instanceId,
        workflowId: instance.workflowId,
        error: instance.error,
      })
    } finally {
      this.runningInstances--
      this.metrics.activeWorkflows--
      
      // Update metrics
      this.updateMetrics(instance)
      
      // Persist instance if enabled
      if (this.config.enablePersistence) {
        await CacheService.set(`workflow_instance:${instanceId}`, instance)
      }

      this.emit('workflow:completed', instance)
    }
  }

  // Execute single step
  private async executeStep(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition,
    step: WorkflowStep
  ): Promise<void> {
    const logEntry: WorkflowExecutionLog = {
      stepId: step.id,
      stepName: step.name,
      status: 'started',
      startedAt: new Date(),
    }

    instance.executionLog.push(logEntry)
    instance.currentStep = step.id

    try {
      // Check condition if present
      if (step.condition && !this.evaluateCondition(step.condition, instance.context)) {
        logEntry.status = 'skipped'
        logEntry.completedAt = new Date()
        return
      }

      // Get step executor
      const executor = this.stepExecutors.get(step.type)
      if (!executor) {
        throw new Error(`No executor found for step type: ${step.type}`)
      }

      // Execute step with timeout
      const timeout = step.timeout || this.config.defaultTimeout
      const result = await Promise.race([
        executor.execute(step, instance.context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Step timeout')), timeout)
        ),
      ])

      // Update context with result
      if (result && typeof result === 'object') {
        Object.assign(instance.context, result)
      }

      logEntry.status = 'completed'
      logEntry.completedAt = new Date()
      logEntry.output = result
      logEntry.duration = logEntry.completedAt.getTime() - logEntry.startedAt.getTime()

      // Execute next steps
      if (step.nextSteps) {
        for (const nextStepId of step.nextSteps) {
          const nextStep = workflow.steps.find(s => s.id === nextStepId)
          if (nextStep) {
            await this.executeStep(instance, workflow, nextStep)
          }
        }
      }

    } catch (error) {
      logEntry.status = 'failed'
      logEntry.completedAt = new Date()
      logEntry.error = error instanceof Error ? error.message : String(error)
      logEntry.duration = logEntry.completedAt.getTime() - logEntry.startedAt.getTime()

      // Execute error steps if present
      if (step.errorSteps) {
        for (const errorStepId of step.errorSteps) {
          const errorStep = workflow.steps.find(s => s.id === errorStepId)
          if (errorStep) {
            await this.executeStep(instance, workflow, errorStep)
          }
        }
      } else {
        // Re-throw error if no error handling steps
        throw error
      }
    }

    // Update step metrics
    this.updateStepMetrics(step, logEntry)
  }

  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      const func = new Function('context', `with(context) { return ${condition}; }`)
      return Boolean(func(context))
    } catch (error) {
      logger.warn('Failed to evaluate condition', { condition, error })
      return false
    }
  }

  // Update metrics
  private updateMetrics(instance: WorkflowInstance): void {
    if (instance.completedAt && instance.startedAt) {
      const executionTime = instance.completedAt.getTime() - instance.startedAt.getTime()
      
      // Update average execution time
      const totalCompleted = this.metrics.completedWorkflows + this.metrics.failedWorkflows
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime * (totalCompleted - 1) + executionTime) / totalCompleted
    }

    // Update success rate
    const totalCompleted = this.metrics.completedWorkflows + this.metrics.failedWorkflows
    if (totalCompleted > 0) {
      this.metrics.successRate = this.metrics.completedWorkflows / totalCompleted
    }
  }

  private updateStepMetrics(step: WorkflowStep, logEntry: WorkflowExecutionLog): void {
    let stepMetrics = this.metrics.stepMetrics.get(step.id)
    
    if (!stepMetrics) {
      stepMetrics = {
        stepId: step.id,
        stepName: step.name,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageExecutionTime: 0,
      }
      this.metrics.stepMetrics.set(step.id, stepMetrics)
    }

    stepMetrics.executionCount++
    stepMetrics.lastExecuted = logEntry.startedAt

    if (logEntry.status === 'completed') {
      stepMetrics.successCount++
    } else if (logEntry.status === 'failed') {
      stepMetrics.failureCount++
    }

    if (logEntry.duration) {
      stepMetrics.averageExecutionTime = 
        (stepMetrics.averageExecutionTime * (stepMetrics.executionCount - 1) + logEntry.duration) / stepMetrics.executionCount
    }
  }

  // Get workflow instance
  getWorkflowInstance(instanceId: string): WorkflowInstance | null {
    return this.instances.get(instanceId) || null
  }

  // Get workflow definition
  getWorkflowDefinition(workflowId: string): WorkflowDefinition | null {
    return this.workflows.get(workflowId) || null
  }

  // List workflows
  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  // List workflow instances
  listWorkflowInstances(workflowId?: string): WorkflowInstance[] {
    const instances = Array.from(this.instances.values())
    return workflowId ? instances.filter(i => i.workflowId === workflowId) : instances
  }

  // Cancel workflow instance
  async cancelWorkflow(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`)
    }

    if (instance.status === 'completed' || instance.status === 'failed' || instance.status === 'cancelled') {
      throw new Error(`Cannot cancel workflow in status: ${instance.status}`)
    }

    instance.status = 'cancelled'
    instance.completedAt = new Date()
    
    this.runningInstances--
    this.metrics.activeWorkflows--

    await logger.info('Workflow cancelled', { instanceId })
    this.emit('workflow:cancelled', instance)
  }

  // Get metrics
  getMetrics(): WorkflowMetrics {
    return {
      ...this.metrics,
      stepMetrics: new Map(this.metrics.stepMetrics),
    }
  }

  // Cleanup completed instances
  async cleanup(olderThanHours = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    const toDelete: string[] = []

    for (const [instanceId, instance] of this.instances) {
      if (
        (instance.status === 'completed' || instance.status === 'failed' || instance.status === 'cancelled') &&
        instance.completedAt &&
        instance.completedAt < cutoffTime
      ) {
        toDelete.push(instanceId)
      }
    }

    for (const instanceId of toDelete) {
      this.instances.delete(instanceId)
      if (this.config.enablePersistence) {
        await CacheService.delete(`workflow_instance:${instanceId}`)
      }
    }

    await logger.info('Workflow cleanup completed', { deletedInstances: toDelete.length })
  }
}

// Predefined workflow templates
export const WorkflowTemplates = {
  USER_ONBOARDING: {
    id: 'user_onboarding',
    name: 'User Onboarding',
    description: 'Automated user onboarding process',
    version: '1.0.0',
    trigger: {
      type: 'event' as const,
      config: { event: 'user:registered' },
    },
    steps: [
      {
        id: 'welcome_email',
        name: 'Send Welcome Email',
        type: 'email' as const,
        config: {
          to: '{{user.email}}',
          subject: 'Welcome to KNI!',
          template: 'welcome',
          data: { userName: '{{user.name}}' },
        },
        nextSteps: ['create_notification'],
      },
      {
        id: 'create_notification',
        name: 'Create Welcome Notification',
        type: 'notification' as const,
        config: {
          userId: '{{user.id}}',
          type: 'welcome',
          title: 'Welcome to KNI!',
          message: 'Your account has been created successfully.',
        },
      },
    ],
    isActive: true,
  },
  
  TEST_COMPLETION: {
    id: 'test_completion',
    name: 'Test Completion Processing',
    description: 'Process test completion and send results',
    version: '1.0.0',
    trigger: {
      type: 'event' as const,
      config: { event: 'test:completed' },
    },
    steps: [
      {
        id: 'calculate_score',
        name: 'Calculate Test Score',
        type: 'action' as const,
        config: {
          action: 'calculate_score',
          params: { testId: '{{test.id}}' },
        },
        nextSteps: ['send_results'],
      },
      {
        id: 'send_results',
        name: 'Send Test Results',
        type: 'email' as const,
        config: {
          to: '{{user.email}}',
          subject: 'Your Test Results',
          template: 'test_results',
          data: {
            testName: '{{test.name}}',
            score: '{{score}}',
            userName: '{{user.name}}',
          },
        },
        nextSteps: ['create_notification'],
      },
      {
        id: 'create_notification',
        name: 'Create Results Notification',
        type: 'notification' as const,
        config: {
          userId: '{{user.id}}',
          type: 'test_results',
          title: 'Test Results Available',
          message: 'Your test results for {{test.name}} are now available.',
        },
      },
    ],
    isActive: true,
  },
} as const

// Export singleton instance
export const workflowEngine = WorkflowEngine.getInstance()

export default workflowEngine
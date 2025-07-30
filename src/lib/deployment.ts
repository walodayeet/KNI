import { z } from 'zod'
import { logger } from './logger'
import { EventEmitter } from 'events'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import yaml from 'js-yaml'
import { createHash } from 'crypto'

const execAsync = promisify(exec)

// Deployment interfaces
interface DeploymentConfig {
  name: string
  version: string
  environment: 'development' | 'staging' | 'production'
  strategy: 'rolling' | 'blue-green' | 'canary' | 'recreate'
  target: DeploymentTarget
  build: BuildConfig
  container: ContainerConfig
  networking: NetworkingConfig
  storage: StorageConfig
  monitoring: MonitoringConfig
  rollback: RollbackConfig
  notifications: NotificationConfig
}

interface DeploymentTarget {
  type: 'kubernetes' | 'docker' | 'serverless' | 'vm' | 'bare-metal'
  provider: 'aws' | 'gcp' | 'azure' | 'digitalocean' | 'local'
  region?: string
  cluster?: string
  namespace?: string
  credentials: CredentialConfig
}

interface CredentialConfig {
  type: 'file' | 'env' | 'vault' | 'iam'
  path?: string
  profile?: string
  roleArn?: string
}

interface BuildConfig {
  dockerfile: string
  context: string
  args: Record<string, string>
  target?: string
  cache: boolean
  registry: RegistryConfig
  tags: string[]
  platforms: string[]
}

interface RegistryConfig {
  url: string
  username?: string
  password?: string
  namespace: string
}

interface ContainerConfig {
  image: string
  tag: string
  ports: PortConfig[]
  env: Record<string, string>
  secrets: SecretConfig[]
  volumes: VolumeConfig[]
  resources: ResourceConfig
  healthCheck: HealthCheckConfig
  security: SecurityConfig
}

interface PortConfig {
  name: string
  containerPort: number
  protocol: 'TCP' | 'UDP'
  expose?: boolean
}

interface SecretConfig {
  name: string
  key: string
  mountPath?: string
  env?: string
}

interface VolumeConfig {
  name: string
  type: 'emptyDir' | 'hostPath' | 'pvc' | 'configMap' | 'secret'
  source?: string
  mountPath: string
  readOnly?: boolean
}

interface ResourceConfig {
  requests: {
    cpu: string
    memory: string
  }
  limits: {
    cpu: string
    memory: string
  }
}

interface HealthCheckConfig {
  enabled: boolean
  path?: string
  port?: number
  initialDelaySeconds: number
  periodSeconds: number
  timeoutSeconds: number
  failureThreshold: number
  successThreshold: number
}

interface SecurityConfig {
  runAsNonRoot: boolean
  runAsUser?: number
  runAsGroup?: number
  readOnlyRootFilesystem: boolean
  allowPrivilegeEscalation: boolean
  capabilities: {
    add: string[]
    drop: string[]
  }
}

interface NetworkingConfig {
  service: ServiceConfig
  ingress?: IngressConfig
  networkPolicy?: NetworkPolicyConfig
}

interface ServiceConfig {
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
  ports: ServicePortConfig[]
  annotations?: Record<string, string>
}

interface ServicePortConfig {
  name: string
  port: number
  targetPort: number
  protocol: 'TCP' | 'UDP'
}

interface IngressConfig {
  enabled: boolean
  className?: string
  annotations?: Record<string, string>
  hosts: IngressHostConfig[]
  tls?: IngressTLSConfig[]
}

interface IngressHostConfig {
  host: string
  paths: IngressPathConfig[]
}

interface IngressPathConfig {
  path: string
  pathType: 'Prefix' | 'Exact'
  service: string
  port: number
}

interface IngressTLSConfig {
  secretName: string
  hosts: string[]
}

interface NetworkPolicyConfig {
  enabled: boolean
  ingress: NetworkPolicyRule[]
  egress: NetworkPolicyRule[]
}

interface NetworkPolicyRule {
  from?: NetworkPolicyPeer[]
  to?: NetworkPolicyPeer[]
  ports?: NetworkPolicyPort[]
}

interface NetworkPolicyPeer {
  podSelector?: Record<string, string>
  namespaceSelector?: Record<string, string>
  ipBlock?: {
    cidr: string
    except?: string[]
  }
}

interface NetworkPolicyPort {
  protocol: 'TCP' | 'UDP'
  port: number
}

interface StorageConfig {
  volumes: PersistentVolumeConfig[]
  backups: BackupConfig
}

interface PersistentVolumeConfig {
  name: string
  size: string
  storageClass: string
  accessModes: ('ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany')[]
  mountPath: string
}

interface BackupConfig {
  enabled: boolean
  schedule: string
  retention: string
  destination: string
}

interface MonitoringConfig {
  metrics: MetricsConfig
  logging: LoggingConfig
  tracing: TracingConfig
  alerts: AlertConfig[]
}

interface MetricsConfig {
  enabled: boolean
  port: number
  path: string
  scrapeInterval: string
}

interface LoggingConfig {
  enabled: boolean
  level: string
  format: 'json' | 'text'
  destination: 'stdout' | 'file' | 'syslog'
}

interface TracingConfig {
  enabled: boolean
  endpoint: string
  samplingRate: number
}

interface AlertConfig {
  name: string
  condition: string
  severity: 'critical' | 'warning' | 'info'
  channels: string[]
}

interface RollbackConfig {
  enabled: boolean
  maxRevisions: number
  autoRollback: boolean
  healthCheckTimeout: number
}

interface NotificationConfig {
  enabled: boolean
  channels: NotificationChannel[]
  events: NotificationEvent[]
}

interface NotificationChannel {
  type: 'slack' | 'email' | 'webhook' | 'teams'
  config: Record<string, any>
}

interface NotificationEvent {
  type: 'deployment.started' | 'deployment.completed' | 'deployment.failed' | 'rollback.started' | 'rollback.completed'
  channels: string[]
}

interface DeploymentStatus {
  id: string
  config: DeploymentConfig
  status: 'pending' | 'building' | 'deploying' | 'completed' | 'failed' | 'rolling-back'
  phase: string
  progress: number
  startTime: Date
  endTime?: Date
  duration?: number
  logs: DeploymentLog[]
  artifacts: DeploymentArtifact[]
  rollbackInfo?: RollbackInfo
}

interface DeploymentLog {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  phase: string
  metadata?: Record<string, any>
}

interface DeploymentArtifact {
  type: 'image' | 'manifest' | 'config' | 'log'
  name: string
  url: string
  size: number
  checksum: string
  createdAt: Date
}

interface RollbackInfo {
  fromVersion: string
  toVersion: string
  reason: string
  triggeredBy: 'auto' | 'manual'
  triggeredAt: Date
}

// Zod schemas
const deploymentConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  strategy: z.enum(['rolling', 'blue-green', 'canary', 'recreate']),
  target: z.object({
    type: z.enum(['kubernetes', 'docker', 'serverless', 'vm', 'bare-metal']),
    provider: z.enum(['aws', 'gcp', 'azure', 'digitalocean', 'local']),
    region: z.string().optional(),
    cluster: z.string().optional(),
    namespace: z.string().optional(),
  }),
  build: z.object({
    dockerfile: z.string(),
    context: z.string(),
    args: z.record(z.string()),
    cache: z.boolean(),
    tags: z.array(z.string()),
    platforms: z.array(z.string()),
  }),
  container: z.object({
    image: z.string(),
    tag: z.string(),
    ports: z.array(z.object({
      name: z.string(),
      containerPort: z.number(),
      protocol: z.enum(['TCP', 'UDP']),
    })),
    env: z.record(z.string()),
    resources: z.object({
      requests: z.object({
        cpu: z.string(),
        memory: z.string(),
      }),
      limits: z.object({
        cpu: z.string(),
        memory: z.string(),
      }),
    }),
  }),
})

// Docker utilities
class DockerManager {
  static async buildImage(config: BuildConfig, onProgress?: (progress: string) => void): Promise<string> {
    const { dockerfile, context, args, target, cache, tags, platforms } = config
    
    let buildArgs = ''
    for (const [key, value] of Object.entries(args)) {
      buildArgs += ` --build-arg ${key}=${value}`
    }

    const cacheFlag = cache ? '' : ' --no-cache'
    const targetFlag = target ? ` --target ${target}` : ''
    const platformFlag = platforms.length > 0 ? ` --platform ${platforms.join(',')}` : ''
    const tagFlags = tags.map(tag => ` -t ${tag}`).join('')

    const command = `docker build${cacheFlag}${targetFlag}${platformFlag}${buildArgs}${tagFlags} -f ${dockerfile} ${context}`
    
    onProgress?.(`Building image with command: ${command}`)
    
    try {
      const { stdout, stderr } = await execAsync(command)
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr)
      }
      
      onProgress?.('Image built successfully')
      return tags[0] // Return primary tag
    } catch (error) {
      throw new Error(`Docker build failed: ${error}`)
    }
  }

  static async pushImage(image: string, registry: RegistryConfig, onProgress?: (progress: string) => void): Promise<void> {
    // Login to registry if credentials provided
    if (registry.username && registry.password) {
      onProgress?.('Logging into registry...')
      await execAsync(`echo "${registry.password}" | docker login ${registry.url} -u ${registry.username} --password-stdin`)
    }

    const fullImageName = `${registry.url}/${registry.namespace}/${image}`
    
    // Tag image for registry
    onProgress?.(`Tagging image: ${fullImageName}`)
    await execAsync(`docker tag ${image} ${fullImageName}`)
    
    // Push image
    onProgress?.(`Pushing image: ${fullImageName}`)
    await execAsync(`docker push ${fullImageName}`)
    
    onProgress?.('Image pushed successfully')
  }

  static async getImageInfo(image: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`docker inspect ${image}`)
      return JSON.parse(stdout)[0]
    } catch (error) {
      throw new Error(`Failed to get image info: ${error}`)
    }
  }
}

// Kubernetes utilities
class KubernetesManager {
  static generateDeploymentManifest(config: DeploymentConfig): any {
    const { name, container, networking } = config
    
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name,
        labels: {
          app: name,
          version: config.version,
          environment: config.environment,
        },
      },
      spec: {
        replicas: this.getReplicaCount(config.environment),
        strategy: this.getDeploymentStrategy(config.strategy),
        selector: {
          matchLabels: {
            app: name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: name,
              version: config.version,
              environment: config.environment,
            },
          },
          spec: {
            containers: [{
              name,
              image: `${container.image}:${container.tag}`,
              ports: container.ports.map(port => ({
                name: port.name,
                containerPort: port.containerPort,
                protocol: port.protocol,
              })),
              env: Object.entries(container.env).map(([name, value]) => ({ name, value })),
              resources: container.resources,
              livenessProbe: this.generateProbe(container.healthCheck, 'liveness'),
              readinessProbe: this.generateProbe(container.healthCheck, 'readiness'),
              securityContext: this.generateSecurityContext(container.security),
              volumeMounts: container.volumes?.map(volume => ({
                name: volume.name,
                mountPath: volume.mountPath,
                readOnly: volume.readOnly,
              })),
            }],
            volumes: container.volumes?.map(volume => this.generateVolume(volume)),
            securityContext: {
              runAsNonRoot: container.security.runAsNonRoot,
              runAsUser: container.security.runAsUser,
              runAsGroup: container.security.runAsGroup,
            },
          },
        },
      },
    }
  }

  static generateServiceManifest(config: DeploymentConfig): any {
    const { name, networking } = config
    const { service } = networking
    
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name,
        labels: {
          app: name,
        },
        annotations: service.annotations,
      },
      spec: {
        type: service.type,
        selector: {
          app: name,
        },
        ports: service.ports.map(port => ({
          name: port.name,
          port: port.port,
          targetPort: port.targetPort,
          protocol: port.protocol,
        })),
      },
    }
  }

  static generateIngressManifest(config: DeploymentConfig): any | null {
    const { name, networking } = config
    const { ingress } = networking
    
    if (!ingress?.enabled) {
      return null
    }
    
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name,
        labels: {
          app: name,
        },
        annotations: ingress.annotations,
      },
      spec: {
        ingressClassName: ingress.className,
        tls: ingress.tls?.map(tls => ({
          secretName: tls.secretName,
          hosts: tls.hosts,
        })),
        rules: ingress.hosts.map(host => ({
          host: host.host,
          http: {
            paths: host.paths.map(path => ({
              path: path.path,
              pathType: path.pathType,
              backend: {
                service: {
                  name: path.service,
                  port: {
                    number: path.port,
                  },
                },
              },
            })),
          },
        })),
      },
    }
  }

  static async applyManifest(manifest: any, namespace?: string): Promise<void> {
    const manifestYaml = yaml.dump(manifest)
    const tempFile = `/tmp/manifest-${Date.now()}.yaml`
    
    await fs.writeFile(tempFile, manifestYaml)
    
    try {
      const namespaceFlag = namespace ? ` -n ${namespace}` : ''
      await execAsync(`kubectl apply -f ${tempFile}${namespaceFlag}`)
    } finally {
      await fs.unlink(tempFile).catch(() => {})
    }
  }

  static async getDeploymentStatus(name: string, namespace?: string): Promise<any> {
    const namespaceFlag = namespace ? ` -n ${namespace}` : ''
    const { stdout } = await execAsync(`kubectl get deployment ${name}${namespaceFlag} -o json`)
    return JSON.parse(stdout)
  }

  static async rollbackDeployment(name: string, revision?: string, namespace?: string): Promise<void> {
    const namespaceFlag = namespace ? ` -n ${namespace}` : ''
    const revisionFlag = revision ? ` --to-revision=${revision}` : ''
    await execAsync(`kubectl rollout undo deployment/${name}${revisionFlag}${namespaceFlag}`)
  }

  private static getReplicaCount(environment: string): number {
    switch (environment) {
      case 'production':
        return 3
      case 'staging':
        return 2
      default:
        return 1
    }
  }

  private static getDeploymentStrategy(strategy: string): any {
    switch (strategy) {
      case 'rolling':
        return {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: '25%',
            maxSurge: '25%',
          },
        }
      case 'recreate':
        return {
          type: 'Recreate',
        }
      default:
        return {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: '25%',
            maxSurge: '25%',
          },
        }
    }
  }

  private static generateProbe(healthCheck: HealthCheckConfig, type: 'liveness' | 'readiness'): any {
    if (!healthCheck.enabled) {
      return undefined
    }

    return {
      httpGet: {
        path: healthCheck.path || '/health',
        port: healthCheck.port || 3000,
      },
      initialDelaySeconds: healthCheck.initialDelaySeconds,
      periodSeconds: healthCheck.periodSeconds,
      timeoutSeconds: healthCheck.timeoutSeconds,
      failureThreshold: healthCheck.failureThreshold,
      successThreshold: type === 'readiness' ? healthCheck.successThreshold : 1,
    }
  }

  private static generateSecurityContext(security: SecurityConfig): any {
    return {
      runAsNonRoot: security.runAsNonRoot,
      runAsUser: security.runAsUser,
      runAsGroup: security.runAsGroup,
      readOnlyRootFilesystem: security.readOnlyRootFilesystem,
      allowPrivilegeEscalation: security.allowPrivilegeEscalation,
      capabilities: {
        add: security.capabilities.add,
        drop: security.capabilities.drop,
      },
    }
  }

  private static generateVolume(volume: VolumeConfig): any {
    const base = {
      name: volume.name,
    }

    switch (volume.type) {
      case 'emptyDir':
        return { ...base, emptyDir: {} }
      case 'hostPath':
        return { ...base, hostPath: { path: volume.source } }
      case 'pvc':
        return { ...base, persistentVolumeClaim: { claimName: volume.source } }
      case 'configMap':
        return { ...base, configMap: { name: volume.source } }
      case 'secret':
        return { ...base, secret: { secretName: volume.source } }
      default:
        return base
    }
  }
}

// CI/CD pipeline utilities
class PipelineManager {
  static generateGitHubActions(config: DeploymentConfig): string {
    return `name: Deploy ${config.name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ${config.build.registry.url}
  IMAGE_NAME: ${config.container.image}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: \${{ env.REGISTRY }}
        username: \${{ github.actor }}
        password: \${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: ${config.build.context}
        file: ${config.build.dockerfile}
        push: true
        tags: \${{ steps.meta.outputs.tags }}
        labels: \${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: ${config.build.platforms.join(',')}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref === 'refs/heads/main'
    environment: ${config.environment}

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'latest'

    - name: Set up Kubernetes context
      run: |
        echo "\${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig

    - name: Deploy to Kubernetes
      run: |
        export KUBECONFIG=kubeconfig
        kubectl apply -f k8s/
        kubectl rollout status deployment/${config.name} -n ${config.target.namespace || 'default'}
`
  }

  static generateDockerCompose(config: DeploymentConfig): string {
    const services: any = {
      [config.name]: {
        build: {
          context: config.build.context,
          dockerfile: config.build.dockerfile,
          args: config.build.args,
        },
        image: `${config.container.image}:${config.container.tag}`,
        ports: config.container.ports.map(port => `${port.containerPort}:${port.containerPort}`),
        environment: config.container.env,
        volumes: config.container.volumes?.map(volume => `${volume.source}:${volume.mountPath}${volume.readOnly ? ':ro' : ''}`),
        restart: 'unless-stopped',
        healthcheck: config.container.healthCheck.enabled ? {
          test: [`CMD`, `curl`, `-f`, `http://localhost:${config.container.healthCheck.port || 3000}${config.container.healthCheck.path || '/health'}`],
          interval: `${config.container.healthCheck.periodSeconds}s`,
          timeout: `${config.container.healthCheck.timeoutSeconds}s`,
          retries: config.container.healthCheck.failureThreshold,
          start_period: `${config.container.healthCheck.initialDelaySeconds}s`,
        } : undefined,
      },
    }

    return yaml.dump({
      version: '3.8',
      services,
    })
  }

  static generateHelm(config: DeploymentConfig): Record<string, string> {
    const chartYaml = yaml.dump({
      apiVersion: 'v2',
      name: config.name,
      description: `Helm chart for ${config.name}`,
      type: 'application',
      version: '0.1.0',
      appVersion: config.version,
    })

    const valuesYaml = yaml.dump({
      replicaCount: KubernetesManager.getReplicaCount(config.environment),
      image: {
        repository: config.container.image,
        tag: config.container.tag,
        pullPolicy: 'IfNotPresent',
      },
      service: {
        type: config.networking.service.type,
        port: config.networking.service.ports[0]?.port || 80,
      },
      ingress: {
        enabled: config.networking.ingress?.enabled || false,
        className: config.networking.ingress?.className,
        annotations: config.networking.ingress?.annotations || {},
        hosts: config.networking.ingress?.hosts || [],
        tls: config.networking.ingress?.tls || [],
      },
      resources: config.container.resources,
      nodeSelector: {},
      tolerations: [],
      affinity: {},
    })

    const deploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${config.name}.fullname" . }}
  labels:
    {{- include "${config.name}.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "${config.name}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "${config.name}.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: ${config.container.ports[0]?.containerPort || 3000}
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}`

    return {
      'Chart.yaml': chartYaml,
      'values.yaml': valuesYaml,
      'templates/deployment.yaml': deploymentTemplate,
    }
  }
}

// Deployment manager
export class DeploymentManager extends EventEmitter {
  private static instance: DeploymentManager
  private deployments: Map<string, DeploymentStatus> = new Map()
  private dockerManager: DockerManager
  private kubernetesManager: KubernetesManager
  private pipelineManager: PipelineManager

  private constructor() {
    super()
    this.dockerManager = new DockerManager()
    this.kubernetesManager = new KubernetesManager()
    this.pipelineManager = new PipelineManager()
  }

  static getInstance(): DeploymentManager {
    if (!DeploymentManager.instance) {
      DeploymentManager.instance = new DeploymentManager()
    }
    return DeploymentManager.instance
  }

  // Deploy application
  async deploy(config: DeploymentConfig): Promise<string> {
    // Validate configuration
    deploymentConfigSchema.parse(config)

    const deploymentId = this.generateDeploymentId(config)
    const status: DeploymentStatus = {
      id: deploymentId,
      config,
      status: 'pending',
      phase: 'initializing',
      progress: 0,
      startTime: new Date(),
      logs: [],
      artifacts: [],
    }

    this.deployments.set(deploymentId, status)
    this.emit('deployment:started', status)

    try {
      await this.executeDeployment(status)
      
      status.status = 'completed'
      status.endTime = new Date()
      status.duration = status.endTime.getTime() - status.startTime.getTime()
      status.progress = 100

      await logger.info('Deployment completed', {
        deploymentId,
        name: config.name,
        version: config.version,
        environment: config.environment,
        duration: status.duration,
      })

      this.emit('deployment:completed', status)
    } catch (error) {
      status.status = 'failed'
      status.endTime = new Date()
      status.duration = status.endTime.getTime() - status.startTime.getTime()

      this.addLog(status, 'error', `Deployment failed: ${error}`, status.phase)

      await logger.error('Deployment failed', {
        deploymentId,
        name: config.name,
        error: String(error),
      })

      this.emit('deployment:failed', status)
      throw error
    }

    return deploymentId
  }

  // Execute deployment steps
  private async executeDeployment(status: DeploymentStatus): Promise<void> {
    const { config } = status

    // Phase 1: Build
    status.phase = 'building'
    status.progress = 10
    this.addLog(status, 'info', 'Starting build phase', 'building')
    
    const imageTag = await DockerManager.buildImage(config.build, (progress) => {
      this.addLog(status, 'info', progress, 'building')
    })
    
    status.progress = 30
    this.addLog(status, 'info', `Image built: ${imageTag}`, 'building')

    // Phase 2: Push to registry
    status.phase = 'pushing'
    status.progress = 40
    this.addLog(status, 'info', 'Pushing image to registry', 'pushing')
    
    await DockerManager.pushImage(imageTag, config.build.registry, (progress) => {
      this.addLog(status, 'info', progress, 'pushing')
    })
    
    status.progress = 60
    this.addLog(status, 'info', 'Image pushed successfully', 'pushing')

    // Phase 3: Deploy
    status.phase = 'deploying'
    status.progress = 70
    this.addLog(status, 'info', 'Starting deployment', 'deploying')
    
    await this.deployToTarget(config)
    
    status.progress = 90
    this.addLog(status, 'info', 'Deployment completed', 'deploying')

    // Phase 4: Verify
    status.phase = 'verifying'
    this.addLog(status, 'info', 'Verifying deployment', 'verifying')
    
    await this.verifyDeployment(config)
    
    this.addLog(status, 'info', 'Deployment verified', 'verifying')
  }

  // Deploy to target platform
  private async deployToTarget(config: DeploymentConfig): Promise<void> {
    switch (config.target.type) {
      case 'kubernetes':
        await this.deployToKubernetes(config)
        break
      case 'docker':
        await this.deployToDocker(config)
        break
      default:
        throw new Error(`Unsupported deployment target: ${config.target.type}`)
    }
  }

  // Deploy to Kubernetes
  private async deployToKubernetes(config: DeploymentConfig): Promise<void> {
    const deployment = KubernetesManager.generateDeploymentManifest(config)
    const service = KubernetesManager.generateServiceManifest(config)
    const ingress = KubernetesManager.generateIngressManifest(config)

    await KubernetesManager.applyManifest(deployment, config.target.namespace)
    await KubernetesManager.applyManifest(service, config.target.namespace)
    
    if (ingress) {
      await KubernetesManager.applyManifest(ingress, config.target.namespace)
    }
  }

  // Deploy to Docker
  private async deployToDocker(config: DeploymentConfig): Promise<void> {
    const composeContent = PipelineManager.generateDockerCompose(config)
    const composeFile = `/tmp/docker-compose-${config.name}.yml`
    
    await fs.writeFile(composeFile, composeContent)
    
    try {
      await execAsync(`docker-compose -f ${composeFile} up -d`)
    } finally {
      await fs.unlink(composeFile).catch(() => {})
    }
  }

  // Verify deployment
  private async verifyDeployment(config: DeploymentConfig): Promise<void> {
    if (config.target.type === 'kubernetes') {
      const status = await KubernetesManager.getDeploymentStatus(config.name, config.target.namespace)
      
      if (status.status?.readyReplicas !== status.status?.replicas) {
        throw new Error('Deployment verification failed: not all replicas are ready')
      }
    }
  }

  // Rollback deployment
  async rollback(deploymentId: string, targetVersion?: string): Promise<void> {
    const status = this.deployments.get(deploymentId)
    if (!status) {
      throw new Error(`Deployment not found: ${deploymentId}`)
    }

    const { config } = status
    
    status.status = 'rolling-back'
    status.rollbackInfo = {
      fromVersion: config.version,
      toVersion: targetVersion || 'previous',
      reason: 'Manual rollback',
      triggeredBy: 'manual',
      triggeredAt: new Date(),
    }

    this.addLog(status, 'info', `Starting rollback from ${config.version} to ${targetVersion || 'previous'}`, 'rollback')
    this.emit('rollback:started', status)

    try {
      if (config.target.type === 'kubernetes') {
        await KubernetesManager.rollbackDeployment(config.name, targetVersion, config.target.namespace)
      }

      this.addLog(status, 'info', 'Rollback completed', 'rollback')
      this.emit('rollback:completed', status)

      await logger.info('Rollback completed', {
        deploymentId,
        name: config.name,
        fromVersion: config.version,
        toVersion: targetVersion,
      })
    } catch (error) {
      this.addLog(status, 'error', `Rollback failed: ${error}`, 'rollback')
      
      await logger.error('Rollback failed', {
        deploymentId,
        name: config.name,
        error: String(error),
      })
      
      throw error
    }
  }

  // Get deployment status
  getDeploymentStatus(deploymentId: string): DeploymentStatus | null {
    return this.deployments.get(deploymentId) || null
  }

  // List deployments
  listDeployments(): DeploymentStatus[] {
    return Array.from(this.deployments.values())
  }

  // Generate deployment artifacts
  async generateArtifacts(config: DeploymentConfig, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true })

    // Generate Kubernetes manifests
    if (config.target.type === 'kubernetes') {
      const deployment = KubernetesManager.generateDeploymentManifest(config)
      const service = KubernetesManager.generateServiceManifest(config)
      const ingress = KubernetesManager.generateIngressManifest(config)

      await fs.writeFile(path.join(outputDir, 'deployment.yaml'), yaml.dump(deployment))
      await fs.writeFile(path.join(outputDir, 'service.yaml'), yaml.dump(service))
      
      if (ingress) {
        await fs.writeFile(path.join(outputDir, 'ingress.yaml'), yaml.dump(ingress))
      }
    }

    // Generate Docker Compose
    const dockerCompose = PipelineManager.generateDockerCompose(config)
    await fs.writeFile(path.join(outputDir, 'docker-compose.yml'), dockerCompose)

    // Generate CI/CD pipeline
    const githubActions = PipelineManager.generateGitHubActions(config)
    await fs.mkdir(path.join(outputDir, '.github', 'workflows'), { recursive: true })
    await fs.writeFile(path.join(outputDir, '.github', 'workflows', 'deploy.yml'), githubActions)

    // Generate Helm chart
    const helmChart = PipelineManager.generateHelm(config)
    const helmDir = path.join(outputDir, 'helm', config.name)
    await fs.mkdir(helmDir, { recursive: true })
    await fs.mkdir(path.join(helmDir, 'templates'), { recursive: true })
    
    for (const [filename, content] of Object.entries(helmChart)) {
      await fs.writeFile(path.join(helmDir, filename), content)
    }
  }

  // Helper methods
  private generateDeploymentId(config: DeploymentConfig): string {
    const hash = createHash('sha256')
    hash.update(`${config.name}-${config.version}-${Date.now()}`)
    return hash.digest('hex').substring(0, 16)
  }

  private addLog(status: DeploymentStatus, level: 'info' | 'warn' | 'error' | 'debug', message: string, phase: string): void {
    status.logs.push({
      timestamp: new Date(),
      level,
      message,
      phase,
    })

    // Keep only last 1000 logs
    if (status.logs.length > 1000) {
      status.logs = status.logs.slice(-1000)
    }
  }
}

// Predefined deployment configurations
export const DeploymentTemplates = {
  DEVELOPMENT: {
    name: 'kni-app',
    version: '1.0.0',
    environment: 'development' as const,
    strategy: 'recreate' as const,
    target: {
      type: 'docker' as const,
      provider: 'local' as const,
      credentials: { type: 'file' as const },
    },
    build: {
      dockerfile: 'Dockerfile',
      context: '.',
      args: { NODE_ENV: 'development' },
      cache: true,
      registry: {
        url: 'localhost:5000',
        namespace: 'kni',
      },
      tags: ['kni-app:latest', 'kni-app:dev'],
      platforms: ['linux/amd64'],
    },
    container: {
      image: 'kni-app',
      tag: 'latest',
      ports: [{ name: 'http', containerPort: 3000, protocol: 'TCP' as const }],
      env: { NODE_ENV: 'development' },
      secrets: [],
      volumes: [],
      resources: {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' },
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        port: 3000,
        initialDelaySeconds: 30,
        periodSeconds: 10,
        timeoutSeconds: 5,
        failureThreshold: 3,
        successThreshold: 1,
      },
      security: {
        runAsNonRoot: true,
        runAsUser: 1000,
        readOnlyRootFilesystem: false,
        allowPrivilegeEscalation: false,
        capabilities: { add: [], drop: ['ALL'] },
      },
    },
    networking: {
      service: {
        type: 'ClusterIP' as const,
        ports: [{ name: 'http', port: 80, targetPort: 3000, protocol: 'TCP' as const }],
      },
    },
    storage: {
      volumes: [],
      backups: { enabled: false, schedule: '', retention: '', destination: '' },
    },
    monitoring: {
      metrics: { enabled: true, port: 9090, path: '/metrics', scrapeInterval: '30s' },
      logging: { enabled: true, level: 'info', format: 'json' as const, destination: 'stdout' as const },
      tracing: { enabled: false, endpoint: '', samplingRate: 0.1 },
      alerts: [],
    },
    rollback: {
      enabled: true,
      maxRevisions: 10,
      autoRollback: false,
      healthCheckTimeout: 300,
    },
    notifications: {
      enabled: false,
      channels: [],
      events: [],
    },
  },
} as const

// Export singleton instance
export const deploymentManager = DeploymentManager.getInstance()

export default deploymentManager
import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { logger } from './logger'
import { CacheService } from './cache'
import { z } from 'zod'
import { EventEmitter } from 'events'
import jwt from 'jsonwebtoken'

// Real-time configuration
interface RealtimeConfig {
  cors: {
    origin: string | string[]
    credentials: boolean
  }
  enableAuth: boolean
  enableRooms: boolean
  enablePresence: boolean
  enableMetrics: boolean
  maxConnections: number
  heartbeatInterval: number
  heartbeatTimeout: number
  enableCompression: boolean
  enableLogging: boolean
}

const defaultRealtimeConfig: RealtimeConfig = {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  },
  enableAuth: process.env.REALTIME_ENABLE_AUTH === 'true',
  enableRooms: true,
  enablePresence: true,
  enableMetrics: true,
  maxConnections: parseInt(process.env.REALTIME_MAX_CONNECTIONS || '1000'),
  heartbeatInterval: parseInt(process.env.REALTIME_HEARTBEAT_INTERVAL || '25000'),
  heartbeatTimeout: parseInt(process.env.REALTIME_HEARTBEAT_TIMEOUT || '60000'),
  enableCompression: true,
  enableLogging: process.env.NODE_ENV !== 'production',
}

// Real-time interfaces
interface ConnectedUser {
  id: string
  userId?: string
  socketId: string
  rooms: Set<string>
  metadata: Record<string, any>
  connectedAt: Date
  lastSeen: Date
  userAgent?: string
  ipAddress?: string
}

interface Room {
  id: string
  name: string
  type: 'public' | 'private' | 'protected'
  members: Set<string>
  metadata: Record<string, any>
  createdAt: Date
  createdBy?: string
}

interface RealtimeEvent {
  type: string
  data: any
  room?: string
  userId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

interface PresenceData {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeen: Date
  metadata?: Record<string, any>
}

interface RealtimeMetrics {
  totalConnections: number
  activeConnections: number
  totalRooms: number
  activeRooms: number
  messagesPerSecond: number
  totalMessages: number
  averageLatency: number
}

// Zod schemas
const realtimeEventSchema = z.object({
  type: z.string(),
  data: z.any(),
  room: z.string().optional(),
  userId: z.string().optional(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
})

const presenceDataSchema = z.object({
  userId: z.string(),
  status: z.enum(['online', 'away', 'busy', 'offline']),
  lastSeen: z.date(),
  metadata: z.record(z.any()).optional(),
})



// Real-time manager
export class RealtimeManager extends EventEmitter {
  private static instance: RealtimeManager
  private io: SocketIOServer | null = null
  private config: RealtimeConfig
  private connectedUsers: Map<string, ConnectedUser> = new Map()
  private rooms: Map<string, Room> = new Map()
  private presence: Map<string, PresenceData> = new Map()
  private metrics: RealtimeMetrics
  private messageCount = 0
  private latencyMeasurements: number[] = []
  private metricsInterval: NodeJS.Timeout | null = null

  private constructor(config: Partial<RealtimeConfig> = {}) {
    super()
    this.config = { ...defaultRealtimeConfig, ...config }
    // CacheService uses static methods
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalRooms: 0,
      activeRooms: 0,
      messagesPerSecond: 0,
      totalMessages: 0,
      averageLatency: 0,
    }

    this.setupMetricsCollection()
  }

  static getInstance(config?: Partial<RealtimeConfig>): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager(config)
    }
    return RealtimeManager.instance
  }

  // Initialize Socket.IO server
  initialize(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('Real-time server already initialized')
      return
    }

    this.io = new SocketIOServer(httpServer, {
      cors: this.config.cors,
      pingInterval: this.config.heartbeatInterval,
      pingTimeout: this.config.heartbeatTimeout,
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'],
    })

    this.setupEventHandlers()
    logger.info('Real-time server initialized')
  }

  // Setup Socket.IO event handlers
  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', async (socket) => {
      try {
        await this.handleConnection(socket)
      } catch (error) {
        await logger.error('Error handling socket connection', { socketId: socket.id }, error instanceof Error ? error : new Error(String(error)))
        socket.disconnect()
      }
    })

    this.io.on('disconnect', async (socket) => {
      await this.handleDisconnection(socket.id)
    })
  }

  // Handle new socket connection
  private async handleConnection(socket: any): Promise<void> {
    const socketId = socket.id
    let userId: string | undefined

    // Authenticate user if enabled
    if (this.config.enableAuth) {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')
        if (token) {
          const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any
          userId = decoded.sub || decoded.userId
        }
      } catch (error) {
        await logger.warn('Socket authentication failed', { socketId })
        socket.emit('auth:error', { message: 'Authentication failed' })
        socket.disconnect()
        return
      }
    }

    // Create connected user
    const connectedUser: ConnectedUser = {
      id: socketId,
      ...(userId && { userId }),
      socketId,
      rooms: new Set(),
      metadata: {},
      connectedAt: new Date(),
      lastSeen: new Date(),
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address,
    }

    this.connectedUsers.set(socketId, connectedUser)
    this.metrics.totalConnections++
    this.metrics.activeConnections++

    // Update presence if user is authenticated
    if (userId && this.config.enablePresence) {
      await this.updatePresence(userId, 'online')
    }

    // Setup socket event handlers
    this.setupSocketHandlers(socket, connectedUser)

    await logger.info('Socket connected', {
      socketId,
      userId,
      userAgent: connectedUser.userAgent,
      ipAddress: connectedUser.ipAddress,
    })

    // Emit connection event
    socket.emit('connected', {
      socketId,
      userId,
      timestamp: connectedUser.connectedAt,
    })

    this.emit('user:connected', connectedUser)
  }

  // Setup individual socket event handlers
  private setupSocketHandlers(socket: any, user: ConnectedUser): void {
    // Join room
    socket.on('room:join', async (data: { roomId: string; metadata?: Record<string, any> }) => {
      try {
        await this.joinRoom(user.socketId, data.roomId, data.metadata)
      } catch (error) {
        socket.emit('room:error', { message: 'Failed to join room', roomId: data.roomId })
      }
    })

    // Leave room
    socket.on('room:leave', async (data: { roomId: string }) => {
      try {
        await this.leaveRoom(user.socketId, data.roomId)
      } catch (error) {
        socket.emit('room:error', { message: 'Failed to leave room', roomId: data.roomId })
      }
    })

    // Send message
    socket.on('message', async (data: any) => {
      try {
        await this.handleMessage(user, data)
      } catch (error) {
        socket.emit('message:error', { message: 'Failed to send message' })
      }
    })

    // Update presence
    socket.on('presence:update', async (data: { status: string; metadata?: Record<string, any> }) => {
      if (user.userId && this.config.enablePresence) {
        try {
          await this.updatePresence(user.userId, data.status as any, data.metadata)
        } catch (error) {
          socket.emit('presence:error', { message: 'Failed to update presence' })
        }
      }
    })

    // Ping/Pong for latency measurement
    socket.on('ping', (timestamp: number) => {
      const latency = Date.now() - timestamp
      this.latencyMeasurements.push(latency)
      
      // Keep only last 100 measurements
      if (this.latencyMeasurements.length > 100) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-100)
      }
      
      socket.emit('pong', { timestamp, latency })
    })

    // Handle disconnection
    socket.on('disconnect', async () => {
      await this.handleDisconnection(user.socketId)
    })
  }

  // Handle socket disconnection
  private async handleDisconnection(socketId: string): Promise<void> {
    const user = this.connectedUsers.get(socketId)
    if (!user) return

    // Leave all rooms
    for (const roomId of user.rooms) {
      await this.leaveRoom(socketId, roomId)
    }

    // Update presence to offline
    if (user.userId && this.config.enablePresence) {
      await this.updatePresence(user.userId, 'offline')
    }

    this.connectedUsers.delete(socketId)
    this.metrics.activeConnections--

    await logger.info('Socket disconnected', {
      socketId,
      userId: user.userId,
      connectedDuration: Date.now() - user.connectedAt.getTime(),
    })

    this.emit('user:disconnected', user)
  }

  // Handle incoming message
  private async handleMessage(user: ConnectedUser, data: any): Promise<void> {
    const event: RealtimeEvent = {
      type: data.type || 'message',
      data: data.data || data,
      room: data.room,
      ...(user.userId && { userId: user.userId }),
      timestamp: new Date(),
      metadata: data.metadata,
    }

    // Validate event
    realtimeEventSchema.parse(event)

    this.messageCount++
    this.metrics.totalMessages++
    user.lastSeen = new Date()

    if (this.config.enableLogging) {
      await logger.debug('Real-time message received', {
        socketId: user.socketId,
        userId: user.userId,
        type: event.type,
        room: event.room,
      })
    }

    // Emit to appropriate recipients
    if (event.room) {
      await this.emitToRoom(event.room, event.type, event.data, user.socketId)
    } else {
      // Broadcast to all connected users
      await this.broadcast(event.type, event.data, user.socketId)
    }

    this.emit('message:received', event, user)
  }

  // Join room
  async joinRoom(socketId: string, roomId: string, metadata?: Record<string, any>): Promise<void> {
    const user = this.connectedUsers.get(socketId)
    if (!user) {
      throw new Error('User not found')
    }

    const socket = this.io?.sockets.sockets.get(socketId)
    if (!socket) {
      throw new Error('Socket not found')
    }

    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      const room: Room = {
        id: roomId,
        name: roomId,
        type: 'public',
        members: new Set(),
        metadata: metadata || {},
        createdAt: new Date(),
        ...(user.userId && { createdBy: user.userId }),
      }
      this.rooms.set(roomId, room)
      this.metrics.totalRooms++
    }

    const room = this.rooms.get(roomId)!
    
    // Join socket to room
    await socket.join(roomId)
    user.rooms.add(roomId)
    room.members.add(socketId)

    await logger.info('User joined room', {
      socketId,
      userId: user.userId,
      roomId,
    })

    // Notify room members
    socket.to(roomId).emit('room:user_joined', {
      userId: user.userId,
      socketId,
      roomId,
      timestamp: new Date(),
    })

    // Send room info to user
    socket.emit('room:joined', {
      roomId,
      memberCount: room.members.size,
      metadata: room.metadata,
    })

    this.emit('room:joined', user, room)
  }

  // Leave room
  async leaveRoom(socketId: string, roomId: string): Promise<void> {
    const user = this.connectedUsers.get(socketId)
    if (!user) return

    const socket = this.io?.sockets.sockets.get(socketId)
    if (!socket) return

    const room = this.rooms.get(roomId)
    if (!room) return

    // Leave socket from room
    await socket.leave(roomId)
    user.rooms.delete(roomId)
    room.members.delete(socketId)

    // Remove room if empty
    if (room.members.size === 0) {
      this.rooms.delete(roomId)
    }

    await logger.info('User left room', {
      socketId,
      userId: user.userId,
      roomId,
    })

    // Notify room members
    socket.to(roomId).emit('room:user_left', {
      userId: user.userId,
      socketId,
      roomId,
      timestamp: new Date(),
    })

    this.emit('room:left', user, room)
  }

  // Update user presence
  async updatePresence(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    metadata?: Record<string, any>
  ): Promise<void> {
    const presenceData: PresenceData = {
      userId,
      status,
      lastSeen: new Date(),
      ...(metadata && { metadata }),
    }

    // Validate presence data
    presenceDataSchema.parse(presenceData)

    this.presence.set(userId, presenceData)
    
    // Cache presence data
    await CacheService.set(`presence:${userId}`, presenceData, 3600) // 1 hour

    // Broadcast presence update
    await this.broadcast('presence:updated', presenceData)

    this.emit('presence:updated', presenceData)
  }

  // Emit to specific room
  async emitToRoom(roomId: string, event: string, data: any, excludeSocketId?: string): Promise<void> {
    if (!this.io) return

    const emitter = excludeSocketId 
      ? this.io.to(roomId).except(excludeSocketId)
      : this.io.to(roomId)

    emitter.emit(event, {
      ...data,
      timestamp: new Date(),
      room: roomId,
    })
  }

  // Emit to specific user
  async emitToUser(userId: string, event: string, data: any): Promise<void> {
    if (!this.io) return

    const userSockets = Array.from(this.connectedUsers.values())
      .filter(user => user.userId === userId)
      .map(user => user.socketId)

    for (const socketId of userSockets) {
      this.io.to(socketId).emit(event, {
        ...data,
        timestamp: new Date(),
      })
    }
  }

  // Broadcast to all connected users
  async broadcast(event: string, data: any, excludeSocketId?: string): Promise<void> {
    if (!this.io) return

    const emitter = excludeSocketId 
      ? this.io.except(excludeSocketId)
      : this.io

    emitter.emit(event, {
      ...data,
      timestamp: new Date(),
    })
  }

  // Get connected users
  getConnectedUsers(): ConnectedUser[] {
    return Array.from(this.connectedUsers.values())
  }

  // Get users in room
  getUsersInRoom(roomId: string): ConnectedUser[] {
    return Array.from(this.connectedUsers.values())
      .filter(user => user.rooms.has(roomId))
  }

  // Get user presence
  async getUserPresence(userId: string): Promise<PresenceData | null> {
    let presence = this.presence.get(userId)
    
    if (!presence) {
      // Try to load from cache
      const cachedPresence = await CacheService.get<PresenceData>(`presence:${userId}`)
      if (cachedPresence) {
        presence = cachedPresence
        this.presence.set(userId, presence)
      }
    }
    
    return presence || null
  }

  // Get room info
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null
  }

  // Get all rooms
  getRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  // Setup metrics collection
  private setupMetricsCollection(): void {
    if (!this.config.enableMetrics) return

    this.metricsInterval = setInterval(() => {
      this.updateMetrics()
    }, 60000) // Update every minute
  }

  // Update metrics
  private updateMetrics(): void {
    this.metrics.activeRooms = this.rooms.size
    this.metrics.messagesPerSecond = this.messageCount / 60
    this.messageCount = 0

    if (this.latencyMeasurements.length > 0) {
      this.metrics.averageLatency = 
        this.latencyMeasurements.reduce((sum, latency) => sum + latency, 0) / this.latencyMeasurements.length
    }
  }

  // Get metrics
  getMetrics(): RealtimeMetrics {
    return { ...this.metrics }
  }

  // Shutdown
  async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    if (this.io) {
      this.io.close()
      this.io = null
    }

    this.connectedUsers.clear()
    this.rooms.clear()
    this.presence.clear()

    logger.info('Real-time server shutdown')
  }
}

// Real-time event types
export const RealtimeEvents = {
  // User events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_TYPING: 'user:typing',
  
  // Test events
  TEST_STARTED: 'test:started',
  TEST_COMPLETED: 'test:completed',
  TEST_UPDATED: 'test:updated',
  
  // Consultation events
  CONSULTATION_STARTED: 'consultation:started',
  CONSULTATION_ENDED: 'consultation:ended',
  CONSULTATION_MESSAGE: 'consultation:message',
  
  // Notification events
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  
  // System events
  SYSTEM_ANNOUNCEMENT: 'system:announcement',
  SYSTEM_MAINTENANCE: 'system:maintenance',
  
  // Room events
  ROOM_MESSAGE: 'room:message',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
} as const

// Real-time rooms
export const RealtimeRooms = {
  GLOBAL: 'global',
  ADMINS: 'admins',
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  TEST_SESSION: (testId: string) => `test:${testId}`,
  CONSULTATION: (consultationId: string) => `consultation:${consultationId}`,
  USER_NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
} as const

// Export singleton instance
export const realtimeManager = RealtimeManager.getInstance()

export default realtimeManager
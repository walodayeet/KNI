import { setupServer } from 'msw/node'
import { rest } from 'msw'

// Define request handlers
const handlers = [
  // Auth endpoints
  rest.post('/api/auth/signin', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
        token: 'mock-jwt-token',
      })
    )
  }),

  rest.post('/api/auth/signup', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          name: 'New User',
        },
        message: 'User created successfully',
      })
    )
  }),

  rest.post('/api/auth/signout', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ message: 'Signed out successfully' })
    )
  }),

  // User endpoints
  rest.get('/api/users/profile', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    )
  }),

  rest.put('/api/users/profile', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Updated User',
        updatedAt: new Date().toISOString(),
      })
    )
  }),

  // Test endpoints
  rest.get('/api/tests', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'test-1',
          title: 'Sample Test 1',
          description: 'A sample test for testing',
          questions: [],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'test-2',
          title: 'Sample Test 2',
          description: 'Another sample test',
          questions: [],
          createdAt: new Date().toISOString(),
        },
      ])
    )
  }),

  rest.get('/api/tests/:id', (req, res, ctx) => {
    const { id } = req.params
    return res(
      ctx.status(200),
      ctx.json({
        id,
        title: `Test ${id}`,
        description: `Description for test ${id}`,
        questions: [
          {
            id: 'q1',
            text: 'Sample question 1',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 0,
          },
          {
            id: 'q2',
            text: 'Sample question 2',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 1,
          },
        ],
        createdAt: new Date().toISOString(),
      })
    )
  }),

  rest.post('/api/tests/:id/submit', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        score: 85,
        totalQuestions: 2,
        correctAnswers: 1,
        passed: true,
        submittedAt: new Date().toISOString(),
      })
    )
  }),

  // Consultation endpoints
  rest.get('/api/consultations', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 'consultation-1',
          title: 'Career Guidance',
          description: 'Get guidance on your career path',
          duration: 60,
          price: 100,
          available: true,
        },
      ])
    )
  }),

  rest.post('/api/consultations/:id/book', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        id: 'booking-1',
        consultationId: req.params.id,
        userId: 'test-user-id',
        scheduledAt: new Date().toISOString(),
        status: 'confirmed',
      })
    )
  }),

  // Error handlers
  rest.get('/api/error', (req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ error: 'Internal server error' })
    )
  }),

  rest.get('/api/unauthorized', (req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({ error: 'Unauthorized' })
    )
  }),
]

// Setup server with handlers
export const server = setupServer(...handlers)
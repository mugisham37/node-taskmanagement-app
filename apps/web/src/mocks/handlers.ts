import { appConfig } from '@/config/app'
import { http, HttpResponse } from 'msw'

// Mock data
const mockUser = {
  id: '1',
  email: 'user@example.com',
  name: 'John Doe',
  avatar: null,
  role: 'user',
  permissions: ['read:tasks', 'write:tasks', 'read:projects'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockTasks = [
  {
    id: '1',
    title: 'Complete project setup',
    description: 'Set up the initial project structure and configuration',
    status: 'in_progress',
    priority: 'high',
    assigneeId: '1',
    projectId: '1',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Design user interface',
    description: 'Create wireframes and mockups for the application',
    status: 'todo',
    priority: 'medium',
    assigneeId: '1',
    projectId: '1',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const mockProjects = [
  {
    id: '1',
    name: 'Task Management System',
    description: 'A comprehensive task management application',
    status: 'active',
    ownerId: '1',
    members: [mockUser],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// API handlers
export const handlers = [
  // Authentication endpoints
  http.post(`${appConfig.apiUrl}/auth/login`, async ({ request }) => {
    const body = await request.json() as any
    
    if (body.email === 'user@example.com' && body.password === 'password') {
      return HttpResponse.json({
        user: mockUser,
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
      })
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post(`${appConfig.apiUrl}/auth/refresh`, () => {
    return HttpResponse.json({
      token: 'new-mock-jwt-token',
      refreshToken: 'new-mock-refresh-token',
    })
  }),

  http.get(`${appConfig.apiUrl}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json(mockUser)
  }),

  http.post(`${appConfig.apiUrl}/auth/logout`, () => {
    return HttpResponse.json({ success: true })
  }),

  // Tasks endpoints
  http.get(`${appConfig.apiUrl}/tasks`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const search = url.searchParams.get('search')
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const projectId = url.searchParams.get('projectId')

    let filteredTasks = [...mockTasks]

    // Apply filters
    if (search) {
      filteredTasks = filteredTasks.filter(task =>
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status)
    }

    if (priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === priority)
    }

    if (projectId) {
      filteredTasks = filteredTasks.filter(task => task.projectId === projectId)
    }

    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex)

    return HttpResponse.json({
      data: paginatedTasks,
      pagination: {
        page,
        limit,
        total: filteredTasks.length,
        totalPages: Math.ceil(filteredTasks.length / limit),
      },
    })
  }),

  http.get(`${appConfig.apiUrl}/tasks/:id`, ({ params }) => {
    const task = mockTasks.find(t => t.id === params.id)
    
    if (!task) {
      return HttpResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json(task)
  }),

  http.post(`${appConfig.apiUrl}/tasks`, async ({ request }) => {
    const body = await request.json() as any
    
    const newTask = {
      id: String(mockTasks.length + 1),
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    mockTasks.push(newTask)
    
    return HttpResponse.json(newTask, { status: 201 })
  }),

  http.put(`${appConfig.apiUrl}/tasks/:id`, async ({ params, request }) => {
    const taskIndex = mockTasks.findIndex(t => t.id === params.id)
    
    if (taskIndex === -1) {
      return HttpResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json() as any
    const updatedTask = {
      ...mockTasks[taskIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    }
    
    mockTasks[taskIndex] = updatedTask
    
    return HttpResponse.json(updatedTask)
  }),

  http.delete(`${appConfig.apiUrl}/tasks/:id`, ({ params }) => {
    const taskIndex = mockTasks.findIndex(t => t.id === params.id)
    
    if (taskIndex === -1) {
      return HttpResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }
    
    mockTasks.splice(taskIndex, 1)
    
    return HttpResponse.json({ success: true })
  }),

  // Projects endpoints
  http.get(`${appConfig.apiUrl}/projects`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedProjects = mockProjects.slice(startIndex, endIndex)

    return HttpResponse.json({
      data: paginatedProjects,
      pagination: {
        page,
        limit,
        total: mockProjects.length,
        totalPages: Math.ceil(mockProjects.length / limit),
      },
    })
  }),

  http.get(`${appConfig.apiUrl}/projects/:id`, ({ params }) => {
    const project = mockProjects.find(p => p.id === params.id)
    
    if (!project) {
      return HttpResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }
    
    return HttpResponse.json(project)
  }),

  // Analytics endpoints
  http.get(`${appConfig.apiUrl}/analytics/dashboard`, () => {
    return HttpResponse.json({
      totalTasks: mockTasks.length,
      completedTasks: mockTasks.filter(t => t.status === 'completed').length,
      inProgressTasks: mockTasks.filter(t => t.status === 'in_progress').length,
      todoTasks: mockTasks.filter(t => t.status === 'todo').length,
      totalProjects: mockProjects.length,
      activeProjects: mockProjects.filter(p => p.status === 'active').length,
    })
  }),

  // Notifications endpoints
  http.get(`${appConfig.apiUrl}/notifications`, () => {
    return HttpResponse.json({
      data: [
        {
          id: '1',
          title: 'Task assigned',
          message: 'You have been assigned a new task',
          type: 'info',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    })
  }),

  // File upload endpoint
  http.post(`${appConfig.apiUrl}/upload`, async ({ request }) => {
    // Simulate file upload
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return HttpResponse.json({
      url: 'https://example.com/uploaded-file.jpg',
      filename: 'uploaded-file.jpg',
      size: 1024000,
      type: 'image/jpeg',
    })
  }),

  // Health check
  http.get(`${appConfig.apiUrl}/health`, () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime?.() || 0,
    })
  }),
]
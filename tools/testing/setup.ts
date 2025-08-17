/**
 * Global test setup for Vitest
 * Configures testing environment, mocks, and utilities
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import 'whatwg-fetch';

// Extend Vitest matchers
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret';

// Global test configuration
beforeAll(() => {
  // Setup global mocks
  setupGlobalMocks();
  
  // Setup test database if needed
  setupTestDatabase();
  
  // Setup internationalization
  setupI18n();
});

afterAll(() => {
  // Cleanup global resources
  cleanupGlobalResources();
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  vi.clearAllTimers();
  
  // Reset DOM
  cleanup();
  
  // Reset any global state
  resetGlobalState();
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
  
  // Reset timers
  vi.useRealTimers();
});

// Global mock functions
function setupGlobalMocks() {
  // Mock console methods in tests
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock window.ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
  });

  // Mock fetch
  global.fetch = vi.fn();

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  }));

  // Mock crypto
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: vi.fn(() => '123e4567-e89b-12d3-a456-426614174000'),
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
  });

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'mocked-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock File and FileReader
  global.File = class MockFile {
    constructor(bits, name, options = {}) {
      this.bits = bits;
      this.name = name;
      this.size = bits.reduce((acc, bit) => acc + bit.length, 0);
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  };

  global.FileReader = class MockFileReader {
    constructor() {
      this.readyState = 0;
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.onabort = null;
      this.onloadstart = null;
      this.onloadend = null;
      this.onprogress = null;
    }

    readAsText(file) {
      setTimeout(() => {
        this.readyState = 2;
        this.result = 'mocked file content';
        if (this.onload) this.onload({ target: this });
      }, 0);
    }

    readAsDataURL(file) {
      setTimeout(() => {
        this.readyState = 2;
        this.result = 'data:text/plain;base64,bW9ja2VkIGZpbGUgY29udGVudA==';
        if (this.onload) this.onload({ target: this });
      }, 0);
    }

    abort() {
      this.readyState = 2;
      if (this.onabort) this.onabort({ target: this });
    }
  };

  // Mock HTMLCanvasElement
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }));

  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');
  HTMLCanvasElement.prototype.getContext = vi.fn();
  HTMLCanvasElement.prototype.toBlob = vi.fn();
}

function setupTestDatabase() {
  // Mock database connection for tests
  vi.mock('@taskmanagement/database', () => ({
    createConnection: vi.fn(() => Promise.resolve({
      query: vi.fn(),
      close: vi.fn(),
    })),
    migrate: vi.fn(() => Promise.resolve()),
    seed: vi.fn(() => Promise.resolve()),
  }));
}

function setupI18n() {
  // Mock i18n for tests
  vi.mock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        changeLanguage: vi.fn(),
        language: 'en',
      },
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: {
      type: '3rdParty',
      init: vi.fn(),
    },
  }));
}

function resetGlobalState() {
  // Reset any global application state
  // This would include Redux store, Zustand stores, etc.
}

function cleanupGlobalResources() {
  // Cleanup any global resources
  vi.restoreAllMocks();
}

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockTask = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'Test Task',
  description: 'Test task description',
  status: 'todo',
  priority: 'medium',
  assigneeId: '123e4567-e89b-12d3-a456-426614174000',
  projectId: '123e4567-e89b-12d3-a456-426614174002',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174002',
  name: 'Test Project',
  description: 'Test project description',
  status: 'active',
  workspaceId: '123e4567-e89b-12d3-a456-426614174003',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockWorkspace = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'Test Workspace',
  slug: 'test-workspace',
  ownerId: '123e4567-e89b-12d3-a456-426614174000',
  settings: {},
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

// Mock API responses
export const mockApiResponse = <T>(data: T, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  headers: new Headers(),
});

// Mock fetch responses
export const mockFetch = (response: any, status = 200) => {
  (global.fetch as any).mockResolvedValueOnce(mockApiResponse(response, status));
};

// Mock error responses
export const mockFetchError = (error: string, status = 500) => {
  (global.fetch as any).mockRejectedValueOnce(new Error(error));
};

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock timers
export const mockTimers = () => {
  vi.useFakeTimers();
  return {
    advanceTimersByTime: vi.advanceTimersByTime,
    runAllTimers: vi.runAllTimers,
    runOnlyPendingTimers: vi.runOnlyPendingTimers,
    restore: vi.useRealTimers,
  };
};

// Mock dates
export const mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  vi.setSystemTime(mockDate);
  return mockDate;
};

// Test data builders
export class UserBuilder {
  private user = createMockUser();

  withId(id: string) {
    this.user.id = id;
    return this;
  }

  withEmail(email: string) {
    this.user.email = email;
    return this;
  }

  withName(firstName: string, lastName: string) {
    this.user.firstName = firstName;
    this.user.lastName = lastName;
    return this;
  }

  withRole(role: string) {
    this.user.role = role;
    return this;
  }

  build() {
    return { ...this.user };
  }
}

export class TaskBuilder {
  private task = createMockTask();

  withId(id: string) {
    this.task.id = id;
    return this;
  }

  withTitle(title: string) {
    this.task.title = title;
    return this;
  }

  withStatus(status: string) {
    this.task.status = status;
    return this;
  }

  withPriority(priority: string) {
    this.task.priority = priority;
    return this;
  }

  withAssignee(assigneeId: string) {
    this.task.assigneeId = assigneeId;
    return this;
  }

  withProject(projectId: string) {
    this.task.projectId = projectId;
    return this;
  }

  build() {
    return { ...this.task };
  }
}

// Export builders for convenience
export const aUser = () => new UserBuilder();
export const aTask = () => new TaskBuilder();

// Global test helpers
declare global {
  var testUtils: {
    createMockUser: typeof createMockUser;
    createMockTask: typeof createMockTask;
    createMockProject: typeof createMockProject;
    createMockWorkspace: typeof createMockWorkspace;
    mockFetch: typeof mockFetch;
    mockFetchError: typeof mockFetchError;
    waitFor: typeof waitFor;
    mockTimers: typeof mockTimers;
    mockDate: typeof mockDate;
    aUser: typeof aUser;
    aTask: typeof aTask;
  };
}

// Make utilities available globally
global.testUtils = {
  createMockUser,
  createMockTask,
  createMockProject,
  createMockWorkspace,
  mockFetch,
  mockFetchError,
  waitFor,
  mockTimers,
  mockDate,
  aUser,
  aTask,
};
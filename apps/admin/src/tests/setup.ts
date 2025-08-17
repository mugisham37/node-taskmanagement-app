import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock environment variables
Object.defineProperty(window, 'process', {
  value: {
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3000',
    },
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
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
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
})) as any;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test utilities
export const createMockUser = (overrides = {}) => ({
  id: '1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  roles: ['admin'],
  permissions: ['*'],
  isActive: true,
  emailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

export const createMockAuthState = (overrides = {}) => ({
  user: createMockUser(),
  token: 'mock-token',
  refreshToken: 'mock-refresh-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  mfaRequired: false,
  mfaToken: null,
  sessionExpiry: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  permissions: ['*'],
  roles: ['admin'],
  ...overrides,
});

export const createMockStore = (initialState = {}) => ({
  auth: createMockAuthState(),
  ui: {
    sidebarCollapsed: false,
    sidebarMobile: false,
    theme: 'light',
    globalLoading: false,
    loadingStates: {},
    notifications: [],
    unreadNotificationCount: 0,
    modals: [],
    currentPage: '/dashboard',
    breadcrumbs: [],
    globalSearch: '',
    activeFilters: {},
    realTimeEnabled: true,
    connectionStatus: 'connected',
    lastDataUpdate: null,
    preferences: {
      refreshInterval: 30000,
      pageSize: 25,
      dateFormat: 'MM/dd/yyyy',
      timezone: 'UTC',
      language: 'en',
    },
  },
  ...initialState,
});

// Test helper functions
export const waitFor = (callback: () => void, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      try {
        callback();
        resolve(true);
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          setTimeout(check, 10);
        }
      }
    };
    check();
  });
};

export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
  });
};

export const mockApiError = (message: string, status = 400) => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
    text: () => Promise.resolve(JSON.stringify({ message })),
  });
};
import { afterEach, beforeEach, vi } from 'vitest';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console methods
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  vi.restoreAllMocks();
});

// Mock global objects that might not be available in Node.js environment
global.navigator = {
  language: 'en-US',
  languages: ['en-US', 'en'],
} as any;

// Mock Intl if needed (usually available in Node.js 18+)
if (!global.Intl) {
  global.Intl = {
    DateTimeFormat: vi.fn(),
    NumberFormat: vi.fn(),
    RelativeTimeFormat: vi.fn(),
  } as any;
}
import { describe, expect, it, vi } from 'vitest';
import { asyncHandler, asyncHandlerWithTimeout, asyncMiddleware } from '../async-handler';

describe('Async Handler', () => {
  describe('asyncHandler', () => {
    it('should handle successful async functions', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      const handler = asyncHandler(mockFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      const handler = asyncHandler(mockFn);
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('asyncMiddleware', () => {
    it('should handle middleware functions', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);
      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      const middleware = asyncMiddleware(mockFn);
      await middleware(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });
  });

  describe('asyncHandlerWithTimeout', () => {
    it('should handle functions within timeout', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      const handler = asyncHandlerWithTimeout(mockFn, 1000);
      await handler(mockReq, mockRes, mockNext);

      expect(mockFn).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should timeout long-running functions', async () => {
      const mockFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      const mockReq = {} as any;
      const mockRes = {} as any;
      const mockNext = vi.fn();

      const handler = asyncHandlerWithTimeout(mockFn, 50);
      await handler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('timeout')
        })
      );
    });
  });
});
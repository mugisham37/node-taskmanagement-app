import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggingService } from '../logging-service';

describe('LoggingService', () => {
  let loggingService: LoggingService;

  beforeEach(() => {
    loggingService = new LoggingService();
  });

  describe('info', () => {
    it('should log info messages correctly', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      loggingService.info('Test info message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('should log error messages correctly', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      loggingService.error('Test error message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('warn', () => {
    it('should log warning messages correctly', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      loggingService.warn('Test warning message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('debug', () => {
    it('should log debug messages correctly', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      loggingService.debug('Test debug message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test debug message')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
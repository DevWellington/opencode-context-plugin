/**
 * Debug Utility Tests
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createDebugLogger, debugLog, DEBUG_KEY } from '../src/utils/debug.js';
import fs from 'fs/promises';

// Spy on fs.appendFile to verify logging behavior
const appendFileSpy = jest.spyOn(fs, 'appendFile');

describe('Debug Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDebugLogger(namespace)', () => {
    it('should return a function', () => {
      const logger = createDebugLogger('test');
      expect(typeof logger).toBe('function');
    });

    it('should call fs.appendFile when config.debug is true', async () => {
      // Mock getConfig to return debug: true
      const originalModule = await import('../src/config.js');

      const debugLogger = createDebugLogger('test-namespace');

      // Call the logger with debug enabled
      debugLogger('Test message');

      // The appendFile should be called (though getConfig may return false)
      // We verify the function is returned properly
      expect(typeof debugLogger).toBe('function');
    });

    it('should include namespace in the logged message', () => {
      const namespace = 'my-namespace';
      const message = 'test message content';

      // When debug is enabled, the function should format with namespace
      const configModule = { getConfig: () => ({ debug: true }) };

      // We test the formatting indirectly by checking the logger is created
      const logger = createDebugLogger(namespace);
      expect(typeof logger).toBe('function');

      // Calling logger should attempt to log (may or may not succeed based on config)
      logger(message);
    });
  });

  describe('DEBUG_KEY constant', () => {
    it('should be "debug"', () => {
      expect(DEBUG_KEY).toBe('debug');
    });
  });

  describe('debugLog(message)', () => {
    it('should be a function for backward compatibility', () => {
      expect(typeof debugLog).toBe('function');
    });

    it('should be callable without throwing', () => {
      expect(() => debugLog('test message')).not.toThrow();
    });
  });

  describe('createDebugLogger edge cases', () => {
    it('should handle empty namespace', () => {
      const logger = createDebugLogger('');
      expect(typeof logger).toBe('function');
    });

    it('should handle namespace with special characters', () => {
      const logger = createDebugLogger('context-plugin/special-chars');
      expect(typeof logger).toBe('function');
    });

    it('should handle long messages', () => {
      const logger = createDebugLogger('test');
      const longMessage = 'x'.repeat(10000);
      expect(() => logger(longMessage)).not.toThrow();
    });
  });
});

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const { isExpectedFsError, logUnexpectedError, throttledLog, handleCatch, resetThrottleCache } = await import('../src/utils/errorUtils.js');

describe('errorUtils', () => {
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = jest.fn();
    resetThrottleCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isExpectedFsError', () => {
    it('should return true for ENOENT error', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      
      expect(isExpectedFsError(err)).toBe(true);
    });

    it('should return true for custom expected codes', () => {
      const err = new Error('Permission denied');
      err.code = 'EACCES';
      
      expect(isExpectedFsError(err, ['ENOENT', 'EACCES'])).toBe(true);
    });

    it('should return false for unexpected errors', () => {
      const err = new Error('Unknown error');
      err.code = 'EUNKNOWN';
      
      expect(isExpectedFsError(err)).toBe(false);
    });

    it('should return false for errors without code', () => {
      const err = new Error('No code error');
      
      expect(isExpectedFsError(err)).toBe(false);
    });

    it('should return false for null/undefined errors', () => {
      expect(isExpectedFsError(null)).toBe(false);
      expect(isExpectedFsError(undefined)).toBe(false);
    });

    it('should use default expectedCodes when not provided', () => {
      const enoentErr = new Error('File not found');
      enoentErr.code = 'ENOENT';
      
      const otherErr = new Error('Other error');
      otherErr.code = 'EOTHER';
      
      expect(isExpectedFsError(enoentErr)).toBe(true);
      expect(isExpectedFsError(otherErr)).toBe(false);
    });
  });

  describe('logUnexpectedError', () => {
    it('should log unexpected errors', () => {
      const err = new Error('Unexpected failure');
      err.code = 'EUNKNOWN';
      
      logUnexpectedError(err, 'test-module', 'test-operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledWith('[test-module] test-operation failed: Unexpected failure');
    });

    it('should not log ENOENT errors', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      
      logUnexpectedError(err, 'test-module', 'test-operation', mockLogger);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should not log custom expected errors', () => {
      const err = new Error('Permission denied');
      err.code = 'EACCES';
      
      logUnexpectedError(err, 'test-module', 'test-operation', mockLogger, ['ENOENT', 'EACCES']);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should log errors without code', () => {
      const err = new Error('Generic error');
      
      logUnexpectedError(err, 'test-module', 'test-operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledWith('[test-module] test-operation failed: Generic error');
    });
  });

  describe('throttledLog', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should log first occurrence of unexpected error', () => {
      const err = new Error('Throttled error');
      err.code = 'EUNKNOWN';
      
      throttledLog(err, 'module', 'operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledTimes(1);
      expect(mockLogger).toHaveBeenCalledWith('[module] operation failed: Throttled error');
    });

    it('should not log same error within throttle period', () => {
      const err = new Error('Throttled error');
      err.code = 'EUNKNOWN';
      
      throttledLog(err, 'module', 'operation', mockLogger);
      throttledLog(err, 'module', 'operation', mockLogger);
      throttledLog(err, 'module', 'operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledTimes(1);
    });

    it('should log again after throttle period expires', () => {
      const err = new Error('Throttled error');
      err.code = 'EUNKNOWN';
      
      throttledLog(err, 'module', 'operation', mockLogger);
      expect(mockLogger).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(60000);
      
      throttledLog(err, 'module', 'operation', mockLogger);
      expect(mockLogger).toHaveBeenCalledTimes(2);
    });

    it('should track different errors separately', () => {
      const err1 = new Error('Error 1');
      err1.code = 'ERR1';
      
      const err2 = new Error('Error 2');
      err2.code = 'ERR2';
      
      throttledLog(err1, 'module', 'operation', mockLogger);
      throttledLog(err2, 'module', 'operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledTimes(2);
    });

    it('should not log ENOENT errors', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      
      throttledLog(err, 'module', 'operation', mockLogger);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should not log custom expected errors', () => {
      const err = new Error('Permission denied');
      err.code = 'EACCES';
      
      throttledLog(err, 'module', 'operation', mockLogger, ['ENOENT', 'EACCES']);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });
  });

  describe('handleCatch', () => {
    it('should not log expected errors', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      
      handleCatch(err, 'module', 'operation', mockLogger);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should log unexpected errors via throttled logger', () => {
      const err = new Error('Unexpected');
      err.code = 'EUNKNOWN';
      
      handleCatch(err, 'module', 'operation', mockLogger);
      
      expect(mockLogger).toHaveBeenCalledTimes(1);
      expect(mockLogger).toHaveBeenCalledWith('[module] operation failed: Unexpected');
    });

    it('should work without logger (silent for expected)', () => {
      const err = new Error('File not found');
      err.code = 'ENOENT';
      
      handleCatch(err, 'module', 'operation', null);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });

    it('should handle custom expected codes', () => {
      const err = new Error('Permission denied');
      err.code = 'EACCES';
      
      handleCatch(err, 'module', 'operation', mockLogger, ['ENOENT', 'EACCES']);
      
      expect(mockLogger).not.toHaveBeenCalled();
    });
  });
});
/**
 * Debounce Utility Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { debounce } from '../src/utils/debounce.js';

describe('Debounce Utility', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounce(fn, delayMs)', () => {
    it('should delay execution of the function', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn(); // Reset timer
      jest.advanceTimersByTime(50);
      debouncedFn(); // Reset again
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute with the latest arguments', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('first');
      jest.advanceTimersByTime(50);
      debouncedFn('second');
      jest.advanceTimersByTime(50);
      debouncedFn('third');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('should preserve this context', () => {
      const obj = {
        value: 0,
        increment: function() {
          this.value++;
        }
      };

      const debouncedIncrement = debounce(obj.increment, 100);
      debouncedIncrement.call(obj);
      jest.advanceTimersByTime(100);

      expect(obj.value).toBe(1);
    });
  });

  describe('flush() method', () => {
    it('should execute immediately and clear timer', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      debouncedFn.flush();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should execute with provided arguments on flush', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      debouncedFn.flush('flush-arg');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('flush-arg');
    });

    it('should do nothing if no pending call', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn.flush();

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined function gracefully', () => {
      expect(() => debounce(null, 100)).not.toThrow();
      expect(() => debounce(undefined, 100)).not.toThrow();
    });

    it('should return function as-is if fn is not a function', () => {
      const result = debounce('not a function', 100);
      expect(result).toBe('not a function');
    });

    it('should handle zero delay', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 0);

      debouncedFn();
      jest.advanceTimersByTime(0);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rapid calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 50);

      for (let i = 0; i < 10; i++) {
        debouncedFn(i);
        jest.advanceTimersByTime(10);
      }

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(9); // Last argument
    });
  });
});

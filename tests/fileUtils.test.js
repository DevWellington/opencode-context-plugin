import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const { atomicWrite, getTimestamp, withTimeout, recoverOrphanedTempFiles, createAbortController } = await import('../src/utils/fileUtils.js');

describe('fileUtils', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileutils-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('atomicWrite', () => {
    it('should write content to file and clean up temp file', async () => {
      const filePath = path.join(tempDir, 'output.md');
      const content = 'hello world';

      await atomicWrite(filePath, content);

      const written = await fs.readFile(filePath, 'utf-8');
      expect(written).toBe(content);

      const files = await fs.readdir(tempDir);
      const tmpFiles = files.filter(f => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should clean up temp file on write error', async () => {
      const filePath = path.join(tempDir, 'output.md');

      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValueOnce(new Error('write failed'));

      await expect(atomicWrite(filePath, 'content')).rejects.toThrow('write failed');

      fs.writeFile = originalWriteFile;

      const files = await fs.readdir(tempDir);
      const tmpFiles = files.filter(f => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should clean up temp file on rename error', async () => {
      const filePath = path.join(tempDir, 'output.md');

      const originalRename = fs.rename;
      fs.rename = jest.fn().mockRejectedValueOnce(new Error('rename failed'));

      await expect(atomicWrite(filePath, 'content')).rejects.toThrow('rename failed');

      fs.rename = originalRename;

      const files = await fs.readdir(tempDir);
      const tmpFiles = files.filter(f => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('getTimestamp', () => {
    it('should return a string in ISO format with colons replaced', () => {
      const ts = getTimestamp();
      expect(typeof ts).toBe('string');
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      expect(ts).not.toContain(':');
      expect(ts).not.toContain('.');
    });
  });

  describe('withTimeout', () => {
    it('should resolve when promise completes within timeout', async () => {
      const result = await withTimeout(Promise.resolve('done'), 1000, 'test');
      expect(result).toBe('done');
    });

    it('should reject when promise exceeds timeout', async () => {
      const slow = new Promise(() => {});
      await expect(withTimeout(slow, 10, 'slow-op')).rejects.toThrow('Timeout after 10ms: slow-op');
    });

    describe('AbortSignal support', () => {
      it('should complete successfully when signal not aborted', async () => {
        const controller = new AbortController();
        const result = await withTimeout(
          Promise.resolve('success'),
          100,
          { signal: controller.signal, label: 'test' }
        );
        expect(result).toBe('success');
      });

      it('should reject immediately when signal already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        
        await expect(withTimeout(
          Promise.resolve('success'),
          100,
          { signal: controller.signal, label: 'test' }
        )).rejects.toThrow('Aborted');
      });

      it('should reject with AbortError when signal aborts during operation', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        
        const promise = withTimeout(
          new Promise(() => {}), // Never resolves
          1000,
          { signal: controller.signal, label: 'test' }
        );
        
        // Abort after 50ms
        setTimeout(() => controller.abort(), 50);
        
        jest.runAllTimers();
        
        await expect(promise).rejects.toThrow('Aborted');
        
        jest.useRealTimers();
      });

      it('should timeout before abort if abort happens later', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        
        const promise = withTimeout(
          new Promise(() => {}), // Never resolves
          100,
          { signal: controller.signal, label: 'test' }
        );
        
        // Abort would happen at 200ms, but timeout is at 100ms
        setTimeout(() => controller.abort(), 200);
        
        jest.runAllTimers();
        
        await expect(promise).rejects.toThrow('Timeout after 100ms: test');
        
        jest.useRealTimers();
      });

      it('should support function signature with signal parameter', async () => {
        const controller = new AbortController();
        let receivedSignal = null;
        const result = await withTimeout(
          ({ signal }) => {
            receivedSignal = signal;
            return Promise.resolve('function-result');
          },
          100,
          { signal: controller.signal, label: 'test' }
        );
        expect(result).toBe('function-result');
        expect(receivedSignal).not.toBeNull();
        expect(receivedSignal.aborted).toBe(false);
      });

      it('should cleanup timeout on abort', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        
        const promise = withTimeout(
          new Promise(() => {}),
          1000,
          { signal: controller.signal, label: 'test' }
        );
        
        controller.abort();
        jest.runAllTimers();
        
        await expect(promise).rejects.toThrow('Aborted');
        
        // Verify no timers are pending
        expect(jest.getTimerCount()).toBe(0);
        
        jest.useRealTimers();
      });

      it('should cleanup event listener on completion', async () => {
        const controller = new AbortController();
        const initialListenerCount = controller.signal._events?.abort?.length || 0;
        
        await withTimeout(
          Promise.resolve('done'),
          100,
          { signal: controller.signal, label: 'test' }
        );
        
        // Event listener should be removed
        const finalListenerCount = controller.signal._events?.abort?.length || 0;
        expect(finalListenerCount).toBe(initialListenerCount);
      });

      it('should cleanup event listener on timeout', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        
        const promise = withTimeout(
          new Promise(() => {}),
          50,
          { signal: controller.signal, label: 'test' }
        );
        
        jest.runAllTimers();
        
        await expect(promise).rejects.toThrow();
        
        // Event listener should be removed
        const listenerCount = controller.signal._events?.abort?.length || 0;
        expect(listenerCount).toBe(0);
        
        jest.useRealTimers();
      });

      it('should work with legacy Promise signature (backward compatibility)', async () => {
        const result = await withTimeout(Promise.resolve('legacy'), 100, 'legacy-label');
        expect(result).toBe('legacy');
      });

      it('should work with new function signature without signal', async () => {
        const result = await withTimeout(
          () => Promise.resolve('new-sig'),
          100,
          { label: 'new-label' }
        );
        expect(result).toBe('new-sig');
      });

      it('should not reject with AbortError on regular error', async () => {
        const controller = new AbortController();
        const error = new Error('Task failed');
        
        await expect(withTimeout(
          () => Promise.reject(error),
          100,
          { signal: controller.signal, label: 'test' }
        )).rejects.toThrow('Task failed');
      });

      it('should set ETIMEDOUT code on timeout', async () => {
        jest.useFakeTimers();
        
        const promise = withTimeout(
          new Promise(() => {}),
          100,
          'timeout-test'
        );
        
        jest.runAllTimers();
        
        try {
          await promise;
          fail('Should have thrown');
        } catch (error) {
          expect(error.code).toBe('ETIMEDOUT');
        }
        
        jest.useRealTimers();
      });
    });
  });

  describe('recoverOrphanedTempFiles', () => {
    it('should delete old .tmp files older than 5 minutes', async () => {
      const oldFile = path.join(tempDir, '.tmp-oldfile');
      await fs.writeFile(oldFile, 'old');
      const now = Date.now();
      const oldTime = new Date(now - 6 * 60 * 1000);
      await fs.utimes(oldFile, oldTime, oldTime);

      const count = await recoverOrphanedTempFiles(tempDir);

      expect(count).toBe(1);
      const files = await fs.readdir(tempDir);
      expect(files).not.toContain('.tmp-oldfile');
    });

    it('should keep recent .tmp files under 5 minutes', async () => {
      const recentFile = path.join(tempDir, '.tmp-recent');
      await fs.writeFile(recentFile, 'recent');

      const count = await recoverOrphanedTempFiles(tempDir);

      expect(count).toBe(0);
      const files = await fs.readdir(tempDir);
      expect(files).toContain('.tmp-recent');
    });

    it('should handle missing directory gracefully', async () => {
      const missingDir = path.join(tempDir, 'nonexistent');

      const count = await recoverOrphanedTempFiles(missingDir);

      expect(count).toBe(0);
    });
  });

  describe('createAbortController', () => {
    it('should create a new AbortController', () => {
      const controller = createAbortController();
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal).toBeDefined();
      expect(controller.signal.aborted).toBe(false);
    });

    it('should allow aborting operations', () => {
      const controller = createAbortController();
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  describe('timeout stability', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('no late effect after timeout', async () => {
      let sideEffect = false;
      const slowOp = withTimeout(
        async () => {
          await new Promise(r => setTimeout(r, 200));
          sideEffect = true;
          return 'done';
        },
        100,
        'slow-operation'
      );

      jest.advanceTimersByTime(100);

      await expect(slowOp).rejects.toThrow('Timeout after 100ms');
      expect(sideEffect).toBe(false);
    });

    it('cleans up timeout on successful completion', async () => {
      const fastOp = withTimeout(
        Promise.resolve('fast'),
        1000,
        'fast-operation'
      );

      jest.advanceTimersByTime(500);
      
      const result = await fastOp;
      expect(result).toBe('fast');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('cleans up timeout on error', async () => {
      const errorOp = withTimeout(
        Promise.reject(new Error('Task failed')),
        1000,
        'error-operation'
      );

      jest.advanceTimersByTime(100);

      await expect(errorOp).rejects.toThrow('Task failed');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('handles rapid timeout/reject scenarios', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          withTimeout(
            new Promise(() => {}),
            50,
            `op-${i}`
          ).catch(() => {})
        );
      }

      jest.advanceTimersByTime(50);

      await Promise.allSettled(promises);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('timeout prevents function execution after timeout', async () => {
      let executed = false;
      
      const slowOp = withTimeout(
        () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              executed = true;
              resolve('done');
            }, 500);
          });
        },
        100,
        { label: 'function-timeout' }
      );

      jest.advanceTimersByTime(100);

      await expect(slowOp).rejects.toThrow('Timeout after 100ms');
      
      expect(executed).toBe(false);
    });

    it('timeout with signal cleanup on abort', async () => {
      const controller = new AbortController();
      
      const op = withTimeout(
        new Promise(() => {}),
        1000,
        { signal: controller.signal, label: 'abort-test' }
      );

      jest.advanceTimersByTime(100);
      controller.abort();
      jest.advanceTimersByTime(1000);

      await expect(op).rejects.toThrow();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('no memory leak from pending timeouts', async () => {
      const initialTimerCount = jest.getTimerCount();
      
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          withTimeout(
            Promise.resolve(`result-${i}`),
            10000,
            `batch-${i}`
          ).catch(() => {})
        );
      }

      await Promise.all(promises);
      
      expect(jest.getTimerCount()).toBe(initialTimerCount);
    });
  });
});

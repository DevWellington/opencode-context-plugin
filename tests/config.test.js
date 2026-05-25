/**
 * Config Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadConfig, getConfig, defaultConfig, LOG_FILE, CONTEXT_SESSION_DIR, hasProtectedPatterns } from '../src/config.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Config Module', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('loadConfig()', () => {
    it('should load valid context-plugin.json and merge with defaults', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        contextPlugin: {
          maxContexts: 10,
          debug: true,
          debounceMs: 1000
        }
      }));

      const config = await loadConfig(tempDir);

      expect(config.maxContexts).toBe(10);
      expect(config.debug).toBe(true);
      expect(config.debounceMs).toBe(1000);
      // Default preserved
      expect(config.enableLearning).toBe(true);
      expect(config.logLevel).toBe('info');
    });

    it('should use defaults when context-plugin.json is missing', async () => {
      const config = await loadConfig(tempDir);

      expect(config).toEqual(defaultConfig);
    });

    it('should handle malformed JSON gracefully', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, 'not valid json');

      const config = await loadConfig(tempDir);

      // Should fall back to defaults
      expect(config).toEqual(defaultConfig);
    });

    it('should handle top-level config without contextPlugin wrapper', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        maxContexts: 3,
        logLevel: 'debug'
      }));

      const config = await loadConfig(tempDir);

      expect(config.maxContexts).toBe(3);
      expect(config.logLevel).toBe('debug');
      expect(config.debug).toBe(false); // default
    });

    it('should deep merge nested config blocks', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        contextPlugin: {
          injection: {
            enabled: true,
            cache: {
              ttlHours: 12
            }
          },
          protected: {
            enabled: true,
            patterns: ['**/*.secret']
          }
        }
      }));

      const config = await loadConfig(tempDir);

      expect(config.injection.enabled).toBe(true);
      expect(config.injection.autoInject).toBe(false);
      expect(config.injection.maxTokens).toBe(8000);
      expect(config.injection.cache.enabled).toBe(true);
      expect(config.injection.cache.ttlHours).toBe(12);
      expect(config.protected.enabled).toBe(true);
      expect(config.protected.patterns).toEqual(['**/*.secret']);
      expect(config.protected.mode).toBe('content');
    });
  });

  describe('getConfig()', () => {
    it('should return a copy of current config', async () => {
      // First load defaults
      await loadConfig(tempDir);

      const config = getConfig();

      expect(config).toEqual(defaultConfig);
      // Verify it's a copy, not the original
      expect(config).not.toBe(defaultConfig);
    });

    it('should return config after loadConfig has been called', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        contextPlugin: {
          maxContexts: 7
        }
      }));

      await loadConfig(tempDir);

      const config = getConfig();
      expect(config.maxContexts).toBe(7);
    });
  });

  describe('defaultConfig', () => {
    it('should have all expected default values', () => {
      expect(defaultConfig.maxContexts).toBe(5);
      expect(defaultConfig.enableLearning).toBe(true);
      expect(defaultConfig.logLevel).toBe('info');
      expect(defaultConfig.debug).toBe(false);
      expect(defaultConfig.debounceMs).toBe(500);
    });
  });

  describe('hasProtectedPatterns', () => {
    it('should return false when protected not enabled', async () => {
      await loadConfig(tempDir);
      expect(hasProtectedPatterns()).toBe(false);
    });

    it('should return false when patterns is empty array', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        protected: { enabled: true, patterns: [] }
      }));
      await loadConfig(tempDir);
      expect(hasProtectedPatterns()).toBe(false);
    });

    it('should return false when patterns is not an array', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        protected: { enabled: true, patterns: 'not-an-array' }
      }));
      await loadConfig(tempDir);
      expect(hasProtectedPatterns()).toBe(false);
    });

    it('should return true when enabled and patterns has items', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        protected: { enabled: true, patterns: ['**/*.secret'] }
      }));
      await loadConfig(tempDir);
      expect(hasProtectedPatterns()).toBe(true);
    });

    it('should return false when enabled but patterns is null', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        protected: { enabled: true, patterns: null }
      }));
      await loadConfig(tempDir);
      expect(hasProtectedPatterns()).toBe(false);
    });
  });

  describe('constants', () => {
    it('should export LOG_FILE path', () => {
      expect(LOG_FILE).toBeDefined();
      expect(typeof LOG_FILE).toBe('string');
      expect(LOG_FILE).toContain('.opencode-context-plugin.log');
    });

    it('should export CONTEXT_SESSION_DIR constant', () => {
      expect(CONTEXT_SESSION_DIR).toBe('.opencode/context-session');
    });
  });

  describe('concurrent loadConfig', () => {
    it('handles concurrent config loads without race', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      await fs.writeFile(configPath, JSON.stringify({
        contextPlugin: {
          maxContexts: 15,
          debug: true
        }
      }));

      const results = await Promise.all([
        loadConfig(tempDir),
        loadConfig(tempDir),
        loadConfig(tempDir)
      ]);

      expect(results[0].maxContexts).toBe(15);
      expect(results[1].maxContexts).toBe(15);
      expect(results[2].maxContexts).toBe(15);
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it('serializes config loads to prevent interleaved reads', async () => {
      const configPath = path.join(tempDir, 'context-plugin.json');
      
      let loadCount = 0;
      const originalReadFile = fs.readFile;
      fs.readFile = jest.fn().mockImplementation(async (path, encoding) => {
        if (path === configPath) {
          loadCount++;
          await new Promise(r => setTimeout(r, 10));
        }
        return originalReadFile(path, encoding);
      });

      await fs.writeFile(configPath, JSON.stringify({ maxContexts: 20 }));

      const results = await Promise.all([
        loadConfig(tempDir),
        loadConfig(tempDir),
        loadConfig(tempDir)
      ]);

      fs.readFile = originalReadFile;

      expect(loadCount).toBe(3);
      expect(results.every(r => r.maxContexts === 20)).toBe(true);
    });

    it('concurrent loads with different configs use last loaded', async () => {
      const config1 = path.join(tempDir, 'dir1', 'context-plugin.json');
      const config2 = path.join(tempDir, 'dir2', 'context-plugin.json');
      
      await fs.mkdir(path.join(tempDir, 'dir1'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'dir2'), { recursive: true });
      
      await fs.writeFile(config1, JSON.stringify({ maxContexts: 30 }));
      await fs.writeFile(config2, JSON.stringify({ maxContexts: 40 }));

      const results = await Promise.all([
        loadConfig(path.join(tempDir, 'dir1')),
        loadConfig(path.join(tempDir, 'dir2'))
      ]);

      expect(results[0].maxContexts).toBe(30);
      expect(results[1].maxContexts).toBe(40);
    });
  });
});

/**
 * Config Module Tests
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { loadConfig, getConfig, defaultConfig, LOG_FILE, CONTEXT_SESSION_DIR } from '../src/config.js';
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
    it('should load valid opencode.json and merge with defaults', async () => {
      const configPath = path.join(tempDir, 'opencode.json');
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

    it('should use defaults when opencode.json is missing', async () => {
      const config = await loadConfig(tempDir);

      expect(config).toEqual(defaultConfig);
    });

    it('should handle malformed JSON gracefully', async () => {
      const configPath = path.join(tempDir, 'opencode.json');
      await fs.writeFile(configPath, 'not valid json');

      const config = await loadConfig(tempDir);

      // Should fall back to defaults
      expect(config).toEqual(defaultConfig);
    });

    it('should handle top-level config without contextPlugin wrapper', async () => {
      const configPath = path.join(tempDir, 'opencode.json');
      await fs.writeFile(configPath, JSON.stringify({
        maxContexts: 3,
        logLevel: 'debug'
      }));

      const config = await loadConfig(tempDir);

      expect(config.maxContexts).toBe(3);
      expect(config.logLevel).toBe('debug');
      expect(config.debug).toBe(false); // default
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
      const configPath = path.join(tempDir, 'opencode.json');
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
});

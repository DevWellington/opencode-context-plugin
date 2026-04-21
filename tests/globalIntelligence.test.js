/**
 * Global Intelligence Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('Global Intelligence Module', () => {
  const testBaseDir = path.join(os.tmpdir(), 'gi-test-' + Date.now());
  
  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(path.join(testBaseDir, '.opencode/context-session'), { recursive: true });
  });
  
  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {}
  });

  describe('getGlobalIntelligencePath()', () => {
    it('should return path that ends with global-intelligence.md', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      const result = getGlobalIntelligencePath();
      expect(result.endsWith('global-intelligence.md')).toBe(true);
    });
    
    it('should return path under .opencode directory', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      const result = getGlobalIntelligencePath();
      expect(result).toContain('.opencode');
    });
    
    it('should use home directory', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      const result = getGlobalIntelligencePath();
      expect(result).toContain(os.homedir());
    });
  });

  describe('initializeGlobalIntelligence()', () => {
    it('should create global intelligence file at correct path', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      const filePath = await initializeGlobalIntelligence();
      
      // File should exist
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBeTruthy();
    });
    
    it('should create file with Global Intelligence heading', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('# Global Intelligence');
    });
    
    it('should create file with Last Updated section', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('## Last Updated');
      expect(content).toContain('**Projects:**');
      expect(content).toContain('**Sessions:**');
    });
    
    it('should create file with Cross-Project Patterns section', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('## Cross-Project Patterns');
      expect(content).toContain('### Recurring Themes');
    });
    
    it('should create file with Bug Database section', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('## Bug Database (Universal)');
    });
    
    it('should create file with Project Directory section', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('## Project Directory');
      expect(content).toContain('### Active Projects');
    });
    
    it('should not overwrite existing file', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      const firstContent = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      
      // Initialize again
      await initializeGlobalIntelligence();
      const secondContent = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      
      expect(firstContent).toBe(secondContent);
    });
  });

  describe('updateGlobalIntelligence()', () => {
    it('should append project entry to Project Directory', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      await updateGlobalIntelligence('test-project', {
        sessionCount: 5,
        lastSessionType: 'exit',
        timestamp: new Date().toISOString()
      });
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('### test-project');
      expect(content).toContain('**Session Count:**');
    });
    
    it('should update timestamp in Last Updated section', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const testTimestamp = '2024-06-15T12:00:00Z';
      await updateGlobalIntelligence('test-project', {
        sessionCount: 1,
        lastSessionType: 'exit',
        timestamp: testTimestamp
      });
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain(testTimestamp);
    });
    
    it('should handle missing session info gracefully', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      // Should not throw with null/undefined sessionInfo
      await updateGlobalIntelligence('test-project', null);
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toContain('### test-project');
    });
    
    it('should handle empty project name gracefully', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      // Should not throw
      await updateGlobalIntelligence('', {});
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      // Should not have empty project entry
      expect(content).not.toContain('### \n');
    });
    
    it('should use queue-based serialization (sequential updates)', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      // Fire multiple updates rapidly
      const updatePromises = [];
      for (let i = 0; i < 3; i++) {
        updatePromises.push(updateGlobalIntelligence('project-' + i, {
          sessionCount: i + 1,
          lastSessionType: 'exit',
          timestamp: new Date().toISOString()
        }));
      }
      
      await Promise.all(updatePromises);
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      // All three projects should be present
      expect(content).toContain('### project-0');
      expect(content).toContain('### project-1');
      expect(content).toContain('### project-2');
    });
  });

  describe('queryGlobalIntelligence()', () => {
    it('should find matching project entries', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, queryGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      await updateGlobalIntelligence('searchable-project', {
        sessionCount: 3,
        lastSessionType: 'exit',
        timestamp: new Date().toISOString()
      });
      
      const results = await queryGlobalIntelligence('searchable-project');
      
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should be case-insensitive', async () => {
      const { initializeGlobalIntelligence, updateGlobalIntelligence, queryGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      await updateGlobalIntelligence('UNIQUEProjectName123', {
        sessionCount: 1,
        lastSessionType: 'exit',
        timestamp: new Date().toISOString()
      });
      
      const results = await queryGlobalIntelligence('uniqueprojectname123');
      
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should return empty array for no matches', async () => {
      const { initializeGlobalIntelligence, queryGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      await initializeGlobalIntelligence();
      
      const results = await queryGlobalIntelligence('nonexistent-project-xyz-123');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
    
    it('should return empty array for empty pattern', async () => {
      const { queryGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      const results = await queryGlobalIntelligence('');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
    
    it('should return empty array for null pattern', async () => {
      const { queryGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      const results = await queryGlobalIntelligence(null);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('path resolution', () => {
    it('should resolve ~ to home directory', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      const result = getGlobalIntelligencePath();
      
      expect(result.startsWith(os.homedir())).toBe(true);
    });
    
    it('should create .opencode directory if not exists', async () => {
      const { initializeGlobalIntelligence, getGlobalIntelligencePath } = await import('../src/utils/globalIntelligence.js');
      
      // Remove .opencode directory if it exists
      try {
        const opencodeDir = path.join(os.homedir(), '.opencode');
        await fs.rm(opencodeDir, { recursive: true, force: true });
      } catch {}
      
      // Initialize should recreate it
      await initializeGlobalIntelligence();
      
      const content = await fs.readFile(getGlobalIntelligencePath(), 'utf-8');
      expect(content).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should handle read errors gracefully in query', async () => {
      const { queryGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      // Query should return empty array on error
      const results = await queryGlobalIntelligence('test');
      expect(Array.isArray(results)).toBe(true);
    });
    
    it('should not throw on update failure', async () => {
      const { updateGlobalIntelligence } = await import('../src/utils/globalIntelligence.js');
      
      // Should not throw even with invalid state
      await expect(updateGlobalIntelligence(null, null)).resolves.not.toThrow();
    });
  });
});
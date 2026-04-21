import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from "fs/promises";
import path from "path";
import os from "os";
import { 
  detectProjectType,
  generateProjectTemplate,
  initializeFromTemplate,
  listTemplates,
  getRecommendedTemplate
} from '../src/modules/projectTemplates.js';

describe('projectTemplates', () => {
  const tempDirs = [];
  
  afterEach(async () => {
    // Clean up all temp directories
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {}
    }
    tempDirs.length = 0;
  });
  
  function createTestDir() {
    const testDir = path.join(os.tmpdir(), `ppt-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempDirs.push(testDir);
    return testDir;
  }
  
  describe('detectProjectType', () => {
    it('should detect Node.js projects', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'package.json'), '{}');
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('node');
    });
    
    it('should detect Python projects', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'requirements.txt'), '');
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('python');
    });
    
    it('should detect Go projects', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'go.mod'), 'module test');
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('go');
    });
    
    it('should detect Rust projects', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'Cargo.toml'), '[package]');
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('rust');
    });
    
    it('should detect webapp from index.html', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'index.html'), '<html>');
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('webapp');
    });
    
    it('should detect webapp from public directory', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.mkdir(path.join(testDir, 'public'), { recursive: true });
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('webapp');
    });
    
    it('should detect library from README and src', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('library');
    });
    
    it('should return generic for unknown projects', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      
      const type = await detectProjectType(testDir);
      expect(type).toBe('generic');
    });
  });
  
  describe('generateProjectTemplate', () => {
    it('should generate template with default options', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      
      const template = await generateProjectTemplate({
        projectName: 'test-project',
        baseDir: testDir
      });
      
      expect(template.name).toBe('test-project');
      expect(template.structure).toBeDefined();
      expect(template.structure.folders).toContain('.opencode');
      expect(template.config).toBeDefined();
      expect(template.patterns).toBeDefined();
    });
    
    it('should include hooks when requested', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      
      const template = await generateProjectTemplate({
        projectName: 'test-project',
        includeHooks: true,
        baseDir: testDir
      });
      
      expect(template.hooks).toBeDefined();
      expect(template.hooks.length).toBeGreaterThan(0);
    });
    
    it('should not include hooks when not requested', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      
      const template = await generateProjectTemplate({
        projectName: 'test-project',
        includeHooks: false,
        baseDir: testDir
      });
      
      expect(template.hooks).toEqual([]);
    });
    
    it('should use project type for folder structure', async () => {
      const testDir = createTestDir();
      await fs.mkdir(testDir, { recursive: true });
      
      const template = await generateProjectTemplate({
        projectName: 'test-project',
        projectType: 'node',
        baseDir: testDir
      });
      
      expect(template.type).toBe('node');
      expect(template.structure.folders).toContain('src');
      expect(template.structure.folders).toContain('tests');
    });
  });
  
  describe('initializeFromTemplate', () => {
    it('should initialize project from basic template', async () => {
      const testDir = createTestDir();
      const targetDir = path.join(testDir, 'new-project');
      
      const result = await initializeFromTemplate('basic', targetDir, {
        projectName: 'test-project'
      });
      
      expect(result.success).toBe(true);
      expect(result.projectName).toBe('test-project');
      expect(result.folders).toBeDefined();
    });
    
    it('should create folder structure', async () => {
      const testDir = createTestDir();
      const targetDir = path.join(testDir, 'new-project');
      
      await initializeFromTemplate('basic', targetDir);
      
      const opencodeDir = path.join(targetDir, '.opencode');
      const ctxDir = path.join(targetDir, '.opencode', 'context-session');
      
      const opencodeStat = await fs.stat(opencodeDir);
      const ctxStat = await fs.stat(ctxDir);
      
      expect(opencodeStat.isDirectory()).toBe(true);
      expect(ctxStat.isDirectory()).toBe(true);
    });
    
    it('should create opencode.json config', async () => {
      const testDir = createTestDir();
      const targetDir = path.join(testDir, 'new-project');
      
      await initializeFromTemplate('basic', targetDir);
      
      const configPath = path.join(targetDir, '.opencode', 'opencode.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config.opencode).toBeDefined();
      expect(config.opencode.contextSession).toBeDefined();
    });
    
    it('should create intelligence-learning.md file', async () => {
      const testDir = createTestDir();
      const targetDir = path.join(testDir, 'new-project');
      
      await initializeFromTemplate('basic', targetDir);
      
      const learningPath = path.join(targetDir, '.opencode', 'context-session', 'intelligence-learning.md');
      const content = await fs.readFile(learningPath, 'utf-8');
      
      expect(content).toContain('Intelligence Learning');
      expect(content).toContain('Project Structure Decisions');
    });
    
    it('should fail gracefully with non-existent template', async () => {
      const testDir = createTestDir();
      const targetDir = path.join(testDir, 'new-project');
      
      const result = await initializeFromTemplate('nonexistent-template', targetDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('listTemplates', () => {
    it('should list available templates', async () => {
      const templates = await listTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      const basic = templates.find(t => t.name === 'basic');
      expect(basic).toBeDefined();
      expect(basic.builtIn).toBe(true);
    });
    
    it('should include template metadata', async () => {
      const templates = await listTemplates();
      
      for (const template of templates) {
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.type).toBeDefined();
      }
    });
  });
  
  describe('getRecommendedTemplate', () => {
    it('should return webapp template for webapp type', async () => {
      const recommended = await getRecommendedTemplate('webapp');
      
      expect(recommended.name).toBe('webapp');
      expect(recommended.weight).toBe(10);
    });
    
    it('should return node template for node type', async () => {
      const recommended = await getRecommendedTemplate('node');
      
      expect(recommended.name).toBe('node');
      expect(recommended.weight).toBe(10);
    });
    
    it('should return basic template for generic type', async () => {
      const recommended = await getRecommendedTemplate('generic');
      
      expect(recommended.name).toBe('basic');
      expect(recommended.weight).toBe(5);
    });
  });
});

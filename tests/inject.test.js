/**
 * Inject Prompt Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock dependencies
jest.unstable_mockModule('../src/modules/contextInjector.js', () => ({
  getRelevantContexts: jest.fn(),
  formatForInjection: jest.fn(),
  injectContextPrompt: jest.fn(),
  selectContextsInteractively: jest.fn()
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => () => {}),
  debugLog: jest.fn(),
  debug: jest.fn()
}));

describe('handleInjectCommand() - help independência', () => {
  it('help retorna conteúdo correto independentemente de contexto', async () => {
    const { handleInjectCommand } = await import('../src/modules/injectHandler.js');
    const msg = { content: 'prior text /inject --help after text' };
    const result = await handleInjectCommand(msg, '/tmp');
    expect(result.content).toContain('/inject Help');
    expect(result.content).toContain('prior text');
    expect(result.content).toContain('after text');
  });
});

describe('parseInjectCommand()', () => {
  it('should parse /inject help', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject help');
    expect(result.isHelp).toBe(true);
    expect(result.isAll).toBe(false);
    expect(result.index).toBeNull();
  });

  it('should parse /inject -h', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject -h');
    expect(result.isHelp).toBe(true);
  });

  it('should parse /inject --help', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject --help');
    expect(result.isHelp).toBe(true);
  });

  it('should parse /inject 3', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject 3');
    expect(result.index).toBe(3);
    expect(result.isAll).toBe(false);
    expect(result.isHelp).toBe(false);
  });

  it('should parse /inject --all', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject --all');
    expect(result.isAll).toBe(true);
    expect(result.isHelp).toBe(false);
    expect(result.index).toBeNull();
  });

  it('should preserve text after /inject command', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject 3 tell me more about this');
    expect(result.index).toBe(3);
    expect(result.cleanContent).toBe('tell me more about this');
  });

  it('should return cleanContent with surrounding text', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('some text /inject --all more text');
    expect(result.isAll).toBe(true);
    expect(result.cleanContent).toBe('some text more text');
  });

  it('should return default for non-inject content', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('just a normal message');
    expect(result.isHelp).toBe(false);
    expect(result.isAll).toBe(false);
    expect(result.index).toBeNull();
    expect(result.cleanContent).toBe('just a normal message');
  });

  it('should handle multiple spaces before argument', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject     3');
    expect(result.index).toBe(3);
    expect(result.cleanContent).toBe('');
  });

  it('should handle tab characters', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject\t--all');
    expect(result.isAll).toBe(true);
  });

  it('should not match inject inside a word', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('reinject');
    expect(result.index).toBeNull();
    expect(result.isAll).toBe(false);
    expect(result.isHelp).toBe(false);
    expect(result.cleanContent).toBe('reinject');
  });

  it('should not match /injectable (partial match)', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/injectable docs');
    expect(result.index).toBeNull();
    expect(result.isAll).toBe(false);
    expect(result.isHelp).toBe(false);
    expect(result.cleanContent).toBe('/injectable docs');
  });

  it('should not match prefix/inject (no boundary before)', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('prefix/inject');
    expect(result.index).toBeNull();
    expect(result.isAll).toBe(false);
    expect(result.isHelp).toBe(false);
    expect(result.cleanContent).toBe('prefix/inject');
  });

  it('should handle /inject with only whitespace', async () => {
    const { parseInjectCommand } = await import('../src/modules/injectHandler.js');
    const result = parseInjectCommand('/inject   ');
    expect(result.index).toBeNull();
    expect(result.isAll).toBe(false);
    expect(result.isHelp).toBe(false);
  });
});

describe('injectPrompt Module', () => {
  let injectPrompt;
  let contextInjector;
  let mockContexts;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    // Import modules after mocking
    contextInjector = await import('../src/modules/contextInjector.js');
    injectPrompt = await import('../src/modules/injectPrompt.js');

    // Setup mock data
    mockContexts = [
      {
        context: { id: 'exit-2026-04-21T10-30-00', score: 8.72 },
        content: 'Session context showing bug fix for login issue',
        tokens: 245
      },
      {
        context: { id: 'compact-2026-04-20T14-20-00', score: 7.15 },
        content: 'Working on API endpoint validation',
        tokens: 189
      },
      {
        context: { id: 'exit-2026-04-19T09-15-00', score: 5.43 },
        content: 'Database migration planning',
        tokens: 312
      }
    ];
  });

  describe('listAvailableContexts', () => {
    it('should return formatted contexts with preview', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue(mockContexts);

      const session = { messages: [{ role: 'user', content: 'working on login' }] };
      const result = await injectPrompt.listAvailableContexts(session);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('exit-2026-04-21T10-30-00');
      expect(result[0].score).toBe(8.72);
      expect(result[0].tokens).toBe(245);
      expect(result[0].preview).toContain('...');
    });

    it('should return empty array when no contexts available', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue([]);

      const session = { messages: [] };
      const result = await injectPrompt.listAvailableContexts(session);

      expect(result).toEqual([]);
    });

    it('should respect maxContexts option', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue(mockContexts);

      const session = { messages: [] };
      await injectPrompt.listAvailableContexts(session, { maxContexts: 2 });

      expect(contextInjector.getRelevantContexts).toHaveBeenCalledWith(
        session,
        expect.objectContaining({ maxContexts: 2 })
      );
    });
  });

  describe('formatContextPreview', () => {
    it('should format contexts as numbered list', () => {
      const contexts = [
        { id: 'exit-2026-04-21T10-30-00', score: 8.72, tokens: 245, preview: 'Preview text 1...' },
        { id: 'compact-2026-04-20T14-20-00', score: 7.15, tokens: 189, preview: 'Preview text 2...' }
      ];

      const result = injectPrompt.formatContextPreview(contexts);

      expect(result).toContain('# Available Contexts');
      expect(result).toContain('1. [8.72] exit-2026-04-21T10-30-00 (245 tokens)');
      expect(result).toContain('Preview: Preview text 1...');
      expect(result).toContain('2. [7.15] compact-2026-04-20T14-20-00 (189 tokens)');
    });

    it('should handle empty contexts array', () => {
      const result = injectPrompt.formatContextPreview([]);
      expect(result).toContain('No relevant contexts found');
    });

    it('should handle null/undefined input', () => {
      const result1 = injectPrompt.formatContextPreview(null);
      const result2 = injectPrompt.formatContextPreview(undefined);
      expect(result1).toContain('No relevant contexts found');
      expect(result2).toContain('No relevant contexts found');
    });
  });

  describe('interactiveInject', () => {
    it('should inject specific contexts by index', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue(mockContexts);
      contextInjector.formatForInjection.mockReturnValue('## Formatted injection');

      const session = { messages: [] };
      const result = await injectPrompt.interactiveInject(session, [0, 2]);

      expect(contextInjector.getRelevantContexts).toHaveBeenCalled();
      expect(contextInjector.formatForInjection).toHaveBeenCalled();
      expect(result).toBe('## Formatted injection');
    });

    it('should inject top 5 contexts when no indices specified', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue(mockContexts);
      contextInjector.formatForInjection.mockReturnValue('## Default injection');

      const session = { messages: [] };
      const result = await injectPrompt.interactiveInject(session);

      expect(contextInjector.formatForInjection).toHaveBeenCalledWith(mockContexts.slice(0, 5));
      expect(result).toBe('## Default injection');
    });

    it('should handle empty selection', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue([]);

      const session = { messages: [] };
      const result = await injectPrompt.interactiveInject(session, [10, 20]);

      expect(result).toBe('No contexts selected for injection.');
    });

    it('should handle invalid indices gracefully', async () => {
      contextInjector.getRelevantContexts.mockResolvedValue(mockContexts);
      contextInjector.formatForInjection.mockReturnValue('## Injection');

      const session = { messages: [] };
      const result = await injectPrompt.interactiveInject(session, [-1, 100]);

      // Should return message about no valid contexts when all indices are invalid
      expect(result).toBe('No contexts selected for injection.');
    });
  });
});

describe('Index.js /inject Integration', () => {
  let tempDir;
  let ContextPlugin;
  let mockClient;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'inject-test-'));

    // Create mock context files
    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });
    await fs.writeFile(
      path.join(ctxDir, 'exit-2026-04-21.md'),
      '# Session Context\n\nTest content for injection'
    );

    // Mock saveContext
    jest.unstable_mockModule('../src/modules/saveContext.js', () => ({
      saveContext: jest.fn().mockResolvedValue('/path/to/file.md')
    }));

    // Mock config
    jest.unstable_mockModule('../src/config.js', () => ({
      loadConfig: jest.fn().mockResolvedValue({}),
      getConfig: jest.fn().mockReturnValue({}),
      LOG_FILE: path.join(tempDir, 'test.log'),
      CONTEXT_SESSION_DIR: '.opencode/context-session'
    }));

    // Import plugin
    const module = await import('../index.js');
    const createPlugin = module.default.server;
    ContextPlugin = createPlugin;

    mockClient = {
      sessions: {
        get: jest.fn().mockResolvedValue({ id: 'test-session', messages: [] })
      }
    };
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('experimental.chat.messages.transform', () => {
    it('should handle /inject command in user message', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      const messages = [
        { role: 'user', content: '/inject' }
      ];

      const result = await plugin['experimental.chat.messages.transform']({ messages });

      // The /inject command should be processed
      expect(result[0].content).toBeDefined();
    });

    it('should handle /inject N command for specific context', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      const messages = [
        { role: 'user', content: '/inject 1' }
      ];

      const result = await plugin['experimental.chat.messages.transform']({ messages });

      // Should show context preview or injection
      expect(result[0].content).toBeDefined();
    });

    it('should pass through messages without /inject', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      const originalContent = 'What files were modified yesterday?';
      const messages = [
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: originalContent }
      ];

      const result = await plugin['experimental.chat.messages.transform']({ messages });

      // Content should remain unchanged when /inject is not present and it's not first message
      expect(result[1].content).toBe(originalContent);
    });
  });
});
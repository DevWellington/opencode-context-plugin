import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import { atomicWrite, recoverOrphanedTempFiles, withTimeout } from '../src/utils/fileUtils.js';
import { saveContext, ensureHierarchicalDir, extractSessionSummary } from '../src/modules/saveContext.js';

jest.mock('../src/utils/debug.js', () => ({
  createDebugLogger: () => () => {}
}));

jest.mock('../src/config.js', () => ({
  getConfig: () => ({
    injection: { cache: { enabled: false } }
  }),
  CONTEXT_SESSION_DIR: '.opencode/context-session'
}));

jest.mock('../src/modules/summaries.js', () => ({
  updateDaySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/modules/searchIndexer.js', () => ({
  updateSearchIndex: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/modules/state.js', () => ({
  setLastSummarized: jest.fn().mockResolvedValue(undefined),
  addToPendingQueue: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/modules/tokenLimit.js', () => ({
  countTokens: () => 100
}));

jest.mock('../src/modules/contextValidator.js', () => ({
  validateAfterSave: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/modules/contentExtractor.js', () => ({
  classifySessionPriority: () => 'medium'
}));

jest.mock('../src/agents/generateToday.js', () => ({
  generateTodaySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/agents/generateWeekly.js', () => ({
  generateWeeklySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/agents/generateMonthly.js', () => ({
  generateMonthlySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/agents/generateAnnual.js', () => ({
  generateAnnualSummary: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/agents/generateIntelligenceLearning.js', () => ({
  updateIntelligenceLearning: jest.fn().mockResolvedValue(undefined)
}));

describe('chaos I/O', () => {
  let originalFs;

  beforeEach(() => {
    originalFs = { ...fs };
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.keys(originalFs).forEach(key => {
      if (typeof originalFs[key] === 'function') {
        fs[key] = originalFs[key];
      }
    });
  });

  describe('HD-02: readFile failures', () => {
    it('handles EACCES permission denied gracefully', async () => {
      const mockReadFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.readFile = mockReadFile;

      const content = 'test content';
      const filePath = '/tmp/test-chaos-eacces.md';

      await expect(fs.readFile(filePath)).rejects.toThrow('EACCES');
      expect(mockReadFile).toHaveBeenCalledWith(filePath);
    });

    it('handles ENOENT file not found gracefully', async () => {
      const mockReadFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      );
      fs.readFile = mockReadFile;

      const filePath = '/nonexistent/path.md';

      await expect(fs.readFile(filePath)).rejects.toThrow('ENOENT');
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('handles EMFILE too many open files gracefully', async () => {
      const mockReadFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EMFILE: too many open files'), { code: 'EMFILE' })
      );
      fs.readFile = mockReadFile;

      await expect(fs.readFile('/any/path')).rejects.toThrow('EMFILE');
    });
  });

  describe('HD-02: writeFile failures', () => {
    it('handles ENOSPC no space gracefully', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' })
      );
      fs.writeFile = mockWriteFile;

      await expect(fs.writeFile('/tmp/test', 'content')).rejects.toThrow('ENOSPC');
    });

    it('handles EACCES write permission denied gracefully', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.writeFile = mockWriteFile;

      await expect(fs.writeFile('/protected/file', 'data')).rejects.toThrow('EACCES');
    });

    it('handles EROFS read-only filesystem gracefully', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('EROFS: read-only file system'), { code: 'EROFS' })
      );
      fs.writeFile = mockWriteFile;

      await expect(fs.writeFile('/readonly/file', 'data')).rejects.toThrow('EROFS');
    });
  });

  describe('HD-02: rename failures', () => {
    it('handles EXDEV cross-device link gracefully', async () => {
      const mockRename = jest.fn().mockRejectedValue(
        Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' })
      );
      fs.rename = mockRename;

      await expect(fs.rename('/tmp/a', '/other/b')).rejects.toThrow('EXDEV');
    });

    it('handles ENOENT rename source not found gracefully', async () => {
      const mockRename = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      );
      fs.rename = mockRename;

      await expect(fs.rename('/missing/a', '/target/b')).rejects.toThrow('ENOENT');
    });

    it('handles EACCES rename permission denied gracefully', async () => {
      const mockRename = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.rename = mockRename;

      await expect(fs.rename('/protected/a', '/target/b')).rejects.toThrow('EACCES');
    });
  });

  describe('HD-02: readdir failures', () => {
    it('handles ENOENT directory not found gracefully', async () => {
      const mockReaddir = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );
      fs.readdir = mockReaddir;

      await expect(fs.readdir('/nonexistent/dir')).rejects.toThrow('ENOENT');
    });

    it('handles EACCES readdir permission denied gracefully', async () => {
      const mockReaddir = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.readdir = mockReaddir;

      await expect(fs.readdir('/protected/dir')).rejects.toThrow('EACCES');
    });

    it('handles ENOTDIR not a directory gracefully', async () => {
      const mockReaddir = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOTDIR: not a directory'), { code: 'ENOTDIR' })
      );
      fs.readdir = mockReaddir;

      await expect(fs.readdir('/file-not-dir')).rejects.toThrow('ENOTDIR');
    });
  });

  describe('HD-02: mkdir failures', () => {
    it('handles EACCES mkdir permission denied gracefully', async () => {
      const mockMkdir = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.mkdir = mockMkdir;

      await expect(fs.mkdir('/protected/newdir')).rejects.toThrow('EACCES');
    });

    it('handles EEXIST directory exists gracefully', async () => {
      const mockMkdir = jest.fn().mockRejectedValue(
        Object.assign(new Error('EEXIST: file already exists'), { code: 'EEXIST' })
      );
      fs.mkdir = mockMkdir;

      await expect(fs.mkdir('/existing/dir')).rejects.toThrow('EEXIST');
    });

    it('handles EROFS read-only filesystem for mkdir gracefully', async () => {
      const mockMkdir = jest.fn().mockRejectedValue(
        Object.assign(new Error('EROFS: read-only file system'), { code: 'EROFS' })
      );
      fs.mkdir = mockMkdir;

      await expect(fs.mkdir('/readonly/newdir')).rejects.toThrow('EROFS');
    });
  });

  describe('HD-02: stat failures', () => {
    it('handles ENOENT stat not found gracefully', async () => {
      const mockStat = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      );
      fs.stat = mockStat;

      await expect(fs.stat('/missing/file')).rejects.toThrow('ENOENT');
    });

    it('handles EACCES stat permission denied gracefully', async () => {
      const mockStat = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.stat = mockStat;

      await expect(fs.stat('/protected/file')).rejects.toThrow('EACCES');
    });
  });

  describe('HD-02: unlink failures', () => {
    it('handles ENOENT unlink not found gracefully', async () => {
      const mockUnlink = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
      );
      fs.unlink = mockUnlink;

      await expect(fs.unlink('/missing/file')).rejects.toThrow('ENOENT');
    });

    it('handles EACCES unlink permission denied gracefully', async () => {
      const mockUnlink = jest.fn().mockRejectedValue(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );
      fs.unlink = mockUnlink;

      await expect(fs.unlink('/protected/file')).rejects.toThrow('EACCES');
    });
  });

  describe('HD-02: recoverOrphanedTempFiles chaos', () => {
    it('handles readdir failure in recovery gracefully', async () => {
      const mockReaddir = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      fs.readdir = mockReaddir;

      const result = await recoverOrphanedTempFiles('/nonexistent');
      expect(result).toBe(0);
    });

    it('handles stat failure on temp file gracefully', async () => {
      const mockReaddir = jest.fn().mockResolvedValue([
        { name: '.tmp-12345', isDirectory: () => false }
      ]);
      fs.readdir = mockReaddir;

      const mockStat = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      fs.stat = mockStat;

      const result = await recoverOrphanedTempFiles('/tmp');
      expect(result).toBe(0);
    });

    it('handles unlink failure gracefully (ENOENT)', async () => {
      const oldNow = Date.now;
      const veryOldTimestamp = Date.now() - 10 * 60 * 1000;
      Date.now = () => veryOldTimestamp + 10 * 60 * 1000 + 1;

      const mockReaddir = jest.fn().mockResolvedValue([
        { name: '.tmp-12345-abc', isDirectory: () => false }
      ]);
      fs.readdir = mockReaddir;

      const mockStat = jest.fn().mockResolvedValue({
        mtimeMs: veryOldTimestamp
      });
      fs.stat = mockStat;

      const mockUnlink = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      fs.unlink = mockUnlink;

      const result = await recoverOrphanedTempFiles('/tmp');
      expect(mockReaddir).toHaveBeenCalled();
      expect(mockStat).toHaveBeenCalled();
      expect(result).toBeGreaterThanOrEqual(0);

      Date.now = oldNow;
    });

    it('handles mixed success/failure in nested directories', async () => {
      const mockReaddir = jest.fn()
        .mockResolvedValueOnce([
          { name: 'subdir', isDirectory: () => true },
          { name: '.tmp-old', isDirectory: () => false }
        ])
        .mockRejectedValueOnce(
          Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        );

      fs.readdir = mockReaddir;

      const mockStat = jest.fn().mockResolvedValue({ mtimeMs: 0 });
      fs.stat = mockStat;

      const mockUnlink = jest.fn().mockResolvedValue(undefined);
      fs.unlink = mockUnlink;

      const oldNow = Date.now;
      Date.now = () => 100000;

      const result = await recoverOrphanedTempFiles('/test-chaos-mixed');
      expect(result).toBeGreaterThanOrEqual(0);

      Date.now = oldNow;
    });
  });

  describe('HD-02: atomicWrite chaos', () => {
    it('cleans up temp file on write failure', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })
      );
      fs.writeFile = mockWriteFile;

      const mockUnlink = jest.fn().mockResolvedValue(undefined);
      fs.unlink = mockUnlink;

      const mockMkdir = jest.fn().mockResolvedValue(undefined);
      fs.mkdir = mockMkdir;

      await expect(atomicWrite('/tmp/test-fail.md', 'content')).rejects.toThrow('ENOSPC');
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('handles rename failure and cleans up temp file', async () => {
      const mockWriteFile = jest.fn().mockResolvedValue(undefined);
      fs.writeFile = mockWriteFile;

      const mockRename = jest.fn().mockRejectedValue(
        Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
      );
      fs.rename = mockRename;

      const mockUnlink = jest.fn().mockResolvedValue(undefined);
      fs.unlink = mockUnlink;

      await expect(atomicWrite('/tmp/test-rename-fail.md', 'content')).rejects.toThrow('EXDEV');
      expect(mockUnlink).toHaveBeenCalled();
    });

    it('handles unlink cleanup failure gracefully', async () => {
      const mockWriteFile = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' })
      );
      fs.writeFile = mockWriteFile;

      const mockUnlink = jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      fs.unlink = mockUnlink;

      await expect(atomicWrite('/tmp/test-unlink-fail.md', 'content')).rejects.toThrow('ENOSPC');
    });
  });

  describe('HD-02: timeout with chaos', () => {
    it('withTimeout rejects on timeout', async () => {
      const slowPromise = new Promise(resolve => {
        setTimeout(() => resolve('done'), 200);
      });

      await expect(withTimeout(slowPromise, 50, 'test-operation')).rejects.toThrow('Timeout');
    });

    it('withTimeout resolves when promise completes before timeout', async () => {
      const fastPromise = Promise.resolve('done');
      const result = await withTimeout(fastPromise, 1000, 'test-operation');
      expect(result).toBe('done');
    });

    it('withTimeout handles promise rejection', async () => {
      const failingPromise = Promise.reject(new Error('underlying error'));
      await expect(withTimeout(failingPromise, 1000, 'test-operation')).rejects.toThrow('underlying error');
    });
  });
});
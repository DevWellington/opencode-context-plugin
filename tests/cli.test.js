import { jest, describe, it, expect } from '@jest/globals';

describe('CLI - inject.js', () => {
  it('should export main function', async () => {
    const mod = await import('../src/cli/inject.js');
    expect(typeof mod.main).toBe('function');
  });
});

describe('CLI - report.js', () => {
  it('should export main function', async () => {
    const mod = await import('../src/cli/report.js');
    expect(typeof mod.main).toBe('function');
  });
});

describe('CLI - search.js', () => {
  it('should export main function', async () => {
    const mod = await import('../src/cli/search.js');
    expect(typeof mod.main).toBe('function');
  });
});

describe('CLI - crossProjectSearch.js', () => {
  it('should export main function', async () => {
    const mod = await import('../src/cli/crossProjectSearch.js');
    expect(typeof mod.main).toBe('function');
  });
});

describe('CLI - projectTemplate.js', () => {
  it('should export main function', async () => {
    const mod = await import('../src/cli/projectTemplate.js');
    expect(typeof mod.main).toBe('function');
  });
});

describe('CLI - search.js argument parsing', () => {
  it('should handle --help flag', async () => {
    const { main } = await import('../src/cli/search.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await main(['--help']);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe('CLI - report.js argument parsing', () => {
  it('should show help for unknown command', async () => {
    const { main } = await import('../src/cli/report.js');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await main(['--help']);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe('CLI - crossProjectSearch.js argument parsing', () => {
  it('should show help by default', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { main } = await import('../src/cli/crossProjectSearch.js');
    await main([]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

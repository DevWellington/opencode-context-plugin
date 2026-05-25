import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../src/modules/injectPrompt.js', () => ({
  listAvailableContexts: jest.fn().mockResolvedValue([]),
  formatContextPreview: jest.fn(),
  interactiveInject: jest.fn()
}));

describe('/inject help spy — P2', () => {
  let handleInjectCommand;
  let injectPrompt;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    handleInjectCommand = (await import('../src/modules/injectHandler.js')).handleInjectCommand;
    injectPrompt = await import('../src/modules/injectPrompt.js');
  });

  it('help não chama listAvailableContexts', async () => {
    const msg = { content: '/inject help' };
    await handleInjectCommand(msg, '/tmp');
    expect(injectPrompt.listAvailableContexts).not.toHaveBeenCalled();
  });

  it('-h também não chama listAvailableContexts', async () => {
    const msg = { content: '/inject -h' };
    await handleInjectCommand(msg, '/tmp');
    expect(injectPrompt.listAvailableContexts).not.toHaveBeenCalled();
  });

  it('--help também não chama listAvailableContexts', async () => {
    const msg = { content: '/inject --help' };
    await handleInjectCommand(msg, '/tmp');
    expect(injectPrompt.listAvailableContexts).not.toHaveBeenCalled();
  });

  it('/inject (sem help) chama listAvailableContexts', async () => {
    const msg = { content: '/inject' };
    await handleInjectCommand(msg, '/tmp');
    expect(injectPrompt.listAvailableContexts).toHaveBeenCalled();
  });
});

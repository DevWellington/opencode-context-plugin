import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const createOsMock = (homedirImpl) => ({
  default: { homedir: homedirImpl },
  homedir: homedirImpl
});

describe('getHomeDir', () => {
  let originalHome;

  beforeEach(() => {
    originalHome = process.env.HOME;
    delete process.env.HOME;
    jest.resetModules();
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    jest.resetModules();
  });

  it('returns process.env.HOME when set', async () => {
    process.env.HOME = '/custom/home';
    jest.unstable_mockModule('os', () => createOsMock(() => '/os/home'));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/custom/home');
  });

  it('returns os.homedir() when HOME is undefined', async () => {
    delete process.env.HOME;
    jest.unstable_mockModule('os', () => createOsMock(() => '/os/home'));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/os/home');
  });

  it('returns /tmp when both HOME and os.homedir() fail', async () => {
    delete process.env.HOME;
    jest.unstable_mockModule('os', () => createOsMock(() => null));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/tmp');
  });

  it('falls through to os.homedir() when HOME is empty string', async () => {
    process.env.HOME = '';
    jest.unstable_mockModule('os', () => createOsMock(() => '/os/home'));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/os/home');
  });

  it('returns /tmp when os.homedir() throws error', async () => {
    delete process.env.HOME;
    jest.unstable_mockModule('os', () => createOsMock(() => { throw new Error('os.homedir failed'); }));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/tmp');
  });

  it('returns /tmp when os.homedir() returns undefined', async () => {
    delete process.env.HOME;
    jest.unstable_mockModule('os', () => createOsMock(() => undefined));
    const { getHomeDir } = await import('../src/utils/homeDir.js');
    expect(getHomeDir()).toBe('/tmp');
  });
});
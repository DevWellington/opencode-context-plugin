import os from 'os';

export function getHomeDir() {
  if (process.env.HOME) return process.env.HOME;
  try {
    return os.homedir() || '/tmp';
  } catch {
    return '/tmp';
  }
}

import os from 'os';

export function getHomeDir() {
  const home = process.env.HOME || process.env.USERPROFILE || (() => {
    try {
      return os.homedir();
    } catch {
      return null;
    }
  })();

  if (home) return home;

  console.warn('[homeDir] WARNING: Could not determine home directory. Using /tmp as fallback. Global intelligence and sync state may be stored in a non-standard location.');
  return '/tmp';
}

import os from 'os';

let warned = false;

export function getHomeDir() {
  const home = process.env.HOME || process.env.USERPROFILE || (() => {
    try {
      return os.homedir();
    } catch {
      return null;
    }
  })();

  if (home) return home;

  if (!warned) {
    warned = true;
    process.stderr.write('[homeDir] WARNING: Could not determine home directory. Using /tmp.\n');
  }
  return '/tmp';
}

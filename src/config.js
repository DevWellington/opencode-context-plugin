import fs from "fs/promises";
import path from "path";

const LOG_FILE = path.join(process.env.HOME || '', '.opencode-context-plugin.log');
const CONTEXT_SESSION_DIR = '.opencode/context-session';

// Default configuration
export const defaultConfig = {
  maxContexts: 5,
  enableLearning: true,
  logLevel: 'info',
  debug: false,
  debounceMs: 500,
  logRotation: {
    enabled: true,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  },
  injection: {
    enabled: false,
    autoInject: false,
    maxContexts: 5,
    maxTokens: 8000,
    relevanceScoring: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKeyEnv: 'OPENAI_API_KEY'
    },
    cache: {
      enabled: true,
      ttlHours: 24,
      maxSizeMB: 50
    }
  },
  search: {
    enabled: true,
    indexOnStartup: false,
    maxResults: 20,
    snippetLength: 200
  }
};

// Internal config storage
let currentConfig = { ...defaultConfig };

/**
 * Load configuration from opencode.json in the project directory
 * Merges with defaults and handles missing file gracefully
 */
export async function loadConfig(directory) {
  const configPath = path.join(directory, 'opencode.json');
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content);
    
    // Extract contextPlugin section if present
    const pluginConfig = userConfig.contextPlugin || userConfig;
    
    // Merge with defaults
    currentConfig = {
      ...defaultConfig,
      ...pluginConfig
    };
    
    // Debug log configuration loading
    try {
      const timestamp = new Date().toISOString();
      await fs.appendFile(LOG_FILE, `[${timestamp}] [config] Configuration loaded from ${configPath}\n`).catch(() => {});
    } catch {}
    
    return currentConfig;
  } catch (error) {
    // File doesn't exist - use defaults
    try {
      const timestamp = new Date().toISOString();
      await fs.appendFile(LOG_FILE, `[${timestamp}] [config] Using default configuration (no opencode.json found)\n`).catch(() => {});
    } catch {}
    
    currentConfig = { ...defaultConfig };
    return currentConfig;
  }
}

/**
 * Get the current configuration
 */
export function getConfig() {
  return { ...currentConfig };
}

export { LOG_FILE, CONTEXT_SESSION_DIR };

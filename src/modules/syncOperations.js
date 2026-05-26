import fs from "fs/promises";
import path from "path";
import { createDebugLogger } from '../utils/debug.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { getGlobalIntelligencePath } from '../utils/globalIntelligence.js';
import { loadSyncState, saveSyncState, getDefaultSyncState } from './syncState.js';
import { RemoteSyncProvider, S3SyncProvider, GCSyncProvider, CustomSyncProvider } from './syncProviders.js';
import { getHomeDir } from '../utils/homeDir.js';
import { withSerialQueue } from '../utils/serialQueue.js';
import { isExpectedFsError } from '../utils/errorUtils.js';

const logger = createDebugLogger('remote-sync');

// Configuration file path - can be overridden for testing
let CONFIG_PATH = path.join(getHomeDir(), '.opencode', '.config', 'remote.json');

export function setConfigPath(newPath) {
  CONFIG_PATH = newPath;
}

export function getConfigPath() {
  return CONFIG_PATH;
}

// Internal state with serialization lock for concurrent access
let syncState = { ...getDefaultSyncState() };
let currentProvider = null;
let currentConfig = null;

/**
 * Configure remote sync with provider and credentials
 * 
 * @param {string} provider - Provider type: "s3", "gcs", "custom"
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Configuration result
 */
export async function configureRemoteSync(provider, config, deps = {}) {
  return withSerialQueue(async () => {
    logger(`[RemoteSync] Configuring provider: ${provider}`);

    if (!provider || !['s3', 'gcs', 'custom'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}. Must be "s3", "gcs", or "custom"`);
    }

    // Validate required config fields
    if (provider === 's3' && !config?.bucket) {
      throw new Error('S3 provider requires bucket configuration');
    }
    if (provider === 'gcs' && !config?.bucket) {
      throw new Error('GCS provider requires bucket configuration');
    }
    if (provider === 'custom' && !config?.endpoint) {
      throw new Error('Custom provider requires endpoint configuration');
    }

    // Create provider instance
    let providerInstance;
    switch (provider) {
      case 's3':
        providerInstance = new S3SyncProvider(config, deps);
        break;
      case 'gcs':
        providerInstance = new GCSyncProvider(config, deps);
        break;
      case 'custom':
        providerInstance = new CustomSyncProvider(config, deps);
        break;
    }

    // Test connection before saving
    const testResult = await providerInstance.testConnection();
    if (!testResult.success) {
      logger(`[RemoteSync] Connection test failed: ${testResult.error}`);
      // Don't throw - allow configuration even if connection fails initially
    }

    // Save config (without sensitive credentials in plain text)
    const configToSave = {
      provider,
      bucket: config.bucket,
      prefix: config.prefix,
      endpoint: config.endpoint,
      region: config.region,
      projectId: config.projectId,
      method: config.method,
      headers: config.headers,
      // Note: credentials are not stored directly - user should use env vars or external config
      credentials: {}
    };

    try {
      const dir = path.dirname(CONFIG_PATH);
      await fs.mkdir(dir, { recursive: true });
      const configBaseDir = path.dirname(CONFIG_PATH);
      await atomicWrite(CONFIG_PATH, JSON.stringify(configToSave, null, 2), configBaseDir);
    } catch (error) {
      logger(`[RemoteSync] Failed to save config: ${error.message}`);
      throw error;
    }

    // Update state
    currentProvider = providerInstance;
    currentConfig = config;
    syncState.configured = true;
    await saveSyncState(syncState);

    logger(`[RemoteSync] Configuration saved successfully for ${provider}`);

    return {
      success: true,
      provider,
      connectionTested: testResult.success,
      message: testResult.success 
        ? `Connected to ${provider} successfully`
        : `Configured for ${provider} but connection test failed`
    };
  });
}

/**
 * Get the current sync status
 * 
 * @returns {Promise<Object>} Current sync status
 */
export async function getSyncStatus() {
  const loaded = await loadSyncState();
  
  return {
    configured: loaded.configured,
    lastSync: loaded.lastSync,
    pendingChanges: loaded.pendingChanges,
    errors: loaded.errors.slice(-5) // Last 5 errors
  };
}

/**
 * Sync directory contents to remote storage
 * 
 * @param {string} directory - Directory to sync
 * @returns {Promise<Object>} Sync result
 */
export async function syncToRemote(directory) {
  return withSerialQueue(async () => {
    if (!currentProvider) {
      const loaded = await loadSyncState();
      if (!loaded.configured) {
        return { success: false, error: 'Remote sync not configured', uploaded: 0, failed: 0, errors: [] };
      }
      // Try to load from saved config
      try {
        const savedConfig = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
        switch (savedConfig.provider) {
          case 's3':
            currentProvider = new S3SyncProvider(savedConfig);
            break;
          case 'gcs':
            currentProvider = new GCSyncProvider(savedConfig);
            break;
          case 'custom':
            currentProvider = new CustomSyncProvider(savedConfig);
            break;
        }
      } catch (err) {
        if (!isExpectedFsError(err)) {
          logger(`[RemoteSync] Failed to load saved config: ${err.message}`);
        }
        return { success: false, error: 'Failed to load remote sync configuration', uploaded: 0, failed: 0, errors: [] };
      }
    }

    logger(`[RemoteSync] Syncing directory: ${directory}`);

    const result = {
      success: false,
      uploaded: 0,
      failed: 0,
      errors: []
    };

    try {
      // Read global intelligence file
      const globalIntelPath = getGlobalIntelligencePath();
      let content;
      try {
        content = await fs.readFile(globalIntelPath, 'utf-8');
      } catch (err) {
        if (!isExpectedFsError(err)) {
          logger(`[RemoteSync] Failed to read global intelligence: ${err.message}`);
        }
        content = '# Global Intelligence\n\nNo content to sync';
      }

      // Push to remote
      const pushResult = await currentProvider.push(content);
      result.success = pushResult.success;
      if (pushResult.success) {
        result.uploaded = 1;
        syncState.lastSync = new Date().toISOString();
        syncState.pendingChanges = false;
      } else {
        result.failed = 1;
        result.errors.push('Push failed');
        syncState.errors.push(`Sync failed: ${pushResult.error || 'Unknown error'}`);
      }

      await saveSyncState(syncState);
      logger(`[RemoteSync] Sync completed: ${result.uploaded} uploaded, ${result.failed} failed`);

    } catch (error) {
      logger(`[RemoteSync] Sync error: ${error.message}`);
      result.errors.push(error.message);
      syncState.errors.push(error.message);
      await saveSyncState(syncState);
    }

    return result;
  });
}

/**
 * Sync global intelligence file to remote storage
 * This is a convenience function for syncing just the global intelligence file
 * 
 * @returns {Promise<Object>} Sync result
 */
export async function syncGlobalIntelligence() {
  return syncToRemote('.opencode');
}

/**
 * Mark pending changes (call after local updates)
 */
export async function markPendingChanges() {
  return withSerialQueue(async () => {
    syncState.pendingChanges = true;
    await saveSyncState(syncState);
    logger(`[RemoteSync] Pending changes marked`);
  });
}

/**
 * Initialize remote sync module
 */
export async function initializeRemoteSync() {
  const loaded = await loadSyncState();
  logger(`[RemoteSync] Initialized - configured: ${loaded.configured}`);
  return loaded.configured;
}

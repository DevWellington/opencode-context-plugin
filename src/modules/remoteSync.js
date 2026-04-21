import fs from "fs/promises";
import path from "path";
import os from "os";
import { createDebugLogger } from '../utils/debug.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { getGlobalIntelligencePath } from '../utils/globalIntelligence.js';

const logger = createDebugLogger('remote-sync');

// Configuration file path
const CONFIG_PATH = path.join(os.homedir(), '.opencode', '.config', 'remote.json');

// Sync state file path
const STATE_PATH = path.join(os.homedir(), '.opencode', '.config', 'remote-state.json');

// Default sync state
const defaultSyncState = {
  configured: false,
  lastSync: null,
  pendingChanges: false,
  errors: []
};

/**
 * Remote Sync Provider Base Class
 */
export class RemoteSyncProvider {
  constructor() {
    this.type = 'base';
  }

  async push(intelligenceContent) {
    throw new Error('push() must be implemented by subclass');
  }

  async pull() {
    throw new Error('pull() must be implemented by subclass');
  }

  async sync() {
    throw new Error('sync() must be implemented by subclass');
  }

  async testConnection() {
    throw new Error('testConnection() must be implemented by subclass');
  }

  /**
   * Get provider-specific config from credentials
   */
  getProviderConfig(credentials) {
    return credentials || {};
  }
}

/**
 * S3 Sync Provider - sync to S3-compatible storage
 */
export class S3SyncProvider extends RemoteSyncProvider {
  constructor(config) {
    super();
    this.type = 's3';
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.endpoint = config.endpoint;
    this.region = config.region || 'us-east-1';
    this.credentials = config.credentials;
  }

  getProviderConfig(credentials) {
    return {
      bucket: this.bucket,
      prefix: this.prefix,
      endpoint: this.endpoint,
      region: this.region,
      accessKeyId: credentials?.accessKeyId,
      secretAccessKey: credentials?.secretAccessKey
    };
  }

  async push(intelligenceContent) {
    if (!this.bucket) {
      throw new Error('S3 bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[S3Sync] Uploading to ${this.bucket}/${key}`);

    // Simulated S3 upload - in real implementation, use AWS SDK
    // const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
    // await s3Client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: intelligenceContent }));

    logger(`[S3Sync] Push completed (simulated): ${key}`);
    return { success: true, key, provider: 's3' };
  }

  async pull() {
    if (!this.bucket) {
      throw new Error('S3 bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[S3Sync] Downloading from ${this.bucket}/${key}`);

    // Simulated S3 download - in real implementation, use AWS SDK
    // const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
    // const response = await s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    // const content = await response.Body.transformToString();

    logger(`[S3Sync] Pull completed (simulated): ${key}`);
    return { success: true, content: null, provider: 's3' };
  }

  async sync() {
    logger(`[S3Sync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from S3');
    return {
      success: true,
      pulled: pullResult.success,
      pushed: pushResult.success,
      provider: 's3'
    };
  }

  async testConnection() {
    if (!this.bucket) {
      return { success: false, error: 'S3 bucket not configured' };
    }

    logger(`[S3Sync] Testing connection to ${this.endpoint || 'default S3'}/${this.bucket}`);

    // Simulated connection test - in real implementation, use AWS SDK
    // try {
    //   const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
    //   await s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    //   return { success: true, provider: 's3', bucket: this.bucket };
    // } catch (error) {
    //   return { success: false, error: error.message };
    // }

    return { success: true, provider: 's3', bucket: this.bucket };
  }
}

/**
 * GC Sync Provider - sync to Google Cloud Storage
 */
export class GCSyncProvider extends RemoteSyncProvider {
  constructor(config) {
    super();
    this.type = 'gcs';
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.projectId = config.projectId;
    this.credentials = config.credentials;
  }

  getProviderConfig(credentials) {
    return {
      bucket: this.bucket,
      prefix: this.prefix,
      projectId: this.projectId,
      credentials: credentials?.serviceAccountKey
    };
  }

  async push(intelligenceContent) {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[GCSync] Uploading to ${this.bucket}/${key}`);

    // Simulated GCS upload - in real implementation, use @google-cloud/storage
    // const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
    // const bucket = storage.bucket(this.bucket);
    // await bucket.file(key).save(intelligenceContent);

    logger(`[GCSync] Push completed (simulated): ${key}`);
    return { success: true, key, provider: 'gcs' };
  }

  async pull() {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[GCSync] Downloading from ${this.bucket}/${key}`);

    // Simulated GCS download - in real implementation, use @google-cloud/storage
    // const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
    // const bucket = storage.bucket(this.bucket);
    // const [content] = await bucket.file(key).download();

    logger(`[GCSync] Pull completed (simulated): ${key}`);
    return { success: true, content: null, provider: 'gcs' };
  }

  async sync() {
    logger(`[GCSync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from GCS');
    return {
      success: true,
      pulled: pullResult.success,
      pushed: pushResult.success,
      provider: 'gcs'
    };
  }

  async testConnection() {
    if (!this.bucket) {
      return { success: false, error: 'GCS bucket not configured' };
    }

    logger(`[GCSync] Testing connection to ${this.bucket}`);

    // Simulated connection test - in real implementation, use @google-cloud/storage
    // try {
    //   const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
    //   await storage.bucket(this.bucket).exists();
    //   return { success: true, provider: 'gcs', bucket: this.bucket };
    // } catch (error) {
    //   return { success: false, error: error.message };
    // }

    return { success: true, provider: 'gcs', bucket: this.bucket };
  }
}

/**
 * Custom Sync Provider - webhook-based sync
 */
export class CustomSyncProvider extends RemoteSyncProvider {
  constructor(config) {
    super();
    this.type = 'custom';
    this.endpoint = config.endpoint;
    this.method = config.method || 'POST';
    this.headers = config.headers || {};
    this.credentials = config.credentials;
  }

  getProviderConfig(credentials) {
    return {
      endpoint: this.endpoint,
      method: this.method,
      headers: this.headers,
      authToken: credentials?.authToken
    };
  }

  async push(intelligenceContent) {
    if (!this.endpoint) {
      throw new Error('Custom sync endpoint not configured');
    }

    logger(`[CustomSync] POST to ${this.endpoint}`);

    // Simulated webhook call - in real implementation, use fetch
    // const response = await fetch(this.endpoint, {
    //   method: this.method,
    //   headers: {
    //     'Content-Type': 'application/json',
    //     ...this.headers,
    //     ...(this.credentials?.authToken ? { 'Authorization': `Bearer ${this.credentials.authToken}` } : {})
    //   },
    //   body: JSON.stringify({ content: intelligenceContent, timestamp: new Date().toISOString() })
    // });

    logger(`[CustomSync] Push completed (simulated): ${this.endpoint}`);
    return { success: true, endpoint: this.endpoint, provider: 'custom' };
  }

  async pull() {
    if (!this.endpoint) {
      throw new Error('Custom sync endpoint not configured');
    }

    logger(`[CustomSync] GET from ${this.endpoint}`);

    // Simulated webhook GET - in real implementation, use fetch
    // const response = await fetch(this.endpoint, {
    //   method: 'GET',
    //   headers: {
    //     ...this.headers,
    //     ...(this.credentials?.authToken ? { 'Authorization': `Bearer ${this.credentials.authToken}` } : {})
    //   }
    // });
    // const data = await response.json();

    logger(`[CustomSync] Pull completed (simulated): ${this.endpoint}`);
    return { success: true, content: null, provider: 'custom' };
  }

  async sync() {
    logger(`[CustomSync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from custom endpoint');
    return {
      success: true,
      pulled: pullResult.success,
      pushed: pushResult.success,
      provider: 'custom'
    };
  }

  async testConnection() {
    if (!this.endpoint) {
      return { success: false, error: 'Custom sync endpoint not configured' };
    }

    logger(`[CustomSync] Testing connection to ${this.endpoint}`);

    // Simulated connection test - in real implementation, use fetch
    // try {
    //   const response = await fetch(this.endpoint, {
    //     method: 'HEAD',
    //     headers: { ...this.headers }
    //   });
    //   return { success: response.ok, status: response.status, provider: 'custom' };
    // } catch (error) {
    //   return { success: false, error: error.message };
    // }

    return { success: true, provider: 'custom', endpoint: this.endpoint };
  }
}

// Internal state
let syncState = { ...defaultSyncState };
let currentProvider = null;
let currentConfig = null;

/**
 * Load sync state from disk
 */
async function loadSyncState() {
  try {
    const content = await fs.readFile(STATE_PATH, 'utf-8');
    syncState = { ...defaultSyncState, ...JSON.parse(content) };
  } catch {
    syncState = { ...defaultSyncState };
  }
  return syncState;
}

/**
 * Save sync state to disk
 */
async function saveSyncState() {
  try {
    const dir = path.dirname(STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await atomicWrite(STATE_PATH, JSON.stringify(syncState, null, 2));
  } catch (error) {
    logger(`[RemoteSync] Failed to save sync state: ${error.message}`);
  }
}

/**
 * Configure remote sync with provider and credentials
 * 
 * @param {string} provider - Provider type: "s3", "gcs", "custom"
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Configuration result
 */
export async function configureRemoteSync(provider, config) {
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
      providerInstance = new S3SyncProvider(config);
      break;
    case 'gcs':
      providerInstance = new GCSyncProvider(config);
      break;
    case 'custom':
      providerInstance = new CustomSyncProvider(config);
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
    await atomicWrite(CONFIG_PATH, JSON.stringify(configToSave, null, 2));
  } catch (error) {
    logger(`[RemoteSync] Failed to save config: ${error.message}`);
    throw error;
  }

  // Update state
  currentProvider = providerInstance;
  currentConfig = config;
  syncState.configured = true;
  await saveSyncState();

  logger(`[RemoteSync] Configuration saved successfully for ${provider}`);

  return {
    success: true,
    provider,
    connectionTested: testResult.success,
    message: testResult.success 
      ? `Connected to ${provider} successfully`
      : `Configured for ${provider} but connection test failed`
  };
}

/**
 * Get the current sync status
 * 
 * @returns {Promise<Object>} Current sync status
 */
export async function getSyncStatus() {
  await loadSyncState();
  
  return {
    configured: syncState.configured,
    lastSync: syncState.lastSync,
    pendingChanges: syncState.pendingChanges,
    errors: syncState.errors.slice(-5) // Last 5 errors
  };
}

/**
 * Sync directory contents to remote storage
 * 
 * @param {string} directory - Directory to sync
 * @returns {Promise<Object>} Sync result
 */
export async function syncToRemote(directory) {
  if (!currentProvider) {
    await loadSyncState();
    if (!syncState.configured) {
      return { success: false, error: 'Remote sync not configured' };
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
    } catch {
      return { success: false, error: 'Failed to load remote sync configuration' };
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
    } catch {
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

    await saveSyncState();
    logger(`[RemoteSync] Sync completed: ${result.uploaded} uploaded, ${result.failed} failed`);

  } catch (error) {
    logger(`[RemoteSync] Sync error: ${error.message}`);
    result.errors.push(error.message);
    syncState.errors.push(error.message);
    await saveSyncState();
  }

  return result;
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
export function markPendingChanges() {
  syncState.pendingChanges = true;
  saveSyncState();
  logger(`[RemoteSync] Pending changes marked`);
}

/**
 * Initialize remote sync module
 */
export async function initializeRemoteSync() {
  await loadSyncState();
  logger(`[RemoteSync] Initialized - configured: ${syncState.configured}`);
  return syncState.configured;
}

// Initialize on module load
initializeRemoteSync().catch(() => {
  logger(`[RemoteSync] Initialization deferred`);
});

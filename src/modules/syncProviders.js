import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('remote-sync');

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
  constructor(config, deps = {}) {
    super();
    this.type = 's3';
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.endpoint = config.endpoint;
    this.region = config.region || 'us-east-1';
    this.credentials = config.credentials;
    this._getS3 = deps.getS3 || (() => import('@aws-sdk/client-s3').then(m => ({ S3Client: m.S3Client, PutObjectCommand: m.PutObjectCommand, GetObjectCommand: m.GetObjectCommand, HeadBucketCommand: m.HeadBucketCommand })));
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

    try {
      const { S3Client, PutObjectCommand } = await this._getS3();
      const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
      await s3Client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: intelligenceContent }));
      logger(`[S3Sync] Push completed: ${key}`);
      return { success: true, key, provider: 's3' };
    } catch (error) {
      logger(`[S3Sync] Push failed: ${error.message}`);
      return { success: false, error: error.message, key, provider: 's3' };
    }
  }

  async pull() {
    if (!this.bucket) {
      throw new Error('S3 bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[S3Sync] Downloading from ${this.bucket}/${key}`);

    try {
      const { S3Client, GetObjectCommand } = await this._getS3();
      const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
      const response = await s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const content = await response.Body.transformToString();
      logger(`[S3Sync] Pull completed: ${key}`);
      return { success: true, content, provider: 's3' };
    } catch (error) {
      logger(`[S3Sync] Pull failed: ${error.message}`);
      return { success: false, error: error.message, provider: 's3' };
    }
  }

  async sync() {
    logger(`[S3Sync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from S3');
    return {
      success: pullResult.success && pushResult.success,
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

    try {
      const { S3Client, HeadBucketCommand } = await this._getS3();
      const s3Client = new S3Client({ region: this.region, credentials: this.credentials });
      await s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      logger(`[S3Sync] Connection successful: ${this.bucket}`);
      return { success: true, provider: 's3', bucket: this.bucket };
    } catch (error) {
      logger(`[S3Sync] Connection failed: ${error.message}`);
      return { success: false, error: error.message, provider: 's3', bucket: this.bucket };
    }
  }
}

/**
 * GC Sync Provider - sync to Google Cloud Storage
 */
export class GCSyncProvider extends RemoteSyncProvider {
  constructor(config, deps = {}) {
    super();
    this.type = 'gcs';
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
    this.projectId = config.projectId;
    this.credentials = config.credentials;
    this._getStorage = deps.getStorage || (() => import('@google-cloud/storage').then(m => ({ Storage: m.Storage })));
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

    try {
      const { Storage } = await this._getStorage();
      const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
      await storage.bucket(this.bucket).file(key).save(intelligenceContent);
      logger(`[GCSync] Push completed: ${key}`);
      return { success: true, key, provider: 'gcs' };
    } catch (error) {
      logger(`[GCSync] Push failed: ${error.message}`);
      return { success: false, error: error.message, key, provider: 'gcs' };
    }
  }

  async pull() {
    if (!this.bucket) {
      throw new Error('GCS bucket not configured');
    }

    const key = `${this.prefix}global-intelligence.md`.replace(/^\//, '');
    logger(`[GCSync] Downloading from ${this.bucket}/${key}`);

    try {
      const { Storage } = await this._getStorage();
      const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
      const [content] = await storage.bucket(this.bucket).file(key).download();
      const text = content.toString('utf-8');
      logger(`[GCSync] Pull completed: ${key}`);
      return { success: true, content: text, provider: 'gcs' };
    } catch (error) {
      logger(`[GCSync] Pull failed: ${error.message}`);
      return { success: false, error: error.message, provider: 'gcs' };
    }
  }

  async sync() {
    logger(`[GCSync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from GCS');
    return {
      success: pullResult.success && pushResult.success,
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

    try {
      const { Storage } = await this._getStorage();
      const storage = new Storage({ projectId: this.projectId, credentials: this.credentials });
      const [exists] = await storage.bucket(this.bucket).exists();
      if (!exists) {
        return { success: false, error: 'Bucket does not exist', provider: 'gcs', bucket: this.bucket };
      }
      logger(`[GCSync] Connection successful: ${this.bucket}`);
      return { success: true, provider: 'gcs', bucket: this.bucket };
    } catch (error) {
      logger(`[GCSync] Connection failed: ${error.message}`);
      return { success: false, error: error.message, provider: 'gcs', bucket: this.bucket };
    }
  }
}

/**
 * Custom Sync Provider - webhook-based sync
 */
export class CustomSyncProvider extends RemoteSyncProvider {
  constructor(config, deps = {}) {
    super();
    this.type = 'custom';
    this.endpoint = config.endpoint;
    this.method = config.method || 'POST';
    this.headers = config.headers || {};
    this.credentials = config.credentials;
    this._fetch = deps.fetch || globalThis.fetch;

    if (this.endpoint) {
      this._validateEndpoint(this.endpoint);
    }
  }

  _validateEndpoint(endpoint) {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') {
        throw new Error(`Custom sync endpoint must use HTTPS. Got: ${url.protocol}`);
      }
      return true;
    } catch (err) {
      if (err.code === 'ERR_INVALID_URL') {
        throw new Error(`Invalid endpoint URL: ${endpoint}`);
      }
      throw err;
    }
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

    logger(`[CustomSync] ${this.method} to ${this.endpoint}`);

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...this.headers,
        ...(this.credentials?.authToken ? { 'Authorization': `Bearer ${this.credentials.authToken}` } : {})
      };

      const body = JSON.stringify({ content: intelligenceContent, timestamp: new Date().toISOString() });

      const response = await this._fetch(this.endpoint, {
        method: this.method,
        headers,
        body
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger(`[CustomSync] Push completed: ${this.endpoint}`);
      return { success: true, key: this.endpoint, provider: 'custom' };
    } catch (error) {
      logger(`[CustomSync] Push failed: ${error.message}`);
      return { success: false, error: error.message, key: this.endpoint, provider: 'custom' };
    }
  }

  async pull() {
    if (!this.endpoint) {
      throw new Error('Custom sync endpoint not configured');
    }

    logger(`[CustomSync] GET from ${this.endpoint}`);

    try {
      const headers = {
        ...this.headers,
        ...(this.credentials?.authToken ? { 'Authorization': `Bearer ${this.credentials.authToken}` } : {})
      };

      const response = await this._fetch(this.endpoint, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      logger(`[CustomSync] Pull completed: ${this.endpoint}`);
      return { success: true, content, provider: 'custom' };
    } catch (error) {
      logger(`[CustomSync] Pull failed: ${error.message}`);
      return { success: false, error: error.message, provider: 'custom' };
    }
  }

  async sync() {
    logger(`[CustomSync] Bidirectional sync initiated`);
    const pullResult = await this.pull();
    const pushResult = await this.push('# Global Intelligence\nSynced from custom endpoint');
    return {
      success: pullResult.success && pushResult.success,
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

    try {
      const headers = {
        ...this.headers,
        ...(this.credentials?.authToken ? { 'Authorization': `Bearer ${this.credentials.authToken}` } : {})
      };

      const response = await this._fetch(this.endpoint, {
        method: 'HEAD',
        headers
      });

      logger(`[CustomSync] Connection successful: ${this.endpoint}`);
      return { success: response.ok, provider: 'custom', endpoint: this.endpoint };
    } catch (error) {
      logger(`[CustomSync] Connection failed: ${error.message}`);
      return { success: false, error: error.message, provider: 'custom', endpoint: this.endpoint };
    }
  }
}

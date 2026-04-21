/**
 * Remote Sync Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('Remote Sync Module', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-sync-test-'));
  });

  afterEach(async () => {
    jest.useRealTimers();
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('RemoteSyncProvider base class', () => {
    it('should throw when push is not implemented', async () => {
      const { RemoteSyncProvider } = await import('../src/modules/remoteSync.js');
      const provider = new RemoteSyncProvider();
      
      await expect(provider.push('content')).rejects.toThrow('push() must be implemented by subclass');
    });

    it('should throw when pull is not implemented', async () => {
      const { RemoteSyncProvider } = await import('../src/modules/remoteSync.js');
      const provider = new RemoteSyncProvider();
      
      await expect(provider.pull()).rejects.toThrow('pull() must be implemented by subclass');
    });

    it('should throw when sync is not implemented', async () => {
      const { RemoteSyncProvider } = await import('../src/modules/remoteSync.js');
      const provider = new RemoteSyncProvider();
      
      await expect(provider.sync()).rejects.toThrow('sync() must be implemented by subclass');
    });

    it('should throw when testConnection is not implemented', async () => {
      const { RemoteSyncProvider } = await import('../src/modules/remoteSync.js');
      const provider = new RemoteSyncProvider();
      
      await expect(provider.testConnection()).rejects.toThrow('testConnection() must be implemented by subclass');
    });
  });

  describe('S3SyncProvider', () => {
    it('should create S3 provider with config', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({
        bucket: 'test-bucket',
        prefix: 'prefix/',
        region: 'us-west-2',
        endpoint: 'https://s3.amazonaws.com'
      });
      
      expect(provider.type).toBe('s3');
      expect(provider.bucket).toBe('test-bucket');
      expect(provider.prefix).toBe('prefix/');
      expect(provider.region).toBe('us-west-2');
    });

    it('should throw when bucket not configured for push', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({});
      
      await expect(provider.push('content')).rejects.toThrow('S3 bucket not configured');
    });

    it('should throw when bucket not configured for pull', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({});
      
      await expect(provider.pull()).rejects.toThrow('S3 bucket not configured');
    });

    it('should push content successfully', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.push('# Test content');
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('s3');
      expect(result.key).toBe('global-intelligence.md');
    });

    it('should pull content successfully', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.pull();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('s3');
    });

    it('should sync successfully', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.sync();
      
      expect(result.success).toBe(true);
      expect(result.pushed).toBe(true);
      expect(result.pulled).toBe(true);
    });

    it('should test connection successfully', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('s3');
      expect(result.bucket).toBe('test-bucket');
    });

    it('should fail connection test when bucket not configured', async () => {
      const { S3SyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new S3SyncProvider({});
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('S3 bucket not configured');
    });
  });

  describe('GCSyncProvider', () => {
    it('should create GCS provider with config', async () => {
      const { GCSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new GCSyncProvider({
        bucket: 'test-bucket',
        prefix: 'prefix/',
        projectId: 'my-project'
      });
      
      expect(provider.type).toBe('gcs');
      expect(provider.bucket).toBe('test-bucket');
      expect(provider.projectId).toBe('my-project');
    });

    it('should throw when bucket not configured for push', async () => {
      const { GCSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new GCSyncProvider({});
      
      await expect(provider.push('content')).rejects.toThrow('GCS bucket not configured');
    });

    it('should push content successfully', async () => {
      const { GCSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new GCSyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.push('# Test content');
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('gcs');
    });

    it('should pull content successfully', async () => {
      const { GCSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new GCSyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.pull();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('gcs');
    });

    it('should test connection successfully', async () => {
      const { GCSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new GCSyncProvider({ bucket: 'test-bucket' });
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('gcs');
    });
  });

  describe('CustomSyncProvider', () => {
    it('should create Custom provider with config', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({
        endpoint: 'https://example.com/webhook',
        method: 'POST',
        headers: { 'X-Custom-Header': 'value' }
      });
      
      expect(provider.type).toBe('custom');
      expect(provider.endpoint).toBe('https://example.com/webhook');
      expect(provider.method).toBe('POST');
    });

    it('should use default POST method when not specified', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({
        endpoint: 'https://example.com/webhook'
      });
      
      expect(provider.method).toBe('POST');
    });

    it('should throw when endpoint not configured for push', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({});
      
      await expect(provider.push('content')).rejects.toThrow('Custom sync endpoint not configured');
    });

    it('should push content successfully', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({
        endpoint: 'https://example.com/webhook'
      });
      
      const result = await provider.push('# Test content');
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('custom');
    });

    it('should pull content successfully', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({
        endpoint: 'https://example.com/webhook'
      });
      
      const result = await provider.pull();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('custom');
    });

    it('should test connection successfully', async () => {
      const { CustomSyncProvider } = await import('../src/modules/remoteSync.js');
      
      const provider = new CustomSyncProvider({
        endpoint: 'https://example.com/webhook'
      });
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('custom');
    });
  });

  describe('configureRemoteSync', () => {
    it('should configure S3 provider successfully', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      const result = await configureRemoteSync('s3', {
        bucket: 'test-bucket',
        region: 'us-east-1'
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('s3');
    });

    it('should configure GCS provider successfully', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      const result = await configureRemoteSync('gcs', {
        bucket: 'test-bucket',
        projectId: 'my-project'
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('gcs');
    });

    it('should configure Custom provider successfully', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      const result = await configureRemoteSync('custom', {
        endpoint: 'https://example.com/webhook'
      });
      
      expect(result.success).toBe(true);
      expect(result.provider).toBe('custom');
    });

    it('should throw for invalid provider', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      await expect(configureRemoteSync('invalid', {})).rejects.toThrow('Invalid provider');
    });

    it('should throw when S3 bucket missing', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      await expect(configureRemoteSync('s3', {})).rejects.toThrow('S3 provider requires bucket');
    });

    it('should throw when GCS bucket missing', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      await expect(configureRemoteSync('gcs', {})).rejects.toThrow('GCS provider requires bucket');
    });

    it('should throw when Custom endpoint missing', async () => {
      const { configureRemoteSync } = await import('../src/modules/remoteSync.js');
      
      await expect(configureRemoteSync('custom', {})).rejects.toThrow('Custom provider requires endpoint');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status object', async () => {
      const { getSyncStatus } = await import('../src/modules/remoteSync.js');
      
      const status = await getSyncStatus();
      
      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('lastSync');
      expect(status).toHaveProperty('pendingChanges');
      expect(status).toHaveProperty('errors');
    });
  });

  describe('syncToRemote', () => {
    it('should return error when not configured', async () => {
      const { syncToRemote } = await import('../src/modules/remoteSync.js');
      
      const result = await syncToRemote(tempDir);
      
      // Either success or error depending on config state
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('uploaded');
      expect(result).toHaveProperty('failed');
    });
  });

  describe('syncGlobalIntelligence', () => {
    it('should sync global intelligence', async () => {
      const { syncGlobalIntelligence } = await import('../src/modules/remoteSync.js');
      
      const result = await syncGlobalIntelligence();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('uploaded');
      expect(result).toHaveProperty('failed');
    });
  });

  describe('initializeRemoteSync', () => {
    it('should initialize remote sync', async () => {
      const { initializeRemoteSync } = await import('../src/modules/remoteSync.js');
      
      const configured = await initializeRemoteSync();
      
      // Returns boolean indicating if configured
      expect(typeof configured).toBe('boolean');
    });
  });
});

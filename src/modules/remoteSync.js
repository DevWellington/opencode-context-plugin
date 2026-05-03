// Barrel file for remote sync module
// Re-exports all operations from syncOperations.js and provider classes from syncProviders.js

export {
  configureRemoteSync,
  getSyncStatus,
  syncToRemote,
  syncGlobalIntelligence,
  markPendingChanges,
  initializeRemoteSync
} from './syncOperations.js';

export {
  RemoteSyncProvider,
  S3SyncProvider,
  GCSyncProvider,
  CustomSyncProvider
} from './syncProviders.js';

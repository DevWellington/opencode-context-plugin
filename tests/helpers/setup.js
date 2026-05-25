import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function createTempDir(prefix = 'test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function cleanupTempDir(dir) {
  if (!dir) return;
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {}
}

export function mockS3SDK() {
  class MockS3Client {
    async send(command) {
      if (command.constructor.name === 'GetObjectCommand') {
        return { Body: { transformToString: async () => '# Mock S3 content' } };
      }
      return {};
    }
  }
  return {
    getS3: async () => ({
      S3Client: MockS3Client,
      PutObjectCommand: class PutObjectCommand { constructor(c) { Object.assign(this, c); } },
      GetObjectCommand: class GetObjectCommand { constructor(c) { Object.assign(this, c); } },
      HeadBucketCommand: class HeadBucketCommand { constructor(c) { Object.assign(this, c); } }
    })
  };
}

export function mockGcsSDK() {
  return {
    getStorage: async () => ({
      Storage: class MockStorage {
        constructor() {}
        bucket() {
          return {
            file: () => ({
              save: async () => {},
              download: async () => [Buffer.from('# Mock GCS content')]
            }),
            exists: async () => [true]
          };
        }
      }
    })
  };
}

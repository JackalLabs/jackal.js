import { describe, expect, test } from 'vitest';
import {
  hashAndHex,
  hashAndHexOwner,
  hexFullPath,
  merklePath,
  merklePathPlusIndex,
  bufferToHex,
  hexToBuffer
} from '@/utils/hash';

describe('Hash Functions', () => {
  test('hashAndHex should return a valid SHA-256 hex string', async () => {
    const hash = await hashAndHex('test input');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hashAndHexOwner should return valid Merkle hashed owner string', async () => {
    const hash = await hashAndHexOwner('abc123', 'user1');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hexFullPath should return valid Merkle path', async () => {
    const hash = await hexFullPath('path123', 'filename.txt');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('merklePath should generate consistent hashes', async () => {
    const path1 = await merklePath('dir1/dir2/file');
    const path2 = await merklePath(['dir1', 'dir2', 'file']);
    expect(path1).toBe(path2);
  });

  test('merklePathPlusIndex should generate indexed Merkle paths', async () => {
    const hash = await merklePathPlusIndex('dir1/', 5);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

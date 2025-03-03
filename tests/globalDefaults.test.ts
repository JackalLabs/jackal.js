import { describe, expect, test } from 'vitest';
import {
  chunkSize,
  encryptionChunkSize,
  assumedBlockTime,
  jackalTestnetChainConfig,
  keyAlgo,
  sockets
} from '@/utils/globalDefaults';

describe('Global Defaults', () => {
  test('chunkSize should not change', () => {
    expect(chunkSize).toBe(10240);
  });

  test('encryptionChunkSize should be correct', () => {
    expect(encryptionChunkSize).toBe(32 * Math.pow(1024, 2));
  });

  test('assumedBlockTime should be correct', () => {
    expect(assumedBlockTime).toBe(6);
  });

  test('jackalTestnetChainConfig should have correct chainId', () => {
    expect(jackalTestnetChainConfig.chainId).toBeDefined();
  });

  test('keyAlgo should be a valid algorithm', () => {
    expect(keyAlgo).toBeDefined();
  });

  test('sockets should be an object', () => {
    expect(typeof sockets).toBe('object');
  });
});

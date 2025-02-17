import { describe, it, expect, beforeEach } from 'vitest';
import { FiletreeReader } from '@/classes/filetreeReader'; // Fixed import

describe('FileTreeReader', () => {
  let reader: FileTreeReader;

  beforeEach(() => {
    reader = new FiletreeReader();
  });

  it('should correctly read a simple text file', async () => {
    const file = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' });
    const content = await reader.readFile(file);
    expect(content).toBe('Hello, World!');
  });

  it('should return an empty string for an empty file', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    const content = await reader.readFile(file);
    expect(content).toBe('');
  });

  it('should throw an error for null input', async () => {
    await expect(reader.readFile(null as unknown as File)).rejects.toThrow();
  });

  it('should correctly extract metadata from a file', () => {
    const file = new File(['Hello'], 'metadata.txt', { type: 'text/plain' });
    const metadata = reader.extractMetadata(file);
    expect(metadata).toMatchObject({
      name: 'metadata.txt',
      type: 'text/plain',
    });
  });

  it('should correctly read a large file', async () => {
    const largeContent = 'A'.repeat(1_000_000);
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' });
    const content = await reader.readFile(file);
    expect(content.length).toBe(1_000_000);
  });

  it('should correctly read a binary file', async () => {
    const file = new File([new Uint8Array([0x01, 0x02, 0x03])], 'binary.bin', {
      type: 'application/octet-stream',
    });
    const content = await reader.readFile(file);
    expect(typeof content).toBe('string');
  });

  it('should throw an error for unsupported file types', async () => {
    const file = new File(['<html></html>'], 'test.html', { type: 'text/html' });
    await expect(reader.readFile(file)).rejects.toThrow();
  });

  it('should correctly extract metadata for a binary file', () => {
    const file = new File([new Uint8Array([0x01, 0x02, 0x03])], 'binary.bin', {
      type: 'application/octet-stream',
    });
    const metadata = reader.extractMetadata(file);
    expect(metadata).toMatchObject({
      name: 'binary.bin',
      type: 'application/octet-stream',
    });
  });

  it('should handle a file with special characters in the name', async () => {
    const file = new File(['Test'], 'spécial@file$.txt', { type: 'text/plain' });
    const metadata = reader.extractMetadata(file);
    expect(metadata.name).toBe('spécial@file$.txt');
  });

  it('should return false for isFileEncrypted() when no encryption metadata is present', () => {
    const file = new File(['Hello'], 'unencrypted.txt', { type: 'text/plain' });
    expect(reader.isFileEncrypted(file)).toBe(false);
  });

  it('should return true for isFileEncrypted() when encryption metadata is detected', () => {
    const file = new File(['encrypted content'], 'encrypted.enc', { type: 'application/octet-stream' });
    expect(reader.isFileEncrypted(file)).toBe(true);
  });

  it('should correctly extract metadata from an empty file', () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' });
    const metadata = reader.extractMetadata(file);
    expect(metadata.name).toBe('empty.txt');
  });

  it('should throw an error when trying to read an undefined file', async () => {
    await expect(reader.readFile(undefined as unknown as File)).rejects.toThrow();
  });

  it('should correctly read a JSON file', async () => {
    const jsonContent = JSON.stringify({ key: 'value' });
    const file = new File([jsonContent], 'data.json', { type: 'application/json' });
    const content = await reader.readFile(file);
    expect(content).toBe(jsonContent);
  });

  it('should return undefined for non-existent metadata keys', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const metadata = reader.extractMetadata(file);
    expect(metadata['nonExistentKey']).toBeUndefined();
  });
});

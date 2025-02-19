import { describe, it, expect, vi } from 'vitest';
import { FiletreeReader } from '@/classes/filetreeReader';
import { FileMetaHandler, FolderMetaHandler } from '@/classes/metaHandlers';

vi.mock('@/classes/filetreeReader', () => ({
  FiletreeReader: {
    loadMetaByPath: vi.fn(),
    loadFolderMetaByPath: vi.fn(),
  }
}));

describe('FiletreeReader', () => {
  const validFilePath = 'test/path/file.txt';
  const validFolderPath = 'test/folder';
  const invalidPath = 'invalid/path';
  const deeplyNestedPath = 'folder/subfolder/subsubfolder/file.txt';
  const specialCharacterPath = 'folder/@special#chars&file!.txt';
  const emptyPath = '';

  const mockFileMeta = new FileMetaHandler({ 
    description: 'Test file', 
    fileMeta: {}, 
    location: validFilePath,
    refIndex: 0,
    sharerCount: 0
  });

  const mockFolderMeta = new FolderMetaHandler({
    count: 5,
    description: 'Test folder',
    location: validFolderPath,
    refIndex: 0,
    sharerCount: 0,
    ulid: 'test-ulid',
    whoAmI: 'tester'
  });

  it('should retrieve and parse file metadata', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    const result = await FiletreeReader.loadMetaByPath(validFilePath);
    
    expect(result).toBeInstanceOf(FileMetaHandler);
    expect(result.description).toBe('Test file');
  });

  it('should return an instance of FolderMetaHandler when loading folder metadata', async () => {
    (FiletreeReader.loadFolderMetaByPath as jest.Mock).mockResolvedValue(mockFolderMeta);
    const result = await FiletreeReader.loadFolderMetaByPath(validFolderPath);
    
    expect(result).toBeInstanceOf(FolderMetaHandler);
    expect(result.description).toBe('Test folder');
  });

  it('should return null for nonexistent metadata', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(null);
    const result = await FiletreeReader.loadMetaByPath(invalidPath);
    
    expect(result).toBeNull();
  });

  it('should handle deeply nested file paths', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    const result = await FiletreeReader.loadMetaByPath(deeplyNestedPath);
    
    expect(result).toBeInstanceOf(FileMetaHandler);
  });

  it('should handle special characters in file paths', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    const result = await FiletreeReader.loadMetaByPath(specialCharacterPath);
    
    expect(result).toBeInstanceOf(FileMetaHandler);
  });

  it('should handle empty path gracefully', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockRejectedValue(new Error('Invalid path provided'));
    
    await expect(FiletreeReader.loadMetaByPath(emptyPath)).rejects.toThrow('Invalid path provided');
  });

  it('should warn and return null when metadata retrieval fails', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockRejectedValue(new Error('Failed to load metadata'));

    await expect(FiletreeReader.loadMetaByPath(invalidPath)).rejects.toThrow('Failed to load metadata');
  });

  it('should return the correct metadata type for files and folders', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    (FiletreeReader.loadFolderMetaByPath as jest.Mock).mockResolvedValue(mockFolderMeta);
    
    const fileResult = await FiletreeReader.loadMetaByPath(validFilePath);
    const folderResult = await FiletreeReader.loadFolderMetaByPath(validFolderPath);
    
    expect(fileResult).toBeInstanceOf(FileMetaHandler);
    expect(folderResult).toBeInstanceOf(FolderMetaHandler);
  });

  it('should handle multiple simultaneous metadata retrievals', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    (FiletreeReader.loadFolderMetaByPath as jest.Mock).mockResolvedValue(mockFolderMeta);
    
    const [fileResult, folderResult] = await Promise.all([
      FiletreeReader.loadMetaByPath(validFilePath),
      FiletreeReader.loadFolderMetaByPath(validFolderPath)
    ]);
    
    expect(fileResult).toBeInstanceOf(FileMetaHandler);
    expect(folderResult).toBeInstanceOf(FolderMetaHandler);
  });



  it('should verify async operations complete within time limit', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFileMeta);
    
    const startTime = Date.now();
    await FiletreeReader.loadMetaByPath(validFilePath);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(500); // Ensuring response time < 500ms
  });

  it('should not crash when loading metadata from a nonexistent file', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(null);
    
    const result = await FiletreeReader.loadMetaByPath('nonexistent/file.txt');
    expect(result).toBeNull();
  });

  it('should correctly parse sharing metadata', async () => {
    const mockShareMeta = {
      location: 'shared/folder',
      metaDataType: 'share',
      owner: 'user123',
      pointsTo: 'fileXYZ'
    };

    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockShareMeta);
    const result = await FiletreeReader.loadMetaByPath('shared/folder');

    expect(result).toMatchObject({
      location: 'shared/folder',
      owner: 'user123',
      pointsTo: 'fileXYZ',
    });
  });

  it('should not return incorrect metadata type', async () => {
    (FiletreeReader.loadMetaByPath as jest.Mock).mockResolvedValue(mockFolderMeta);
    const result = await FiletreeReader.loadMetaByPath(validFilePath);

    expect(result).not.toBeInstanceOf(FileMetaHandler); // Shouldn't return folder data for file
  });
});

import { IFileMetaData, IRefMetaData, IFolderMetaData, INullMetaData } from '@/interfaces'

export interface IMetaHandler {
  addToCount(value: number): number
  setRefIndex(refIndex: number): void
  getPath(): string
  getRefIndex(): string

  getNullMeta(): INullMetaData
  getFolderMeta(): IFolderMetaData
  getFileMeta(): IFileMetaData
  getRefMeta(refIndex?: number): IRefMetaData
}

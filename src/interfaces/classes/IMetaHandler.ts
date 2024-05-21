import type {
  IFileMetaData,
  IFolderMetaData,
  INullMetaData,
  IRefMetaData,
  IShareFolderMetaData,
  IShareMetaData,
  IShareRefMetaData,
} from '@/interfaces'

export interface IMetaHandler {
  addToCount(value: number): number

  setRefIndex(refIndex: number): void

  getPath(): string

  getCount(): number

  getRefIndex(): string

  getNullMeta(): INullMetaData

  getFolderMeta(): IFolderMetaData

  getFileMeta(): IFileMetaData

  getShareFolderMeta(): IShareFolderMetaData

  getShareMeta(): IShareMetaData

  getRefMeta(): IRefMetaData

  getShareRefMeta(): IShareRefMetaData
}

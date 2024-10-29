import {
  IFileMetaData,
  IFolderMetaData,
  ILegacyFolderMetaData,
  INullMetaData,
  INullMetaHandler,
  INullRefMetaData,
  IRefMetaData,
  IRootLookupMetaData,
  IShareMetaData,
  ISharerMetaData,
  ISharerRefMetaData,
} from '@/interfaces'

export type TMetaDataTypes =
  | 'folder'
  | 'file'
  | 'ref'
  | 'null'
  | 'nullref'
  | 'share'
  | 'sharer'
  | 'sharerref'
  | 'rootlookup'
export type TMetaDataSets =
  | TChildMetaData
  | IShareMetaData
  | ISharerMetaData
  | ISharerRefMetaData
  | IRefMetaData
  | INullRefMetaData
  | ILegacyFolderMetaData
  | IRootLookupMetaData
export type TChildMetaData = INullMetaData | IFolderMetaData | IFileMetaData

export type TMergedMetaData = INullMetaData &
  IFolderMetaData &
  IFileMetaData &
  IRefMetaData &
  IShareMetaData
export type TFoundationalMetaData = Omit<TMergedMetaData, 'metaDataType'>

export type TChildNullMetaDataMap = Record<number, INullMetaHandler>
export type TChildFolderMetaDataMap = Record<number, IFolderMetaData>
export type TChildFileMetaDataMap = Record<number, IFileMetaData>

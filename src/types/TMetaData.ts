import {
  IFileMetaData,
  IFolderMetaData,
  ILegacyFolderMetaData,
  INullMetaData,
  INullMetaHandler,
  INullRefMetaData,
  INullSharerRefMetaData,
  IRefMetaData,
  IRootLookupMetaData,
  IShareMetaData,
  ISharerRefMetaData,
} from '@/interfaces'

export type TMetaDataTypes =
  | 'folder'
  | 'file'
  | 'ref'
  | 'null'
  | 'nullref'
  | 'nullsharerref'
  | 'share'
  | 'sharerref'
  | 'rootlookup'
export type TMetaDataSets =
  | TChildMetaData
  | IShareMetaData
  | ISharerRefMetaData
  | IRefMetaData
  | INullRefMetaData
  | INullSharerRefMetaData
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

import {
  IFileMetaData,
  IFolderMetaData,
  ILegacyFolderMetaData,
  INullMetaData,
  INullMetaHandler,
  IRefMetaData,
  IRootLookupMetaData,
  ISharedMetaDataMap,
  IShareFolderMetaData,
  IShareMetaData,
} from '@/interfaces'

export type TMetaDataTypes =
  | 'folder'
  | 'file'
  | 'ref'
  | 'null'
  | 'share'
  | 'shareref'
  | 'sharefolder'
export type TMetaDataSets =
  | TChildMetaData
  | TSharedMetaData
  | IRefMetaData
  | ILegacyFolderMetaData
  | IRootLookupMetaData
export type TChildMetaData = INullMetaData | IFolderMetaData | IFileMetaData
export type TSharedMetaData = IShareFolderMetaData | IShareMetaData

export type TMergedMetaData = INullMetaData &
  IFolderMetaData &
  IFileMetaData &
  IRefMetaData &
  IShareFolderMetaData &
  IShareMetaData
export type TFoundationalMetaData = Omit<TMergedMetaData, 'metaDataType'>

export type TChildNullMetaDataMap = Record<number, INullMetaHandler>
export type TChildFolderMetaDataMap = Record<number, IFolderMetaData>
export type TChildFileMetaDataMap = Record<number, IFileMetaData>

export type TSharedRootMetaDataMap = Record<string, ISharedMetaDataMap>

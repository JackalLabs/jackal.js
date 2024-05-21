import type {
  IBaseMetaData,
  IFileMetaData,
  IFolderMetaData,
  INullMetaData,
  IRefMetaData,
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
  | TOtherMetaData
  | TChildMetaData
  | TSharedMetaData
  | IRefMetaData
export type TChildMetaData = INullMetaData | IFolderMetaData | IFileMetaData
export type TSharedMetaData = IShareFolderMetaData | IShareMetaData

export type TMergedMetaData = INullMetaData &
  IFolderMetaData &
  IFileMetaData &
  IRefMetaData &
  IShareFolderMetaData &
  IShareMetaData
export type TFoundationalMetaData = Omit<TMergedMetaData, 'metaDataType'>

export type TOtherMetaData = IBaseMetaData & Record<string, any>

export type TChildNullMetaDataMap = Record<number, INullMetaData>
export type TChildFolderMetaDataMap = Record<number, IFolderMetaData>
export type TChildFileMetaDataMap = Record<number, IFileMetaData>

export type TSharedRootMetaDataMap = Record<string, ISharedMetaDataMap>

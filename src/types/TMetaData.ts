import {
  IBaseMetaData,
  IFileMetaData,
  IRefMetaData,
  IFolderMetaData,
  INullMetaData
} from '@/interfaces'

export type TMetaDataTypes = 'folder' | 'file' | 'ref' | 'null'
export type TMetaDataSets = TOtherMetaData | TChildMetaData | IRefMetaData
export type TChildMetaData = INullMetaData | IFolderMetaData | IFileMetaData

export type TMergedMetaData = INullMetaData & IFolderMetaData & IFileMetaData & IRefMetaData
export type TFoundationalMetaData = Omit<TMergedMetaData, 'metaDataType'>

export type TOtherMetaData = IBaseMetaData & Record<string, any>

export type TChildNullMetaDataMap = Record<number, INullMetaData>
export type TChildFolderMetaDataMap = Record<number, IFolderMetaData>
export type TChildFileMetaDataMap = Record<number, IFileMetaData>

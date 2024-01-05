import type {
  TChildFileMetaDataMap,
  TChildFolderMetaDataMap,
  TChildNullMetaDataMap,
  TMetaDataTypes
} from '@/types/TMetaData'

export interface IChildMetaDataMap {
  nulls: TChildNullMetaDataMap
  folders: TChildFolderMetaDataMap
  files: TChildFileMetaDataMap
}

export interface IFileMeta {
  name: string
  lastModified: number
  size: number
  type: string
}

export interface IMetaDataSource {
  whoAmI?: string
  count?: number
  hasChildren?: boolean
  file?: File
  fileMeta?: IFileMeta
}

export interface IBaseMetaData {
  metaDataType: TMetaDataTypes
  location: string
  merkleLocation: string
}

export interface INullMetaData extends IBaseMetaData {
  removed: true
}

export interface IFolderMetaData extends IBaseMetaData {
  whoAmI: string
  count: string
}

export interface IFileMetaData extends IBaseMetaData {
  merkleRoot: Uint8Array
  merkleMem: string
  fileMeta: IFileMeta
}

export interface IRefMetaData extends IBaseMetaData {
  pointsTo: string
}

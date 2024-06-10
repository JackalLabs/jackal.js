import type {
  TChildFileMetaDataMap,
  TChildFolderMetaDataMap,
  TChildNullMetaDataMap,
  TMetaDataTypes,
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
  file?: File
  fileMeta?: IFileMeta
  label?: string
  owner?: string
  pointsTo?: string

  legacyMerkle?: string
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

export interface ILegacyMetaData {
  whoAmI: string
  whereAmI: string
  whoOwnsMe: string
  dirChildren: string[]
  fileChildren: Record<string, IFileMeta>
}

export interface IShareRefMetaData extends IRefMetaData {}

export interface IShareFolderMetaData extends IFolderMetaData {
  pointsTo: string
  label: string
}

export interface IShareMetaData extends IRefMetaData {
  owner: string
}

export interface ISharedMetaDataMap
  extends Record<string, ISharedMetaDataMap | IShareMetaData> {}

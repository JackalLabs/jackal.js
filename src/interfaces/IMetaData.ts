import {
  TChildFileMetaDataMap,
  TChildFolderMetaDataMap,
  TChildNullMetaDataMap,
} from '@/types/TMetaData'

export interface IChildMetaDataMap {
  nulls: TChildNullMetaDataMap
  folders: TChildFolderMetaDataMap
  files: TChildFileMetaDataMap
}

export interface IFileMeta {
  lastModified: number
  name: string
  size: number
  type: string
}

export interface ILegacyFolderMetaData {
  dirChildren: string[]
  fileChildren: Record<string, IFileMeta>
  metaDataType: undefined
  whereAmI: string
  whoAmI: string
  whoOwnsMe: string
}

export interface IBaseMetaData {
  location: string
  merkleHex: string
}

export interface IRefMetaData extends IBaseMetaData {
  metaDataType: 'ref'
  pointsTo: string
}

export interface IShareRefMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  metaDataType: 'shareref'
}

export interface INullMetaData extends IBaseMetaData {
  metaDataType: 'null'
  removed: true
}

export interface IFolderMetaDataSource {
  count: number
  description?: string
  location: string
  name: string
  refIndex?: number
  ulid?: string
}

export interface IFolderMetaFoundationalData {
  count: number
  description: string
  location: string
  refIndex: number
  ulid: string
  whoAmI: string
}

export interface IFolderMetaData extends IBaseMetaData {
  count: string
  description: string
  metaDataType: 'folder'
  whoAmI: string
}

export interface IFileMetaDataSource {
  description?: string
  file?: File
  fileMeta: IFileMeta
  legacyMerkles?: Uint8Array[]
  location: string
  refIndex?: number
  thumbnail?: string
  ulid?: string
}

export interface IFileMetaFoundationalData {
  description: string
  fileMeta: IFileMeta
  location: string
  merkleHex: string
  merkleMem: string
  merkleRoot: Uint8Array
  refIndex: number
  thumbnail: string
  ulid: string
}

export interface IFileMetaData extends IBaseMetaData {
  description: string
  fileMeta: IFileMeta
  metaDataType: 'file'
  merkleMem: string
  merkleRoot: Uint8Array
  thumbnail: string
  ulid: string
}

export interface ISharedFolderMetaDataSource {
  count: number
  location: string
  name: string
  refIndex?: number
  ulid?: string
}

export interface ISharedFolderMetaFoundationalData {
  count: number
  location: string
  refIndex: number
  ulid: string
  whoAmI: string
}

export interface IShareFolderMetaData extends Omit<IFolderMetaData, 'metaDataType'> {
  metaDataType: 'sharefolder'
  pointsTo: string
}

export interface IShareMetaDataSource {
  label: string
  location: string
  owner: string
  pointsTo: string
  refIndex?: number
  ulid?: string
}

export interface IShareMetaFoundationalData {
  label: string
  location: string
  owner: string
  pointsTo: string
  refIndex: number
  ulid: string
}

export interface IShareMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  label: string
  metaDataType: 'share'
  owner: string
}

export interface ISharedMetaDataMap
  extends Record<string, ISharedMetaDataMap | IShareMetaData> {}

export interface IRootLookupMetaData {
  metaDataType: 'rootlookup'
  ulid: string
}

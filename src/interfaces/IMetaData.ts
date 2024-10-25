import { TChildFileMetaDataMap, TChildFolderMetaDataMap, TChildNullMetaDataMap } from '@/types/TMetaData'

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

export interface INullRefMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  metaDataType: 'nullref'
}

export interface INullMetaDataSource {
  location: string
  refIndex: number
  ulid: string
}

export interface INullMetaFoundationalData extends INullMetaDataSource {
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

export interface ICloneFileMetaDataSource {
  clone: IFileMetaData
  refIndex?: number
}

export interface INoCloneFileMetaDataSource {
  description?: string
  file?: File
  fileMeta: IFileMeta
  legacyMerkles?: Uint8Array[]
  location: string
  refIndex?: number
  thumbnail?: string
  ulid?: string
}

export type TFileMetaDataSource = ICloneFileMetaDataSource | INoCloneFileMetaDataSource

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

export interface IShareMetaDataSource {
  isFile: boolean
  name: string
  owner: string
  pointsTo: string
  refIndex?: number
  ulid?: string
}

export interface IShareMetaFoundationalData {
  isFile: boolean
  location: string
  name: string
  pointsTo: string
  refIndex: number
  ulid: string
}

export interface IShareMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  isFile: boolean
  location: string
  metaDataType: 'share'
  name: string
  pointsTo: string
  ulid: string
}

export interface IRootLookupMetaData {
  metaDataType: 'rootlookup'
  ulid: string
}

export interface ISharingMap extends Record<string, string[]> {
  sharers: string[]
}


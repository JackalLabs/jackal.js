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

export interface ISharerRefMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  metaDataType: 'sharerref'
  sharer: string
  type: TSharerType
  when: number
}

export interface INullRefMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  metaDataType: 'nullref'
}

export interface INullSharerRefMetaData extends Omit<ISharerRefMetaData, 'metaDataType'> {
  metaDataType: 'nullsharerref'
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

export interface ICloneFolderMetaDataSource {
  clone: IFolderMetaData
  ulid: string
  refIndex?: number
}

export interface INoCloneFolderMetaDataSource {
  count: number
  description?: string
  location: string
  name: string
  refIndex?: number
  sharerCount?: number
  ulid?: string
}

export type TFolderMetaDataSource = ICloneFolderMetaDataSource | INoCloneFolderMetaDataSource

export interface IFolderMetaFoundationalData {
  count: number
  description: string
  location: string
  refIndex: number
  sharerCount: number
  ulid: string
  whoAmI: string
}

export interface IFolderMetaData extends IBaseMetaData {
  count: string
  description: string
  metaDataType: 'folder'
  sharerCount?: string
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
  sharerCount?: number
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
  sharerCount: number
  thumbnail: string
  ulid: string
}

export interface IFileMetaData extends IBaseMetaData {
  description: string
  fileMeta: IFileMeta
  metaDataType: 'file'
  merkleMem?: string
  merkleRoot?: Uint8Array
  sharerCount?: string
  thumbnail: string
  ulid: string
}

export interface IShareMetaDataSource {
  isFile: boolean
  location: string
  name: string
  owner: string
  pointsTo: string
  received: number
  refIndex?: number
  ulid?: string
}

export interface IShareMetaFoundationalData {
  isFile: boolean
  location: string
  name: string
  owner: string
  pointsTo: string
  received: number
  refIndex: number
  ulid: string
}

export interface IShareMetaData extends Omit<IRefMetaData, 'metaDataType'> {
  isFile: boolean
  location: string
  metaDataType: 'share'
  name: string
  owner: string
  pointsTo: string
  received: number
  ulid: string
}

export interface IRootLookupMetaData {
  metaDataType: 'rootlookup'
  ulid: string
}

export type TSharerType = 'link' | 'user' | 'null'

export interface ISharerMetaDataSource {
  location: string
  sharer: string
  type?: TSharerType
  refIndex?: number
  ulid?: string
}

export interface ISharerMetaFoundationalData {
  location: string
  sharer: string
  type: TSharerType
  when: number
  refIndex: number
  ulid: string
}

export interface ICloneRnsMetaDataSource {
  clone: string
}

export interface INoCloneRnsMetaDataSource {
  avatar?: string
  bio?: string
  discord?: string
  extensions?: any
  telegram?: string
  thumbnail?: string
  twitter?: string
  website?: string
}

export type TRnsMetaDataSource = ICloneRnsMetaDataSource | INoCloneRnsMetaDataSource

export interface IRnsMetaFoundationalData {
  avatar: string
  bio: string
  discord: string
  extensions: any
  telegram: string
  thumbnail: string
  twitter: string
  website: string
}

export interface IRnsMetaData extends IRnsMetaFoundationalData {
  metaDataType: 'rns'
}

import {
  IChildMetaDataMap,
  IFileMetaHandler,
  IFolderMetaHandler, INullMetaHandler,
  IShareFolderMetaHandler,
  IShareMetaHandler,
} from '@/interfaces'

export type TTidyStringModes = 'start' | 'end' | 'both'
export type TLoadedFolder = [number, IChildMetaDataMap, boolean]

export type TMerkleParent = string
export type TMerkleChild = string
export type TMerkleParentChild = [TMerkleParent, TMerkleChild]

export type TMetaHandler = INullMetaHandler | IFolderMetaHandler | IFileMetaHandler | IShareFolderMetaHandler | IShareMetaHandler

export type TSockets =
  | 'jackal'
  | 'jackaltest'
  | 'jackalv4'
  | 'jackallocal'
  | 'archway'
  | 'archwaytest'
  | 'wasm'

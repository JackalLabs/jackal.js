import {
  IChildMetaDataMap,
  IFileMetaHandler,
  IFolderMetaHandler,
  INullMetaHandler,
  IShareMetaHandler,
  ISharerMetaHandler,
  type ISocketConfig,
} from '@/interfaces'

export type TTidyStringModes = 'start' | 'end' | 'both'
export type TLoadedFolder = [number, IChildMetaDataMap, boolean]

export type TMerkleParent = string
export type TMerkleChild = string
export type TMerkleParentChild = [TMerkleParent, TMerkleChild]

export type TMetaHandler =
  INullMetaHandler
  | IFolderMetaHandler
  | IFileMetaHandler
  | IShareMetaHandler
  | ISharerMetaHandler

export type TSockets =
  | 'jackal'
  | 'jackaltest'
  | 'jackallocal'
  | 'archway'
  | 'archwaytest'
  | 'wasm'

export type TSocketSet = Record<TSockets, ISocketConfig>

import type { IChildMetaDataMap } from '@/interfaces'

export type TTidyStringModes = 'start' | 'end' | 'both'
export type TLoadedFolder = [number, IChildMetaDataMap, boolean]

export type TMerkleParent = string
export type TMerkleChild = string
export type TMerkleParentChild = [TMerkleParent, TMerkleChild]

export type TSockets =
  | 'jackal'
  | 'jackaltest'
  | 'jackalv4'
  | 'jackallocal'
  | 'archway'
  | 'archwaytest'
  | 'wasm'

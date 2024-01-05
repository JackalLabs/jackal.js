import { IChildMetaDataMap } from '@/interfaces'

export type TTidyStringModes = 'start' | 'end' |'both'
export type TLoadedFolder = [number, IChildMetaDataMap]

export type TMerkleParent = string
export type TMerkleChild = string
export type TMerkleParentChild = [TMerkleParent, TMerkleChild]

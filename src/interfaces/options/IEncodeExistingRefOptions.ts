import { TViewerSetAll } from '@/interfaces'
import { TMerkleParentChild } from '@/types'

export interface IEncodeExistingRefOptions {
  location: TMerkleParentChild
  ref: number
  ulid: string
  viewers: TViewerSetAll
  ownerAddress?: string
}

import type { IAesBundle } from '@/interfaces'
import { TMetaHandler } from '@/types'

export interface IFileTreePackage {
  meta: TMetaHandler
  aes?: IAesBundle
}

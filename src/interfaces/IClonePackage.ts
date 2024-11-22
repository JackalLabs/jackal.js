import { IAesBundle, IFileMetaHandler } from '@/interfaces'

export interface IClonePackage {
  duration: number
  meta: IFileMetaHandler
  size: number
  aes?: IAesBundle
}

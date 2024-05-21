import type { IAesBundle, IMetaHandler } from '@/interfaces'

export interface IUploadPackage {
  file: File
  meta: IMetaHandler
  duration: number
  aes?: IAesBundle
}
